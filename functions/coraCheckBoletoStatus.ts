import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consulta status de um boleto na API Cora e processa pagamento
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
 * Regras oficiais:
 * - Diretos (não derramados): 15% (7,5% compras + 7,5% saque)
 * - Derramados (spillover): 30-40% conforme graduação (split 50/50)
 */
async function generateBonusForPurchase(base44, purchaseId, amount, buyer) {
  try {
    if (!buyer.referrer_id) return;

    const partners = await base44.asServiceRole.entities.Partner.list();
    const referrer = partners.find(p => p.id === buyer.referrer_id);

    if (!referrer) return;

    // Buscar relação para verificar se é spillover
    const relations = await base44.asServiceRole.entities.NetworkRelation.filter({
      referrer_id: buyer.referrer_id,
      referred_id: buyer.id
    });

    const isSpillover = relations.length > 0 && relations[0].is_spillover === true;

    // Verificar se bônus já existe (idempotência)
    const existingBonus = await base44.asServiceRole.entities.BonusTransaction.filter({
      purchase_id: purchaseId,
      partner_id: referrer.id
    });

    if (existingBonus.length > 0) {
      console.log("Bonus already generated for purchase:", purchaseId);
      return;
    }

    // Calcular percentual baseado no tipo de relação e graduação
    let bonusPercentage;
    let bonusType;

    if (isSpillover) {
      // Derramado: 30-40% conforme graduação do indicador
      bonusType = "indirect";
      const graduation = referrer.graduation || "cliente_iniciante";
      
      const graduationBonus = {
        "cliente_iniciante": 30,
        "lider": 32,
        "estrela": 34,
        "bronze": 36,
        "prata": 38,
        "ouro": 40
      };
      
      bonusPercentage = graduationBonus[graduation] || 30;
    } else {
      // Direto (via link): sempre 15%
      bonusType = "direct";
      bonusPercentage = 15;
    }

    const totalBonus = amount * (bonusPercentage / 100);
    const bonusWithdrawal = totalBonus * 0.5;
    const bonusPurchases = totalBonus * 0.5;

    console.log(`Generating bonus: ${bonusPercentage}% (${bonusType}) for purchase ${purchaseId}`);

    await base44.asServiceRole.entities.BonusTransaction.create({
      partner_id: referrer.id,
      partner_name: referrer.full_name,
      source_partner_id: buyer.id,
      source_partner_name: buyer.full_name,
      purchase_id: purchaseId,
      type: bonusType,
      percentage: bonusPercentage,
      total_amount: totalBonus,
      amount_for_withdrawal: bonusWithdrawal,
      amount_for_purchases: bonusPurchases,
      status: referrer.status === "ativo" ? "credited" : "blocked"
    });

    // Atualizar saldo apenas se parceiro estiver ativo
    if (referrer.status === "ativo") {
      await base44.asServiceRole.entities.Partner.update(referrer.id, {
        total_bonus_generated: (referrer.total_bonus_generated || 0) + totalBonus,
        bonus_for_withdrawal: (referrer.bonus_for_withdrawal || 0) + bonusWithdrawal,
        bonus_for_purchases: (referrer.bonus_for_purchases || 0) + bonusPurchases
      });
    }
  } catch (error) {
    console.error("Error generating bonus:", error.message);
  }
}