import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Função para corrigir manualmente pagamentos que foram confirmados mas não processados
// Útil para casos onde bonusLiberado=true mas purchases continuaram pending

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Só admin pode chamar
    try {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
    } catch (_) {}

    const body = await req.json().catch(() => ({}));
    const { partnerId, partnerEmail, dryRun = false } = body;

    if (!partnerId && !partnerEmail) {
      return Response.json({ error: 'Informe partnerId ou partnerEmail' }, { status: 400 });
    }

    // Buscar parceiro
    let parceiro;
    if (partnerId) {
      parceiro = await base44.asServiceRole.entities.Partner.get(partnerId);
    } else {
      const lista = await base44.asServiceRole.entities.Partner.filter({ email: partnerEmail });
      parceiro = lista[0];
    }

    if (!parceiro) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    const log = { parceiro: parceiro.full_name, email: parceiro.email, acoes: [] };

    // 1. Garantir que o parceiro está ATIVO
    if (parceiro.status !== 'ativo' || !parceiro.first_purchase_done) {
      const pendingReasons = (parceiro.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
      if (!dryRun) {
        await base44.asServiceRole.entities.Partner.update(parceiro.id, {
          first_purchase_done: true,
          status: 'ativo',
          pending_reasons: pendingReasons
        });
      }
      log.acoes.push(`Parceiro ativado (status era: ${parceiro.status})`);
    } else {
      log.acoes.push('Parceiro já estava ativo');
    }

    // 2. Buscar todas as compras pending
    const todasPendentes = await base44.asServiceRole.entities.Purchase.filter({
      partner_id: parceiro.id,
      status: 'pending'
    });

    log.acoes.push(`${todasPendentes.length} compras pending encontradas`);

    // Deduplicar por produto - manter mais recente
    const porProduto = {};
    for (const p of todasPendentes) {
      const key = p.product_id || p.id;
      if (!porProduto[key]) {
        porProduto[key] = p;
      } else {
        if (new Date(p.created_date) > new Date(porProduto[key].created_date)) {
          if (!dryRun) await base44.asServiceRole.entities.Purchase.update(porProduto[key].id, { status: 'cancelled' });
          log.acoes.push(`Purchase duplicada ${porProduto[key].id} cancelada`);
          porProduto[key] = p;
        } else {
          if (!dryRun) await base44.asServiceRole.entities.Purchase.update(p.id, { status: 'cancelled' });
          log.acoes.push(`Purchase duplicada ${p.id} cancelada`);
        }
      }
    }

    const purchasesUnicas = Object.values(porProduto);
    let downloadLink = '';

    for (const purchase of purchasesUnicas) {
      // 3. Marcar como paga
      if (!dryRun) {
        await base44.asServiceRole.entities.Purchase.update(purchase.id, {
          status: 'paid',
          download_available: true
        });
      }
      log.acoes.push(`Purchase ${purchase.id} (${purchase.product_name}) marcada como PAGA`);

      // Buscar link de download
      if (!downloadLink && purchase.product_id) {
        try {
          const product = await base44.asServiceRole.entities.Product.get(purchase.product_id);
          if (product?.download_url) downloadLink = product.download_url;
        } catch (_) {}
      }

      // 4. Distribuir comissões (idempotente - verifica antes de criar)
      if (!dryRun) {
        try {
          const directRels = await base44.asServiceRole.entities.NetworkRelation.filter({
            referred_id: parceiro.id, relation_type: 'direct'
          });
          if (directRels.length > 0) {
            const pai = await base44.asServiceRole.entities.Partner.get(directRels[0].referrer_id);
            if (pai) {
              const existente = await base44.asServiceRole.entities.BonusTransaction.filter({
                purchase_id: purchase.id, partner_id: pai.id
              });
              if (existente.length === 0) {
                const val = purchase.amount * 0.15;
                const status = pai.status === 'ativo' ? 'credited' : 'blocked';
                await base44.asServiceRole.entities.BonusTransaction.create({
                  partner_id: pai.id, partner_name: pai.full_name,
                  source_partner_id: parceiro.id, source_partner_name: parceiro.full_name,
                  purchase_id: purchase.id, type: 'direct', percentage: 15,
                  total_amount: val, amount_for_withdrawal: val, amount_for_purchases: val * 0.5, status
                });
                if (status === 'credited') {
                  await base44.asServiceRole.entities.Partner.update(pai.id, {
                    total_bonus_generated: (pai.total_bonus_generated || 0) + val,
                    bonus_for_withdrawal: (pai.bonus_for_withdrawal || 0) + val,
                    bonus_for_purchases: (pai.bonus_for_purchases || 0) + val * 0.5
                  });
                }
                log.acoes.push(`Comissão 15% creditada para ${pai.full_name}`);
              } else {
                log.acoes.push(`Comissão pai já existia`);
              }
            }
          }

          const indirectRels = await base44.asServiceRole.entities.NetworkRelation.filter({
            referred_id: parceiro.id, relation_type: 'indirect'
          });
          if (indirectRels.length > 0) {
            const avo = await base44.asServiceRole.entities.Partner.get(indirectRels[0].referrer_id);
            if (avo) {
              const existente = await base44.asServiceRole.entities.BonusTransaction.filter({
                purchase_id: purchase.id, partner_id: avo.id
              });
              if (existente.length === 0) {
                const val = purchase.amount * 0.30;
                const status = avo.status === 'ativo' ? 'credited' : 'blocked';
                await base44.asServiceRole.entities.BonusTransaction.create({
                  partner_id: avo.id, partner_name: avo.full_name,
                  source_partner_id: parceiro.id, source_partner_name: parceiro.full_name,
                  purchase_id: purchase.id, type: 'indirect', percentage: 30,
                  total_amount: val, amount_for_withdrawal: val, amount_for_purchases: val * 0.5, status
                });
                if (status === 'credited') {
                  await base44.asServiceRole.entities.Partner.update(avo.id, {
                    total_bonus_generated: (avo.total_bonus_generated || 0) + val,
                    bonus_for_withdrawal: (avo.bonus_for_withdrawal || 0) + val,
                    bonus_for_purchases: (avo.bonus_for_purchases || 0) + val * 0.5
                  });
                }
                log.acoes.push(`Comissão 30% creditada para ${avo.full_name}`);
              } else {
                log.acoes.push(`Comissão avô já existia`);
              }
            }
          }
        } catch (e) {
          log.acoes.push(`ERRO comissões: ${e.message}`);
        }
      }
    }

    // 5. Emitir nota fiscal
    if (!dryRun) {
      try {
        const financeiro = await base44.asServiceRole.entities.Financeiro.filter({ userId: parceiro.id });
        const fin = financeiro.find(f => ['CONFIRMED','RECEIVED'].includes(f.status));
        if (fin?.asaasPaymentId) {
          await base44.asServiceRole.functions.invoke('blingEmitirNotaAutomatica', {
            payment_id: fin.asaasPaymentId
          });
          log.acoes.push(`Nota fiscal solicitada para ${fin.asaasPaymentId}`);
        }
      } catch (e) {
        log.acoes.push(`ERRO nota fiscal: ${e.message}`);
      }
    }

    // 6. Enviar email com livros
    if (!dryRun) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: parceiro.email,
          subject: '🎉 Parabéns! Você está ATIVA na Sociedade de Consumidores!',
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #09090b; color: #fff; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #f97316; font-size: 28px; margin: 0;">Sociedade de Consumidores</h1>
              </div>
              <h2 style="color: #22c55e; text-align: center;">🎉 Parabéns, ${parceiro.full_name}!</h2>
              <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
                Seu pagamento foi confirmado e você já está <strong style="color: #22c55e;">ATIVA</strong> na <strong style="color: #f97316;">Sociedade de Consumidores</strong>!
              </p>
              ${downloadLink ? `
              <div style="background: #1c1917; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="color: #f97316; font-weight: bold; margin: 0 0 12px;">📥 Seus livros estão disponíveis para download:</p>
                <a href="${downloadLink}" style="background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                  📚 Baixar os 17 Livros Agora
                </a>
              </div>
              ` : ''}
              <div style="background: #1c1917; border: 1px solid #374151; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="color: #9ca3af; margin: 0 0 8px; font-size: 14px;">Acesse seu Escritório Virtual:</p>
                <a href="https://3x3sc.com.br" style="color: #f97316; font-weight: bold; font-size: 16px; text-decoration: none;">3x3sc.com.br</a>
              </div>
              <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">
                Dúvidas? Contate-nos pelo WhatsApp (11) 95145-3200
              </p>
            </div>
          `
        });
        log.acoes.push(`Email com livros enviado para ${parceiro.email}`);
      } catch (e) {
        log.acoes.push(`ERRO email: ${e.message}`);
      }
    }

    return Response.json({ success: true, dryRun, ...log });

  } catch (error) {
    console.error('[corrigirPagamento] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});