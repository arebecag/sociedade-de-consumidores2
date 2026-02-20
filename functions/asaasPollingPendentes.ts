import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PROXY_URL = "https://arebecag-asaas-proxy.vercel.app";
const BONUS_PERCENTUAL = 0.20;

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

      // Atualizar status
      await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
        status: novoStatus,
        invoiceUrl: data.invoiceUrl || cobranca.invoiceUrl,
        bankSlipUrl: data.bankSlipUrl || cobranca.bankSlipUrl
      });

      // Se confirmado e bônus ainda não liberado
      if (["CONFIRMED", "RECEIVED"].includes(novoStatus) && !cobranca.bonusLiberado) {
        await base44.asServiceRole.entities.Financeiro.update(cobranca.id, {
          dataPagamento: new Date().toISOString(),
          bonusLiberado: true
        });

        const valorBonus = (cobranca.valor || 0) * BONUS_PERCENTUAL;

        const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: cobranca.userId });
        if (parceiros.length > 0) {
          const parceiro = parceiros[0];
          await base44.asServiceRole.entities.Partner.update(cobranca.userId, {
            bonus_for_withdrawal: (parceiro.bonus_for_withdrawal || 0) + valorBonus * 0.5,
            bonus_for_purchases: (parceiro.bonus_for_purchases || 0) + valorBonus * 0.5,
            total_bonus_generated: (parceiro.total_bonus_generated || 0) + valorBonus,
            first_purchase_done: true
          });

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

          await base44.asServiceRole.entities.Financeiro.update(cobranca.id, { valorBonus });
        }

        confirmadas++;
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