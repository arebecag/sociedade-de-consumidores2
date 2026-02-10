import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bonuses } = await req.json();
    
    if (!Array.isArray(bonuses) || bonuses.length === 0) {
      return Response.json({ error: 'bonuses array required' }, { status: 400 });
    }

    const results = [];

    for (const bonus of bonuses) {
      // Criar transação de bônus
      const transaction = await base44.asServiceRole.entities.BonusTransaction.create(bonus);

      // Atualizar saldos do parceiro se status for credited
      if (bonus.status === 'credited') {
        const partner = await base44.asServiceRole.entities.Partner.get(bonus.partner_id);
        
        await base44.asServiceRole.entities.Partner.update(bonus.partner_id, {
          total_bonus_generated: (partner.total_bonus_generated || 0) + bonus.total_amount,
          bonus_for_withdrawal: (partner.bonus_for_withdrawal || 0) + bonus.amount_for_withdrawal,
          bonus_for_purchases: (partner.bonus_for_purchases || 0) + bonus.amount_for_purchases
        });
      }

      results.push({
        transactionId: transaction.id,
        partnerId: bonus.partner_id,
        amount: bonus.total_amount,
        status: bonus.status
      });
    }

    return Response.json({
      ok: true,
      recorded: results.length,
      results
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});