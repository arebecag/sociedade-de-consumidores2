import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PROXY_URL = "https://arebecag-asaas-proxy.vercel.app";

// ── Distribuição inline de comissões ──────────────────────────────────────────
async function distribuirComissoesInline(base44, purchaseId, buyerPartnerId, amount) {
  const results = [];

  // 1. PAI DIRETO → 15%
  const directRels = await base44.asServiceRole.entities.NetworkRelation.filter({
    referred_id: buyerPartnerId,
    relation_type: 'direct'
  });

  if (directRels.length > 0) {
    const rel = directRels[0];
    const pai = await base44.asServiceRole.entities.Partner.get(rel.referrer_id);
    if (pai) {
      const existing = await base44.asServiceRole.entities.BonusTransaction.filter({
        purchase_id: purchaseId,
        partner_id: pai.id
      });
      if (existing.length === 0) {
        const forWithdrawal = amount * 0.15;
        const forPurchases = forWithdrawal * 0.50;
        const status = pai.status === 'ativo' ? 'credited' : 'blocked';
        await base44.asServiceRole.entities.BonusTransaction.create({
          partner_id: pai.id,
          partner_name: pai.full_name,
          source_partner_id: buyerPartnerId,
          source_partner_name: rel.referred_name,
          purchase_id: purchaseId,
          type: 'direct',
          percentage: 15,
          total_amount: forWithdrawal,
          amount_for_withdrawal: forWithdrawal,
          amount_for_purchases: forPurchases,
          status
        });
        if (status === 'credited') {
          await base44.asServiceRole.entities.Partner.update(pai.id, {
            total_bonus_generated: (pai.total_bonus_generated || 0) + forWithdrawal,
            bonus_for_withdrawal: (pai.bonus_for_withdrawal || 0) + forWithdrawal,
            bonus_for_purchases: (pai.bonus_for_purchases || 0) + forPurchases
          });
        }
        results.push({ type: 'direct', partner: pai.full_name, forWithdrawal, status });
      }
    }
  }

  // 2. AVÔ INDIRETO → 30%
  const indirectRels = await base44.asServiceRole.entities.NetworkRelation.filter({
    referred_id: buyerPartnerId,
    relation_type: 'indirect'
  });

  if (indirectRels.length > 0) {
    const rel = indirectRels[0];
    const avo = await base44.asServiceRole.entities.Partner.get(rel.referrer_id);
    if (avo) {
      const existing = await base44.asServiceRole.entities.BonusTransaction.filter({
        purchase_id: purchaseId,
        partner_id: avo.id
      });
      if (existing.length === 0) {
        const forWithdrawal = amount * 0.30;
        const forPurchases = forWithdrawal * 0.50;
        const status = avo.status === 'ativo' ? 'credited' : 'blocked';
        await base44.asServiceRole.entities.BonusTransaction.create({
          partner_id: avo.id,
          partner_name: avo.full_name,
          source_partner_id: buyerPartnerId,
          source_partner_name: rel.referred_name,
          purchase_id: purchaseId,
          type: 'indirect',
          percentage: 30,
          total_amount: forWithdrawal,
          amount_for_withdrawal: forWithdrawal,
          amount_for_purchases: forPurchases,
          status
        });
        if (status === 'credited') {
          await base44.asServiceRole.entities.Partner.update(avo.id, {
            total_bonus_generated: (avo.total_bonus_generated || 0) + forWithdrawal,
            bonus_for_withdrawal: (avo.bonus_for_withdrawal || 0) + forWithdrawal,
            bonus_for_purchases: (avo.bonus_for_purchases || 0) + forPurchases
          });
        }
        results.push({ type: 'indirect', partner: avo.full_name, forWithdrawal, status });
      }
    }
  }

  return results;
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const cobranças = await base44.asServiceRole.entities.Financeiro.filter({ status: "PENDING" });
    if (cobranças.length === 0) {
      return Response.json({ ok: true, verificadas: 0, confirmadas: 0 });
    }

    let confirmadas = 0;

    for (const cobranca of cobranças) {
      if (!cobranca.asaasPaymentId) continue;

      let data;
      try {
        const resp = await fetch(`${PROXY_URL}/api/consultar-cobranca?id=${cobranca.asaasPaymentId}`);
        if (!resp.ok) continue;
        data = await resp.json();
      } catch (e) {
        console.error(`[polling] Erro ao consultar Asaas: ${e.message}`);
        continue;
      }

      const novoStatus = data.status;
      if (novoStatus === cobranca.status) continue;

      const updateData = {
        status: novoStatus,
        invoiceUrl: data.invoiceUrl || cobranca.invoiceUrl,
        bankSlipUrl: data.bankSlipUrl || cobranca.bankSlipUrl
      };

      if (["CONFIRMED", "RECEIVED"].includes(novoStatus)) {
        confirmadas++;
        updateData.dataPagamento = new Date().toISOString();
        updateData.acessoLiberado = true;

        // Só processa uma vez (bonusLiberado = flag de idempotência)
        // CRÍTICO: só marca bonusLiberado=true DEPOIS de processar tudo com sucesso
        if (!cobranca.bonusLiberado) {

          const parceiro = await base44.asServiceRole.entities.Partner.get(cobranca.userId);

          if (parceiro) {
            // 1. Ativar parceiro
            const pendingReasons = (parceiro.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
            const partnerUpdate = { first_purchase_done: true, pending_reasons: pendingReasons };
            if (pendingReasons.length === 0) partnerUpdate.status = "ativo";
            await base44.asServiceRole.entities.Partner.update(cobranca.userId, partnerUpdate);
            console.log(`[polling] Parceiro ${parceiro.full_name} ativado`);

            // 2. Buscar compras pendentes e deduplicar por produto
            const todasPendentes = await base44.asServiceRole.entities.Purchase.filter({
              partner_id: cobranca.userId,
              status: 'pending'
            });
            console.log(`[polling] ${todasPendentes.length} compras pendentes para ${parceiro.full_name}`);

            // Deduplicar: por product_id manter a mais recente, cancelar as demais
            const porProduto = {};
            for (const p of todasPendentes) {
              const key = p.product_id || p.id;
              if (!porProduto[key]) {
                porProduto[key] = p;
              } else {
                const existente = porProduto[key];
                if (new Date(p.created_date) > new Date(existente.created_date)) {
                  await base44.asServiceRole.entities.Purchase.update(existente.id, { status: 'cancelled' });
                  porProduto[key] = p;
                } else {
                  await base44.asServiceRole.entities.Purchase.update(p.id, { status: 'cancelled' });
                }
              }
            }

            const purchasesUnicas = Object.values(porProduto);
            let downloadLink = '';

            for (const purchase of purchasesUnicas) {
              // 3. Marcar como paga e liberar download
              await base44.asServiceRole.entities.Purchase.update(purchase.id, {
                status: 'paid',
                download_available: true
              });
              console.log(`[polling] Purchase ${purchase.id} liberada`);

              // Link de download
              if (!downloadLink && purchase.product_id) {
                try {
                  const product = await base44.asServiceRole.entities.Product.get(purchase.product_id);
                  if (product && product.download_url) downloadLink = product.download_url;
                } catch (e) {
                  console.error(`[polling] Erro ao buscar produto: ${e.message}`);
                }
              }

              // 4. Distribuir comissões
              try {
                const comissoes = await distribuirComissoesInline(
                  base44, purchase.id, cobranca.userId, purchase.amount
                );
                console.log(`[polling] Comissões distribuídas para ${purchase.id}:`, JSON.stringify(comissoes));
              } catch (e) {
                console.error(`[polling] ERRO comissões purchase ${purchase.id}: ${e.message}`);
              }
            }

            // 5. Emitir nota fiscal
            try {
              await base44.asServiceRole.functions.invoke('blingEmitirNotaAutomatica', {
                payment_id: cobranca.asaasPaymentId
              });
              console.log(`[polling] Nota fiscal solicitada para ${cobranca.asaasPaymentId}`);
            } catch (e) {
              console.error(`[polling] Erro nota fiscal: ${e.message}`);
            }

            // 6. Enviar email de ativação
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: parceiro.email,
                subject: '🎉 Parabéns! Você está ATIVO na Sociedade de Consumidores!',
                body: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #09090b; color: #fff; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h1 style="color: #f97316; font-size: 28px; margin: 0;">Sociedade de Consumidores</h1>
                    </div>
                    <h2 style="color: #22c55e; text-align: center;">🎉 Parabéns, ${parceiro.full_name}!</h2>
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
                      Seu pagamento foi confirmado e você já está <strong style="color: #22c55e;">ATIVO</strong> na <strong style="color: #f97316;">Sociedade de Consumidores</strong>!
                    </p>
                    ${downloadLink ? `
                    <div style="background: #1c1917; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                      <p style="color: #f97316; font-weight: bold; margin: 0 0 12px;">📥 Seu produto está disponível para download:</p>
                      <a href="${downloadLink}" style="background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                        Baixar agora
                      </a>
                    </div>
                    ` : ''}
                    <div style="background: #1c1917; border: 1px solid #374151; border-radius: 8px; padding: 16px; margin: 20px 0;">
                      <p style="color: #9ca3af; margin: 0 0 8px; font-size: 14px;">Acesse seu Escritório Virtual:</p>
                      <a href="https://3x3sc.com.br" style="color: #f97316; font-weight: bold; font-size: 16px; text-decoration: none;">3x3sc.com.br</a>
                    </div>
                    <div style="border-top: 1px solid #374151; padding-top: 16px; margin-top: 24px;">
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">📋 <strong>Nota Fiscal:</strong> Será emitida e enviada automaticamente.</p>
                      <p style="color: #6b7280; font-size: 14px; margin: 0;">💰 <strong>Comissões:</strong> Seus indicadores já foram notificados dos bônus!</p>
                    </div>
                    <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">
                      Dúvidas? Contate-nos pelo WhatsApp (11) 95145-3200
                    </p>
                  </div>
                `
              });
              console.log(`[polling] Email enviado para: ${parceiro.email}`);
            } catch (e) {
              console.error(`[polling] Erro email: ${e.message}`);
            }

            // 7. SÓ AGORA marca como processado (após tudo concluído)
            updateData.bonusLiberado = true;
          }
        }
      } else if (novoStatus === "OVERDUE") {
        updateData.acessoLiberado = false;
      }

      await base44.asServiceRole.entities.Financeiro.update(cobranca.id, updateData);
      console.log(`[polling] Financeiro ${cobranca.id} → ${novoStatus}`);
    }

    return Response.json({ ok: true, verificadas: cobranças.length, confirmadas });

  } catch (error) {
    console.error('[polling] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});