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
          await base44.asServiceRole.functions.invoke('distribuirComissoes', {
            purchaseId: boleto.id,
            amount: boleto.valor,
            buyerPartnerId: boleto.userId
          });
          console.log(`[asaasWebhook] Comissões distribuídas para compra ${boleto.id}`);
        } catch (e) {
          console.error(`[asaasWebhook] Erro ao distribuir comissões: ${e.message}`);
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