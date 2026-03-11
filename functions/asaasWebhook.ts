import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validar token do webhook Asaas
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");
    if (webhookToken && receivedToken !== webhookToken) {
      console.warn("asaasWebhook: token inválido recebido:", receivedToken);
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { event, payment } = body;

    console.log(`[asaasWebhook] Evento: ${event}, PaymentId: ${payment?.id}, Status: ${payment?.status}`);

    if (!payment?.id) {
      return Response.json({ received: true, skipped: "sem payment.id" });
    }

    const status = payment.status;

    // Buscar cobrança no banco pelo asaasPaymentId
    const cobranças = await base44.asServiceRole.entities.Financeiro.filter({
      asaasPaymentId: payment.id
    });

    if (cobranças.length === 0) {
      console.log(`[asaasWebhook] Cobrança não encontrada para paymentId: ${payment.id}`);
      return Response.json({ received: true, skipped: "cobrança não encontrada" });
    }

    const boleto = cobranças[0];
    const updateData = { status };

    if (["CONFIRMED", "RECEIVED"].includes(status)) {
      updateData.dataPagamento = new Date().toISOString();
      updateData.acessoLiberado = true;

      // Distribuir comissões apenas uma vez
      if (!boleto.bonusLiberado) {
        updateData.bonusLiberado = true;

        // Marcar first_purchase_done no parceiro e ativar
        const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
        if (parceiros.length > 0) {
          const parceiro = parceiros[0];
          const pendingReasons = (parceiro.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
          const updatePartner = { first_purchase_done: true, pending_reasons: pendingReasons };
          // Se não tem mais pendências, ativar
          if (pendingReasons.length === 0) {
            updatePartner.status = "ativo";
          }
          await base44.asServiceRole.entities.Partner.update(boleto.userId, updatePartner);
          console.log(`[asaasWebhook] Parceiro ${parceiro.full_name} atualizado - first_purchase_done: true`);
        }

        // Distribuir comissões (15% direto, 30% indireto)
        try {
          const internalSecret = Deno.env.get("INTERNAL_SECRET");
          const comissoesRes = await fetch(`${req.url.replace('/asaasWebhook', '/distribuirComissoes')}`, {
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
          const comissoesData = await comissoesRes.json();
          console.log(`[asaasWebhook] Comissões distribuídas para compra ${boleto.id}:`, JSON.stringify(comissoesData));
        } catch (e) {
          console.error(`[asaasWebhook] Erro ao distribuir comissões: ${e.message}`);
        }

        // Processar compra pendente (ativa, distribui comissões, libera acesso)
        try {
          const internalSecret = Deno.env.get("INTERNAL_SECRET");
          await fetch(`${req.url.replace('/asaasWebhook', '/processPurchasePayment')}`, {
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
          console.log(`[asaasWebhook] processPurchasePayment acionado para partner ${boleto.userId}`);
        } catch (e) {
          console.error(`[asaasWebhook] Erro ao processar purchase: ${e.message}`);
        }

        // Enviar email de boas-vindas / ativação
        try {
          const parceirosEmail = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
          if (parceirosEmail.length > 0) {
            const p = parceirosEmail[0];
            // Buscar produto comprado para obter link de download
            let downloadLink = '';
            const purchases = await base44.asServiceRole.entities.Purchase.filter({ partner_id: boleto.userId, status: 'paid' });
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
            console.log(`[asaasWebhook] Email de ativação enviado para: ${p.email}`);
          }
        } catch (emailErr) {
          console.error(`[asaasWebhook] Erro ao enviar email de ativação: ${emailErr.message}`);
        }
      }

    } else if (status === "OVERDUE") {
      updateData.acessoLiberado = false;
    }

    await base44.asServiceRole.entities.Financeiro.update(boleto.id, updateData);
    console.log(`[asaasWebhook] Financeiro ${boleto.id} atualizado para status: ${status}`);

    return Response.json({ received: true, updated: true, status });

  } catch (error) {
    console.error("[asaasWebhook] Erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});