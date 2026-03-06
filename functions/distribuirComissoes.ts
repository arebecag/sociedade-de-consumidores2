import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Distribui comissões para os uplines após uma troca/compra.
 * 
 * Regras:
 * - Direto (nível 1): 15% → 100% vai para saque (comissão) + 50% vai para bônus/trocas
 * - Indireto (nível 2): 30% → 100% vai para saque (comissão) + 50% vai para bônus/trocas
 * - Eder não recebe nada do neto (só do filho direto e do neto via indireto = 2 níveis)
 * 
 * Exemplo: valor = R$125
 *   Pai direto recebe: R$18,75 saque + R$9,375 bônus
 *   Avô indireto recebe: R$37,50 saque + R$18,75 bônus
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validar secret interno para chamadas via webhook/automation
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const receivedSecret = req.headers.get("x-internal-secret");
    const isInternalCall = internalSecret && receivedSecret === internalSecret;

    // Aceita chamadas internas (via INTERNAL_SECRET) ou usuários autenticados
    if (!isInternalCall) {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        return Response.json({ error: 'Não autorizado' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { purchaseId, buyerPartnerId, amount } = body;
    if (!purchaseId || !buyerPartnerId || !amount) {
      return Response.json({ error: 'purchaseId, buyerPartnerId e amount são obrigatórios' }, { status: 400 });
    }

    const results = [];

    // ── 1. BUSCAR PAI DIRETO (nível 1 = 15%) ──
    const directRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
      referred_id: buyerPartnerId,
      relation_type: 'direct'
    });

    if (directRelations.length > 0) {
      const directRel = directRelations[0];
      const directPartners = await base44.asServiceRole.entities.Partner.filter({ id: directRel.referrer_id });
      if (directPartners.length > 0) {
        const pai = directPartners[0];

        // Verificar se já creditou para este parceiro nesta compra
        const existing = await base44.asServiceRole.entities.BonusTransaction.filter({
          purchase_id: purchaseId,
          partner_id: pai.id
        });

        if (existing.length === 0) {
          const comissao = amount * 0.15;    // 15% = comissão para saque
          const bonus = comissao * 0.50;     // 50% da comissão = bônus para trocas
          const status = pai.status === 'ativo' ? 'credited' : 'blocked';

          await base44.asServiceRole.entities.BonusTransaction.create({
            partner_id: pai.id,
            partner_name: pai.full_name,
            source_partner_id: buyerPartnerId,
            source_partner_name: directRel.referred_name,
            purchase_id: purchaseId,
            type: 'direct',
            percentage: 15,
            total_amount: comissao + bonus,
            amount_for_withdrawal: comissao,
            amount_for_purchases: bonus,
            status
          });

          if (status === 'credited') {
            await base44.asServiceRole.entities.Partner.update(pai.id, {
              total_bonus_generated: (pai.total_bonus_generated || 0) + comissao + bonus,
              bonus_for_withdrawal: (pai.bonus_for_withdrawal || 0) + comissao,
              bonus_for_purchases: (pai.bonus_for_purchases || 0) + bonus
            });
          }

          results.push({ type: 'direct', partner: pai.full_name, comissao, bonus, status });
        }
      }
    }

    // ── 2. BUSCAR AVÔ INDIRETO (nível 2 = 30%) ──
    const indirectRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
      referred_id: buyerPartnerId,
      relation_type: 'indirect'
    });

    if (indirectRelations.length > 0) {
      const indirectRel = indirectRelations[0];
      const indirectPartners = await base44.asServiceRole.entities.Partner.filter({ id: indirectRel.referrer_id });
      if (indirectPartners.length > 0) {
        const avo = indirectPartners[0];

        const existing = await base44.asServiceRole.entities.BonusTransaction.filter({
          purchase_id: purchaseId,
          partner_id: avo.id
        });

        if (existing.length === 0) {
          const comissao = amount * 0.30;    // 30% = comissão para saque
          const bonus = comissao * 0.50;     // 50% da comissão = bônus para trocas
          const status = avo.status === 'ativo' ? 'credited' : 'blocked';

          await base44.asServiceRole.entities.BonusTransaction.create({
            partner_id: avo.id,
            partner_name: avo.full_name,
            source_partner_id: buyerPartnerId,
            source_partner_name: indirectRel.referred_name,
            purchase_id: purchaseId,
            type: 'indirect',
            percentage: 30,
            total_amount: comissao + bonus,
            amount_for_withdrawal: comissao,
            amount_for_purchases: bonus,
            status
          });

          if (status === 'credited') {
            await base44.asServiceRole.entities.Partner.update(avo.id, {
              total_bonus_generated: (avo.total_bonus_generated || 0) + comissao + bonus,
              bonus_for_withdrawal: (avo.bonus_for_withdrawal || 0) + comissao,
              bonus_for_purchases: (avo.bonus_for_purchases || 0) + bonus
            });
          }

          results.push({ type: 'indirect', partner: avo.full_name, comissao, bonus, status });
        }
      }
    }

    return Response.json({ ok: true, purchaseId, distribuicoes: results });

  } catch (error) {
    console.error('distribuirComissoes error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});