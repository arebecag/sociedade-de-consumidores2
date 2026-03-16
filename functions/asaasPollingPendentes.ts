import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PROXY_URL = "https://arebecag-asaas-proxy.vercel.app";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Pode ser chamado por automação agendada (sem user auth)
    // Usar service role
    const cobranças = await base44.asServiceRole.entities.Financeiro.filter({
      status: "PENDING"
    });

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

      // Preparar atualização
      const updateData = { 
        status: novoStatus,
        invoiceUrl: data.invoiceUrl || cobranca.invoiceUrl,
        bankSlipUrl: data.bankSlipUrl || cobranca.bankSlipUrl
      };

      // Se confirmado/recebido, processar ativação e comissões
      if (["CONFIRMED", "RECEIVED"].includes(novoStatus)) {
        confirmadas++;
        updateData.dataPagamento = new Date().toISOString();
        updateData.acessoLiberado = true;

        // Distribuir comissões apenas uma vez
        if (!cobranca.bonusLiberado) {
          updateData.bonusLiberado = true;

          // Marcar first_purchase_done no parceiro e ativar
          const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: cobranca.userId });
          if (parceiros.length > 0) {
            const parceiro = parceiros[0];
            const pendingReasons = (parceiro.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
            const updatePartner = { first_purchase_done: true, pending_reasons: pendingReasons };
            if (pendingReasons.length === 0) {
              updatePartner.status = "ativo";
            }
            await base44.asServiceRole.entities.Partner.update(cobranca.userId, updatePartner);
          }

          // Distribuir comissões
          try {
            const internalSecret = Deno.env.get("INTERNAL_SECRET");
            await fetch(`https://appfunctions.base44.com/api/apps/${Deno.env.get("BASE44_APP_ID")}/functions/distribuirComissoes`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': internalSecret || ''
              },
              body: JSON.stringify({
                purchaseId: cobranca.id,
                amount: cobranca.valor,
                buyerPartnerId: cobranca.userId
              })
            });
          } catch (e) {
            console.error(`Erro ao distribuir comissões: ${e.message}`);
          }

          // Processar compra pendente
          try {
            const internalSecret = Deno.env.get("INTERNAL_SECRET");
            await fetch(`https://appfunctions.base44.com/api/apps/${Deno.env.get("BASE44_APP_ID")}/functions/processPurchasePayment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': internalSecret || ''
              },
              body: JSON.stringify({
                financeiroId: cobranca.id,
                partnerId: cobranca.userId
              })
            });
          } catch (e) {
            console.error(`Erro ao processar purchase: ${e.message}`);
          }

          // Emitir nota fiscal
          try {
            const internalSecret = Deno.env.get("INTERNAL_SECRET");
            await fetch(`https://appfunctions.base44.com/api/apps/${Deno.env.get("BASE44_APP_ID")}/functions/blingEmitirNotaAutomatica`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': internalSecret || ''
              },
              body: JSON.stringify({ payment_id: cobranca.asaasPaymentId })
            });
          } catch (e) {
            console.error(`Erro ao emitir nota: ${e.message}`);
          }
        }
      } else if (novoStatus === "OVERDUE") {
        updateData.acessoLiberado = false;
      }

      // Atualizar cobrança
      await base44.asServiceRole.entities.Financeiro.update(cobranca.id, updateData);
    }

    return Response.json({
      ok: true,
      verificadas: cobranças.length,
      confirmadas
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});