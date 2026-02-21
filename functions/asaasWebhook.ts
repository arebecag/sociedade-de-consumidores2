import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BONUS_PERCENTUAL = 0.20; // 20% de bônus no pagamento

Deno.serve(async (req) => {
  try {
    // Validar token do webhook Asaas
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");
    if (webhookToken && receivedToken !== webhookToken) {
      console.warn("asaasWebhook: token inválido recebido:", receivedToken);
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { event, payment } = body;

    if (!payment?.id) {
      return Response.json({ received: true, skipped: "sem payment.id" });
    }

    // Buscar cobrança no banco pelo asaasPaymentId
    const cobranças = await base44.asServiceRole.entities.Financeiro.filter({
      asaasPaymentId: payment.id
    });

    if (cobranças.length === 0) {
      return Response.json({ received: true, skipped: "cobrança não encontrada" });
    }

    const cobranca = cobranças[0];

    // Delegar para atualizarStatusBoleto via fetch com secret interno
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const appId = Deno.env.get("BASE44_APP_ID");
    const fnUrl = `https://appfunctions.base44.com/api/apps/${appId}/functions/atualizarStatusBoleto`;

    const fnResp = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret || ""
      },
      body: JSON.stringify({ paymentId: payment.id, status: payment.status })
    });

    const result = await fnResp.json();
    return Response.json({ received: true, processed: true, result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});