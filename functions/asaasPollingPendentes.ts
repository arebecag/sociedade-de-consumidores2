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

      // Atualizar URLs se disponíveis
      if (data.invoiceUrl || data.bankSlipUrl) {
        await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
          invoiceUrl: data.invoiceUrl || cobranca.invoiceUrl,
          bankSlipUrl: data.bankSlipUrl || cobranca.bankSlipUrl
        });
      }

      // Delegar atualização de status e bônus para atualizarStatusBoleto com secret interno
      const internalSecret = Deno.env.get("INTERNAL_SECRET");
      const appId = Deno.env.get("BASE44_APP_ID");
      const fnUrl = `https://appfunctions.base44.com/api/apps/${appId}/functions/atualizarStatusBoleto`;
      await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret || ""
        },
        body: JSON.stringify({ paymentId: cobranca.asaasPaymentId, status: novoStatus })
      });

      if (["CONFIRMED", "RECEIVED"].includes(novoStatus)) confirmadas++;
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