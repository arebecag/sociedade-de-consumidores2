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

    // Processar apenas eventos de pagamento confirmado
    const eventosConfirmados = [
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_UPDATED"
    ];

    const statusConfirmados = ["CONFIRMED", "RECEIVED"];

    if (eventosConfirmados.includes(event) || statusConfirmados.includes(payment.status)) {
      // Evitar duplicidade
      if (cobranca.bonusLiberado) {
        return Response.json({ received: true, skipped: "bônus já liberado" });
      }

      // Atualizar cobrança
      await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
        status: payment.status || "CONFIRMED",
        dataPagamento: new Date().toISOString(),
        bonusLiberado: true
      });

      // Liberar bônus para o parceiro
      const valorBonus = (cobranca.valor || 0) * BONUS_PERCENTUAL;

      const parceiros = await base44.asServiceRole.entities.Partner.filter({
        id: cobranca.userId
      });

      if (parceiros.length > 0) {
        const parceiro = parceiros[0];

        await base44.asServiceRole.entities.Partner.update(cobranca.userId, {
          bonus_for_withdrawal: (parceiro.bonus_for_withdrawal || 0) + valorBonus * 0.5,
          bonus_for_purchases: (parceiro.bonus_for_purchases || 0) + valorBonus * 0.5,
          total_bonus_generated: (parceiro.total_bonus_generated || 0) + valorBonus,
          first_purchase_done: true
        });

        // Registrar transação de bônus
        await base44.asServiceRole.entities.BonusTransaction.create({
          partner_id: cobranca.userId,
          partner_name: cobranca.userName,
          purchase_id: cobranca.id,
          type: "direct",
          percentage: BONUS_PERCENTUAL * 100,
          total_amount: valorBonus,
          amount_for_withdrawal: valorBonus * 0.5,
          amount_for_purchases: valorBonus * 0.5,
          status: "credited"
        });

        // Atualizar valor do bônus na cobrança
        await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
          valorBonus
        });
      }

      return Response.json({ received: true, processed: true, bonusLiberado: valorBonus });
    }

    // Outros status (OVERDUE, CANCELLED etc) — apenas atualiza
    await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
      status: payment.status || cobranca.status
    });

    return Response.json({ received: true, statusAtualizado: payment.status });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});