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

      // Atualizar status da cobrança
      await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
        status: novoStatus,
        invoiceUrl: data.invoiceUrl || cobranca.invoiceUrl,
        bankSlipUrl: data.bankSlipUrl || cobranca.bankSlipUrl
      });

      // Se confirmado/recebido, processar ativação
      if (["CONFIRMED", "RECEIVED"].includes(novoStatus)) {
        confirmadas++;
        
        // Buscar parceiro
        const parceiros = await base44.asServiceRole.entities.Partner.filter({ email: cobranca.userEmail });
        if (parceiros.length > 0) {
          const partner = parceiros[0];

          // Se primeira compra, ativar
          if (!partner.first_purchase_done) {
            await base44.asServiceRole.entities.Partner.update(partner.id, {
              status: "ativo",
              first_purchase_done: true,
              pending_reasons: []
            });
          }
        }
      }
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