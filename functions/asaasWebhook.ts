import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BONUS_PERCENTUAL = 0.20; // 20% de bônus no pagamento

Deno.serve(async (req) => {
  try {
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

    // Delegar para atualizarStatusBoleto (centraliza lógica de bônus + recorrência + acesso)
    const result = await base44.asServiceRole.functions.invoke("atualizarStatusBoleto", {
      paymentId: payment.id,
      status: payment.status
    });

    return Response.json({ received: true, processed: true, result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});