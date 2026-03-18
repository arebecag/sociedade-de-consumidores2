import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Processa confirmação de pagamento de uma compra (Purchase)
 * Quando um boleto/PIX da entidade Financeiro é confirmado:
 * 1. Ativa o parceiro (remove "Falta da primeira compra")
 * 2. Distribui comissões
 * 3. Libera acesso ao produto
 * 4. Envia email de confirmação
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validar secret interno
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const receivedSecret = req.headers.get("x-internal-secret");
    if (!internalSecret || receivedSecret !== internalSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { financeiroId, partnerId } = await req.json();
    if (!financeiroId || !partnerId) {
      return Response.json({ error: 'financeiroId e partnerId obrigatórios' }, { status: 400 });
    }

    console.log(`[processPurchasePayment] Iniciando para Financeiro ${financeiroId}, Partner ${partnerId}`);

    // 1. Buscar Partner
    const partners = await base44.asServiceRole.entities.Partner.filter({ id: partnerId });
    if (partners.length === 0) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }
    const partner = partners[0];

    // 2. Buscar Purchase pendente deste parceiro (a mais recente)
    const purchases = await base44.asServiceRole.entities.Purchase.filter({
      partner_id: partnerId,
      status: 'pending'
    });
    
    if (purchases.length === 0) {
      console.log(`[processPurchasePayment] Nenhuma Purchase pendente encontrada para ${partnerId}`);
      return Response.json({ error: 'Nenhuma compra pendente encontrada' }, { status: 404 });
    }

    // Pegar a compra mais recente
    const purchase = purchases.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    )[0];

    console.log(`[processPurchasePayment] Purchase encontrada: ${purchase.id} - ${purchase.product_name}`);

    // 3. Atualizar Purchase para "paid" e liberar download
    await base44.asServiceRole.entities.Purchase.update(purchase.id, {
      status: 'paid',
      download_available: true
    });

    // 4. Atualizar Partner - ativar e marcar primeira compra
    const isFirstPurchase = !partner.first_purchase_done;
    const pendingReasons = (partner.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
    
    const partnerUpdates = {
      first_purchase_done: true,
      pending_reasons: pendingReasons,
      total_spent_purchases: (partner.total_spent_purchases || 0) + purchase.paid_with_boleto
    };

    // Se não tem mais pendências (CPF e endereço preenchidos), ativar
    if (pendingReasons.length === 0) {
      partnerUpdates.status = "ativo";
    }

    await base44.asServiceRole.entities.Partner.update(partnerId, partnerUpdates);
    console.log(`[processPurchasePayment] Partner ${partner.full_name} atualizado - first_purchase_done: true`);

    // Nota: comissões são distribuídas pelo polling/webhook que chama distribuirComissoes diretamente

    // 6. Buscar produto para obter link de download
    let downloadLink = '';
    const products = await base44.asServiceRole.entities.Product.filter({ id: purchase.product_id });
    if (products.length > 0 && products[0].download_url) {
      downloadLink = products[0].download_url;
    }

    // 7. Enviar email de confirmação
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: partner.email,
        subject: '🎉 Parabéns! Sua compra foi confirmada!',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #09090b; color: #fff; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #f97316; font-size: 28px; margin: 0;">Sociedade de Consumidores</h1>
            </div>
            <h2 style="color: #22c55e; text-align: center;">🎉 Pagamento Confirmado!</h2>
            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
              Olá, ${partner.full_name}!
            </p>
            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
              Seu pagamento de <strong style="color: #f97316;">R$ ${purchase.amount.toFixed(2)}</strong> para o produto <strong>${purchase.product_name}</strong> foi confirmado!
            </p>
            ${isFirstPurchase ? `
            <div style="background: #065f46; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="color: #86efac; font-weight: bold; margin: 0;">✅ Primeira compra realizada com sucesso!</p>
              <p style="color: #d1fae5; margin: 8px 0 0;">Sua conta agora está <strong>ATIVA</strong> e você pode começar a receber bônus das compras de seus clientes!</p>
            </div>
            ` : ''}
            ${downloadLink ? `
            <div style="background: #1c1917; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <p style="color: #f97316; font-weight: bold; margin: 0 0 12px;">📥 Seu produto está disponível!</p>
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
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">📋 <strong>Nota Fiscal:</strong> Será enviada por e-mail em até 48h úteis.</p>
              <p style="color: #6b7280; font-size: 14px; margin: 0;">💰 <strong>Comissões:</strong> Seus indicadores já receberam os bônus desta compra!</p>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">
              Dúvidas? Contate-nos pelo WhatsApp (11) 95145-3200 ou suporte@sociedadedeconsumidores.com.br
            </p>
          </div>
        `
      });
      console.log(`[processPurchasePayment] Email de confirmação enviado para: ${partner.email}`);
    } catch (emailErr) {
      console.error(`[processPurchasePayment] Erro ao enviar email: ${emailErr.message}`);
    }

    return Response.json({
      success: true,
      purchase_id: purchase.id,
      partner_activated: pendingReasons.length === 0,
      download_link: downloadLink
    });

  } catch (error) {
    console.error('[processPurchasePayment] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});