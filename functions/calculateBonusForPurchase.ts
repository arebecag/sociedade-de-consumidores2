import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { purchaseId } = await req.json();
    
    const purchase = await base44.asServiceRole.entities.Purchase.get(purchaseId);
    
    if (!purchase) {
      return Response.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const buyer = await base44.asServiceRole.entities.Partner.get(purchase.partner_id);
    
    if (!buyer) {
      return Response.json({ error: 'Buyer not found' }, { status: 404 });
    }

    // Buscar relações de rede onde o comprador é o indicado
    const relations = await base44.asServiceRole.entities.NetworkRelation.filter({
      referred_id: purchase.partner_id
    });

    const bonuses = [];
    const purchaseAmount = purchase.amount;

    // Graduação percentuais para indiretos
    const graduationPercentages = {
      cliente_iniciante: 30,
      lider: 32,
      estrela: 34,
      bronze: 36,
      prata: 38,
      ouro: 40
    };

    for (const relation of relations) {
      const referrer = await base44.asServiceRole.entities.Partner.get(relation.referrer_id);
      
      if (!referrer) continue;

      let totalPercent = 0;
      
      if (relation.relation_type === 'direct' && relation.level === 1) {
        // Direto: 15%
        totalPercent = 15;
      } else if (relation.relation_type === 'indirect' || relation.level === 2) {
        // Indireto: percentual por graduação
        totalPercent = graduationPercentages[referrer.graduation] || 30;
      }

      if (totalPercent === 0) continue;

      const totalAmount = (purchaseAmount * totalPercent) / 100;
      const amountForWithdrawal = totalAmount / 2;
      const amountForPurchases = totalAmount / 2;

      // Status: se referrer estiver pendente, bônus fica retido
      const bonusStatus = referrer.status === 'ativo' ? 'credited' : 'blocked';

      bonuses.push({
        partner_id: referrer.id,
        partner_name: referrer.full_name,
        source_partner_id: buyer.id,
        source_partner_name: buyer.full_name,
        purchase_id: purchaseId,
        type: relation.relation_type,
        percentage: totalPercent,
        total_amount: totalAmount,
        amount_for_withdrawal: amountForWithdrawal,
        amount_for_purchases: amountForPurchases,
        status: bonusStatus
      });
    }

    return Response.json({
      ok: true,
      purchaseId,
      bonuses
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});