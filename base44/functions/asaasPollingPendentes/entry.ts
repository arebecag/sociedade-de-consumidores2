import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PROXY_URL = "https://arebecag-asaas-proxy.vercel.app";

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

      const resp = await fetch(`${PROXY_URL}/api/consultar-cobranca?id=${cobranca.asaasPaymentId}`);
      if (!resp.ok) continue;

      const data = await resp.json();
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

        if (!cobranca.bonusLiberado) {
          updateData.bonusLiberado = true;

          // Buscar parceiro via get() direto (evita scan completo)
          const parceiro = await base44.asServiceRole.entities.Partner.get(cobranca.userId);

          if (parceiro) {
            // Ativar parceiro
            const pendingReasons = (parceiro.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
            const updatePartner = { first_purchase_done: true, pending_reasons: pendingReasons };
            if (pendingReasons.length === 0) updatePartner.status = "ativo";
            await base44.asServiceRole.entities.Partner.update(cobranca.userId, updatePartner);
            console.log(`[polling] Parceiro ${parceiro.full_name} ativado`);

            // Processar compras pendentes: marcar como pagas e liberar download
            const purchases = await base44.asServiceRole.entities.Purchase.filter({
              partner_id: cobranca.userId,
              status: 'pending'
            });

            let downloadLink = '';

            for (const purchase of purchases) {
              await base44.asServiceRole.entities.Purchase.update(purchase.id, {
                status: 'paid',
                download_available: true
              });
              console.log(`[polling] Purchase ${purchase.id} liberada`);

              // Pegar link de download da mais recente
              if (!downloadLink && purchase.product_id) {
                const product = await base44.asServiceRole.entities.Product.get(purchase.product_id);
                if (product && product.download_url) {
                  downloadLink = product.download_url;
                }
              }

              // Distribuir comissões
              try {
                await base44.asServiceRole.functions.invoke('distribuirComissoes', {
                  purchaseId: purchase.id,
                  amount: purchase.amount,
                  buyerPartnerId: cobranca.userId
                });
                console.log(`[polling] Comissões distribuídas para purchase ${purchase.id}`);
              } catch (e) {
                console.error(`[polling] Erro distribuirComissoes: ${e.message}`);
              }
            }

            // Emitir nota fiscal
            try {
              await base44.asServiceRole.functions.invoke('blingEmitirNotaAutomatica', {
                payment_id: cobranca.asaasPaymentId
              });
              console.log(`[polling] Nota fiscal solicitada para ${cobranca.asaasPaymentId}`);
            } catch (e) {
              console.error(`[polling] Erro nota fiscal: ${e.message}`);
            }

            // Enviar email de ativação com link de download
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
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
                      Agora você pode aproveitar todos os benefícios da plataforma: receber bônus das compras de seus clientes, pagar seus boletos com bônus e muito mais.
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
              console.log(`[polling] Email de ativação enviado para: ${parceiro.email}`);
            } catch (emailErr) {
              console.error(`[polling] Erro ao enviar email: ${emailErr.message}`);
            }
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