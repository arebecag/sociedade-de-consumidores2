import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Proteção: só aceita chamadas internas via INTERNAL_SECRET
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const receivedSecret = req.headers.get("x-internal-secret");
    if (internalSecret && receivedSecret !== internalSecret) {
      console.warn("atualizarStatusBoleto: acesso não autorizado bloqueado");
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const paymentId = body.paymentId || body.payment?.id;
    const status = body.status || body.payment?.status;

    if (!paymentId) return Response.json({ received: true, skipped: "sem paymentId" });

    const boletos = await base44.asServiceRole.entities.Financeiro.filter({ asaasPaymentId: paymentId });
    if (!boletos.length) return Response.json({ received: true, skipped: "boleto não encontrado" });

    const boleto = boletos[0];
    const updateData = { status };

    if (["CONFIRMED", "RECEIVED"].includes(status)) {
      updateData.dataPagamento = new Date().toISOString();
      updateData.acessoLiberado = true;

      // Distribuir comissões para uplines apenas uma vez
      if (!boleto.bonusLiberado) {
        updateData.bonusLiberado = true;

        // Marcar first_purchase_done no parceiro
        const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
        if (parceiros.length > 0 && !parceiros[0].first_purchase_done) {
          await base44.asServiceRole.entities.Partner.update(boleto.userId, {
            first_purchase_done: true,
            pending_reasons: (parceiros[0].pending_reasons || []).filter(r => r !== "Falta da primeira compra")
          });
        }

        // Distribuir comissões (15% direto, 30% indireto) para os uplines
        await base44.asServiceRole.functions.invoke('distribuirComissoes', {
          purchaseId: boleto.id,
          amount: boleto.valor,
          buyerPartnerId: boleto.userId
        });
      }

    } else if (status === "OVERDUE") {
      updateData.acessoLiberado = false;
    }

    await base44.asServiceRole.entities.Financeiro.update(boleto.id, updateData);
    return Response.json({ received: true, updated: true, status, bonusLiberado: updateData.bonusLiberado || false });
  } catch (error) {
    console.error("atualizarStatusBoleto error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});