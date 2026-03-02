import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// REGRA DE COMISSÕES:
// Direto (nível 1): 15% do valor da compra/troca
//   → 100% vai para saque (bonus_for_withdrawal)
//   → +50% reservado para trocas (bonus_for_purchases)
// Indireto (nível 2): 30% do valor da compra/troca
//   → 100% vai para saque (bonus_for_withdrawal)
//   → +50% reservado para trocas (bonus_for_purchases)
// Eder NÃO recebe de Mateus (neto do neto — fora do escopo de 2 níveis)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { purchaseId, amount, buyerPartnerId } = await req.json();
    if (!purchaseId || !amount || !buyerPartnerId) {
      return Response.json({ error: 'purchaseId, amount e buyerPartnerId são obrigatórios' }, { status: 400 });
    }

    const resultados = [];

    // ── DIRETO: quem indicou o comprador (nível 1) ──
    const directRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
      referred_id: buyerPartnerId,
      relation_type: 'direct'
    });

    for (const rel of directRelations) {
      const referrers = await base44.asServiceRole.entities.Partner.filter({ id: rel.referrer_id });
      if (!referrers.length) continue;
      const referrer = referrers[0];

      // Verificar se já existe para evitar duplicidade
      const existing = await base44.asServiceRole.entities.BonusTransaction.filter({
        purchase_id: purchaseId,
        partner_id: referrer.id
      });
      if (existing.length > 0) {
        resultados.push({ parceiro: referrer.full_name, tipo: 'direct', status: 'já_existia' });
        continue;
      }

      const comissao = amount * 0.15; // 15% para direto
      const paraTrocas = comissao * 0.5; // +50% reservado para trocas

      const bonusStatus = referrer.status === 'ativo' ? 'credited' : 'blocked';

      await base44.asServiceRole.entities.BonusTransaction.create({
        partner_id: referrer.id,
        partner_name: referrer.full_name,
        source_partner_id: buyerPartnerId,
        purchase_id: purchaseId,
        type: 'direct',
        percentage: 15,
        total_amount: comissao,
        amount_for_withdrawal: comissao,
        amount_for_purchases: paraTrocas,
        status: bonusStatus
      });

      if (bonusStatus === 'credited') {
        await base44.asServiceRole.entities.Partner.update(referrer.id, {
          total_bonus_generated: (referrer.total_bonus_generated || 0) + comissao + paraTrocas,
          bonus_for_withdrawal: (referrer.bonus_for_withdrawal || 0) + comissao,
          bonus_for_purchases: (referrer.bonus_for_purchases || 0) + paraTrocas
        });
      }

      resultados.push({ parceiro: referrer.full_name, tipo: 'direct', comissao, paraTrocas, status: bonusStatus });
    }

    // ── INDIRETO: quem indicou o pai do comprador (nível 2) ──
    const indirectRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
      referred_id: buyerPartnerId,
      relation_type: 'indirect'
    });

    for (const rel of indirectRelations) {
      const referrers = await base44.asServiceRole.entities.Partner.filter({ id: rel.referrer_id });
      if (!referrers.length) continue;
      const referrer = referrers[0];

      const existing = await base44.asServiceRole.entities.BonusTransaction.filter({
        purchase_id: purchaseId,
        partner_id: referrer.id
      });
      if (existing.length > 0) {
        resultados.push({ parceiro: referrer.full_name, tipo: 'indirect', status: 'já_existia' });
        continue;
      }

      const comissao = amount * 0.30; // 30% para indireto
      const paraTrocas = comissao * 0.5; // +50% reservado para trocas

      const bonusStatus = referrer.status === 'ativo' ? 'credited' : 'blocked';

      await base44.asServiceRole.entities.BonusTransaction.create({
        partner_id: referrer.id,
        partner_name: referrer.full_name,
        source_partner_id: buyerPartnerId,
        purchase_id: purchaseId,
        type: 'indirect',
        percentage: 30,
        total_amount: comissao,
        amount_for_withdrawal: comissao,
        amount_for_purchases: paraTrocas,
        status: bonusStatus
      });

      if (bonusStatus === 'credited') {
        await base44.asServiceRole.entities.Partner.update(referrer.id, {
          total_bonus_generated: (referrer.total_bonus_generated || 0) + comissao + paraTrocas,
          bonus_for_withdrawal: (referrer.bonus_for_withdrawal || 0) + comissao,
          bonus_for_purchases: (referrer.bonus_for_purchases || 0) + paraTrocas
        });
      }

      resultados.push({ parceiro: referrer.full_name, tipo: 'indirect', comissao, paraTrocas, status: bonusStatus });
    }

    return Response.json({ ok: true, purchaseId, resultados });

  } catch (error) {
    console.error('distribuirComissoes error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});