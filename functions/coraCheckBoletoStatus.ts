import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consulta status de um boleto na API Cora
 * Payload: { boleto_id: string, purchase_id: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boleto_id, purchase_id } = await req.json();

    if (!boleto_id || !purchase_id) {
      return Response.json({ 
        error: 'boleto_id and purchase_id are required' 
      }, { status: 400 });
    }

    // Obter token Cora
    const authRes = await base44.functions.invoke('coraAuth', {});
    if (!authRes.data.access_token) {
      return Response.json({ error: 'Failed to authenticate with Cora' }, { status: 500 });
    }

    const token = authRes.data.access_token;
    const apiUrl = Deno.env.get("CORA_API_URL") || "https://api.cora.com.br";

    // Consultar status do boleto
    const statusResponse = await fetch(`${apiUrl}/boletos/${boleto_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Cora boleto status check failed:", errorText);
      return Response.json({ 
        error: 'Failed to check boleto status',
        details: errorText
      }, { status: statusResponse.status });
    }

    const boletoData = await statusResponse.json();

    // Se boleto foi pago, atualizar Purchase
    if (boletoData.status === 'PAID' || boletoData.status === 'SETTLED') {
      const purchases = await base44.asServiceRole.entities.Purchase.filter({ id: purchase_id });
      
      if (purchases.length > 0) {
        const purchase = purchases[0];
        
        // Verificar se já foi processado (idempotência)
        if (purchase.status !== 'paid') {
          // Atualizar Purchase
          await base44.asServiceRole.entities.Purchase.update(purchase_id, {
            status: 'paid',
            paid_date: new Date().toISOString(),
            download_available: true
          });

          // Buscar Partner
          const partners = await base44.asServiceRole.entities.Partner.filter({ 
            id: purchase.partner_id 
          });

          if (partners.length > 0) {
            const partner = partners[0];

            // Gerar bônus para indicadores
            await generateBonusForPurchase(
              base44, 
              purchase_id, 
              purchase.amount, 
              partner
            );

            // Verificar primeira compra
            if (purchase.is_first_purchase && !partner.first_purchase_done) {
              const updates = {
                first_purchase_done: true,
                pending_reasons: (partner.pending_reasons || [])
                  .filter(r => r !== "Falta da primeira compra")
              };

              // Se não há mais pendências, ativar conta
              if (updates.pending_reasons.length === 0) {
                updates.status = "ativo";
              }

              await base44.asServiceRole.entities.Partner.update(partner.id, updates);
            }
          }
        }
      }
    }

    return Response.json({
      success: true,
      boleto: {
        id: boletoData.id,
        status: boletoData.status,
        paid_at: boletoData.paid_at,
        amount: boletoData.amount / 100
      }
    });
  } catch (error) {
    console.error("Error in coraCheckBoletoStatus:", error.message);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});

/**
 * Gera bônus para indicadores (com idempotência)
 */
async function generateBonusForPurchase(base44, purchaseId, amount, buyer) {
  try {
    if (!buyer.referrer_id) return;

    const partners = await base44.asServiceRole.entities.Partner.list();
    const directReferrer = partners.find(p => p.id === buyer.referrer_id);

    if (!directReferrer) return;

    // Verificar se bônus já existe (idempotência)
    const existingBonus = await base44.asServiceRole.entities.BonusTransaction.filter({
      purchase_id: purchaseId,
      partner_id: directReferrer.id
    });

    if (existingBonus.length > 0) {
      console.log("Bonus already generated for purchase:", purchaseId);
      return;
    }

    // Bônus direto (15%)
    const directBonus = amount * 0.15;
    const directBonusWithdrawal = directBonus * 0.5;
    const directBonusPurchases = directBonus * 0.5;

    await base44.asServiceRole.entities.BonusTransaction.create({
      partner_id: directReferrer.id,
      partner_name: directReferrer.full_name,
      source_partner_id: buyer.id,
      source_partner_name: buyer.full_name,
      purchase_id: purchaseId,
      type: "direct",
      percentage: 15,
      total_amount: directBonus,
      amount_for_withdrawal: directBonusWithdrawal,
      amount_for_purchases: directBonusPurchases,
      status: directReferrer.status === "ativo" ? "credited" : "blocked"
    });

    if (directReferrer.status === "ativo") {
      await base44.asServiceRole.entities.Partner.update(directReferrer.id, {
        total_bonus_generated: (directReferrer.total_bonus_generated || 0) + directBonus,
        bonus_for_withdrawal: (directReferrer.bonus_for_withdrawal || 0) + directBonusWithdrawal,
        bonus_for_purchases: (directReferrer.bonus_for_purchases || 0) + directBonusPurchases
      });
    }

    // Bônus indireto (30%)
    if (directReferrer.referrer_id) {
      const indirectReferrer = partners.find(p => p.id === directReferrer.referrer_id);
      
      if (indirectReferrer) {
        const existingIndirectBonus = await base44.asServiceRole.entities.BonusTransaction.filter({
          purchase_id: purchaseId,
          partner_id: indirectReferrer.id
        });

        if (existingIndirectBonus.length === 0) {
          const indirectBonus = amount * 0.30;
          const indirectBonusWithdrawal = indirectBonus * 0.5;
          const indirectBonusPurchases = indirectBonus * 0.5;

          await base44.asServiceRole.entities.BonusTransaction.create({
            partner_id: indirectReferrer.id,
            partner_name: indirectReferrer.full_name,
            source_partner_id: buyer.id,
            source_partner_name: buyer.full_name,
            purchase_id: purchaseId,
            type: "indirect",
            percentage: 30,
            total_amount: indirectBonus,
            amount_for_withdrawal: indirectBonusWithdrawal,
            amount_for_purchases: indirectBonusPurchases,
            status: indirectReferrer.status === "ativo" ? "credited" : "blocked"
          });

          if (indirectReferrer.status === "ativo") {
            await base44.asServiceRole.entities.Partner.update(indirectReferrer.id, {
              total_bonus_generated: (indirectReferrer.total_bonus_generated || 0) + indirectBonus,
              bonus_for_withdrawal: (indirectReferrer.bonus_for_withdrawal || 0) + indirectBonusWithdrawal,
              bonus_for_purchases: (indirectReferrer.bonus_for_purchases || 0) + indirectBonusPurchases
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error generating bonus:", error.message);
  }
}