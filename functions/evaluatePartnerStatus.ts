import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId } = await req.json();
    
    if (!partnerId) {
      return Response.json({ error: 'partnerId required' }, { status: 400 });
    }

    const [partner] = await base44.asServiceRole.entities.Partner.filter({ id: partnerId });
    if (!partner) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const reasons = [];
    const now = new Date();
    const dayOfMonth = now.getDate();

    // a) Falta primeira compra (min R$125)
    if (!partner.first_purchase_done) {
      reasons.push('Primeira compra obrigatória pendente (mínimo R$125)');
    }

    // b) Compra mensal atrasada (até dia 10, consumir até 90% do saldo de bônus)
    if (partner.first_purchase_done && dayOfMonth > 10) {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      
      const purchases = await base44.asServiceRole.entities.Purchase.filter({
        partner_id: partnerId,
        status: 'paid'
      });
      
      const monthlyPurchases = purchases.filter(p => {
        const pDate = new Date(p.created_date);
        return pDate >= firstDayOfMonth;
      });
      
      const totalSpentThisMonth = monthlyPurchases.reduce((sum, p) => sum + (p.paid_with_bonus || 0), 0);
      const requiredSpending = partner.bonus_for_purchases * 0.9;
      
      if (totalSpentThisMonth < requiredSpending) {
        reasons.push(`Consumo mensal obrigatório pendente (deve usar 90% do bônus até dia 10)`);
      }
    }

    // c) Falta informações no cadastro
    const requiredFields = ['full_name', 'cpf', 'phone', 'birth_date', 'pix_key'];
    const missingFields = requiredFields.filter(field => !partner[field]);
    
    if (missingFields.length > 0) {
      reasons.push(`Cadastro incompleto: faltam ${missingFields.join(', ')}`);
    }

    // d) Falta autorização menor (se nasceu há menos de 18 anos)
    const birthDate = new Date(partner.birth_date);
    const age = Math.floor((now - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 18 && !partner.successor?.full_name) {
      reasons.push('Necessário autorização de responsável (menor de idade)');
    }

    // Determinar status
    let newStatus = 'ativo';
    if (partner.status === 'excluido') {
      newStatus = 'excluido';
    } else if (reasons.length > 0) {
      newStatus = 'pendente';
    }

    return Response.json({
      ok: true,
      partnerId,
      currentStatus: partner.status,
      evaluatedStatus: newStatus,
      reasons,
      shouldUpdate: partner.status !== newStatus || JSON.stringify(partner.pending_reasons || []) !== JSON.stringify(reasons)
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});