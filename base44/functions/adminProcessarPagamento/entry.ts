import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admins podem processar pagamentos manualmente
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { financeiroId } = await req.json();

    if (!financeiroId) {
      return Response.json({ error: 'financeiroId é obrigatório' }, { status: 400 });
    }

    // Buscar o registro financeiro
    const financeiros = await base44.asServiceRole.entities.Financeiro.filter({ id: financeiroId });
    if (financeiros.length === 0) {
      return Response.json({ error: 'Registro financeiro não encontrado' }, { status: 404 });
    }

    const boleto = financeiros[0];

    // Atualizar status do financeiro
    const updateData = {
      status: 'CONFIRMED',
      dataPagamento: new Date().toISOString(),
      acessoLiberado: true
    };

    // Se ainda não liberou bônus, processar tudo
    if (!boleto.bonusLiberado) {
      updateData.bonusLiberado = true;

      // 1. Ativar parceiro
      const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
      if (parceiros.length > 0) {
        const parceiro = parceiros[0];
        const pendingReasons = (parceiro.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
        const updatePartner = { 
          first_purchase_done: true, 
          pending_reasons: pendingReasons,
          status: pendingReasons.length === 0 ? "ativo" : parceiro.status
        };
        await base44.asServiceRole.entities.Partner.update(boleto.userId, updatePartner);
        console.log(`[adminProcessar] Parceiro ${parceiro.full_name} ativado`);
      }

      // 2. Distribuir comissões
      try {
        const internalSecret = Deno.env.get("INTERNAL_SECRET");
        const comissoesRes = await fetch(`${req.url.replace('/adminProcessarPagamento', '/distribuirComissoes')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': internalSecret || ''
          },
          body: JSON.stringify({
            purchaseId: boleto.id,
            amount: boleto.valor,
            buyerPartnerId: boleto.userId
          })
        });
        await comissoesRes.json();
        console.log(`[adminProcessar] Comissões distribuídas`);
      } catch (e) {
        console.error(`[adminProcessar] Erro comissões: ${e.message}`);
      }

      // 3. Processar compra
      try {
        const internalSecret = Deno.env.get("INTERNAL_SECRET");
        await fetch(`${req.url.replace('/adminProcessarPagamento', '/processPurchasePayment')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': internalSecret || ''
          },
          body: JSON.stringify({
            financeiroId: boleto.id,
            partnerId: boleto.userId
          })
        });
        console.log(`[adminProcessar] Purchase processada`);
      } catch (e) {
        console.error(`[adminProcessar] Erro purchase: ${e.message}`);
      }

      // 4. Emitir nota fiscal
      try {
        const internalSecret = Deno.env.get("INTERNAL_SECRET");
        await fetch(`${req.url.replace('/adminProcessarPagamento', '/blingEmitirNotaAutomatica')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': internalSecret || ''
          },
          body: JSON.stringify({
            payment_id: boleto.asaasPaymentId
          })
        });
        console.log(`[adminProcessar] Nota fiscal solicitada`);
      } catch (e) {
        console.error(`[adminProcessar] Erro nota fiscal: ${e.message}`);
      }

      // 5. Enviar email de boas-vindas
      try {
        const parceirosEmail = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
        if (parceirosEmail.length > 0) {
          const p = parceirosEmail[0];
          
          // Buscar link do produto
          let downloadLink = '';
          const purchases = await base44.asServiceRole.entities.Purchase.filter({ 
            partner_id: boleto.userId, 
            status: 'paid' 
          });
          if (purchases.length > 0) {
            const lastPurchase = purchases[purchases.length - 1];
            const products = await base44.asServiceRole.entities.Product.filter({ id: lastPurchase.product_id });
            if (products.length > 0 && products[0].download_url) {
              downloadLink = products[0].download_url;
            }
          }

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: p.email,
            subject: '🎉 Parabéns! Você está ATIVO na Sociedade de Consumidores!',
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #09090b; color: #fff; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #f97316; font-size: 28px; margin: 0;">Sociedade de Consumidores</h1>
                </div>
                <h2 style="color: #22c55e; text-align: center;">🎉 Parabéns, ${p.full_name}!</h2>
                <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
                  Seu pagamento foi confirmado e você já está <strong style="color: #22c55e;">ATIVO</strong> na <strong style="color: #f97316;">Sociedade de Consumidores</strong>!
                </p>
                <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
                  Agora você pode aproveitar todos os benefícios da plataforma: receber bônus das compras de seus clientes, pagar seus boletos com bônus e muito mais.
                </p>
                ${downloadLink ? `
                <div style="background: #1c1917; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="color: #f97316; font-weight: bold; margin: 0 0 8px;">📥 Seu produto está disponível:</p>
                  <a href="${downloadLink}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                    Baixar agora
                  </a>
                </div>
                ` : ''}
                <div style="background: #1c1917; border: 1px solid #374151; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="color: #9ca3af; margin: 0 0 8px; font-size: 14px;">Acesse seu Escritório Virtual:</p>
                  <a href="https://3x3sc.com.br" style="color: #f97316; font-weight: bold; font-size: 16px;">3x3sc.com.br</a>
                </div>
                <p style="color: #6b7280; font-size: 12px; text-align: center;">
                  Dúvidas? Contate-nos pelo WhatsApp (11) 95145-3200 ou suporte@sociedadedeconsumidores.com.br
                </p>
              </div>
            `
          });
          console.log(`[adminProcessar] Email de ativação enviado para: ${p.email}`);
        }
      } catch (e) {
        console.error(`[adminProcessar] Erro email: ${e.message}`);
      }
    }

    // Atualizar registro financeiro
    await base44.asServiceRole.entities.Financeiro.update(boleto.id, updateData);

    return Response.json({ 
      success: true, 
      message: 'Pagamento processado com sucesso',
      updated: updateData
    });

  } catch (error) {
    console.error('[adminProcessarPagamento] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});