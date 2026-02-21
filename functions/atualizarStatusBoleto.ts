import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BONUS_PERCENTUAL = 0.20;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    // Suporta chamada direta {paymentId, status} ou formato webhook Asaas {event, payment}
    const paymentId = body.paymentId || body.payment?.id;
    const status = body.status || body.payment?.status;

    if (!paymentId) return Response.json({ received: true, skipped: "sem paymentId" });

    // Buscar boleto pelo asaasPaymentId
    const boletos = await base44.asServiceRole.entities.Financeiro.filter({ asaasPaymentId: paymentId });
    if (!boletos.length) return Response.json({ received: true, skipped: "boleto não encontrado" });

    const boleto = boletos[0];
    const updateData = { status };

    if (["CONFIRMED", "RECEIVED"].includes(status)) {
      updateData.dataPagamento = new Date().toISOString();

      // Liberar bônus apenas uma vez
      if (!boleto.bonusLiberado) {
        updateData.bonusLiberado = true;
        const valorBonus = (boleto.valor || 0) * BONUS_PERCENTUAL;
        updateData.valorBonus = valorBonus;

        const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
        if (parceiros.length > 0) {
          const p = parceiros[0];
          await base44.asServiceRole.entities.Partner.update(boleto.userId, {
            bonus_for_withdrawal: (p.bonus_for_withdrawal || 0) + valorBonus * 0.5,
            bonus_for_purchases: (p.bonus_for_purchases || 0) + valorBonus * 0.5,
            total_bonus_generated: (p.total_bonus_generated || 0) + valorBonus,
            first_purchase_done: true
          });

          await base44.asServiceRole.entities.BonusTransaction.create({
            partner_id: boleto.userId,
            partner_name: boleto.userName,
            purchase_id: boleto.id,
            type: "direct",
            percentage: BONUS_PERCENTUAL * 100,
            total_amount: valorBonus,
            amount_for_withdrawal: valorBonus * 0.5,
            amount_for_purchases: valorBonus * 0.5,
            status: "credited"
          });
        }
      }
    }

    await base44.asServiceRole.entities.Financeiro.update(boleto.id, updateData);
    return Response.json({ received: true, updated: true, status, bonusLiberado: updateData.bonusLiberado || false });
  } catch (error) {
    console.error("atualizarStatusBoleto error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});