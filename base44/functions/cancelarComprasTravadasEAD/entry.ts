import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limite = new Date(Date.now() - 30 * 60 * 1000); // 30 minutos atrás

    const comprasProcessando = await base44.asServiceRole.entities.ComprasCursosEAD.filter({
      status: 'PROCESSANDO'
    });

    const travadas = comprasProcessando.filter(c => new Date(c.created_date) < limite);

    let canceladas = 0;
    for (const compra of travadas) {
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compra.id, {
        status: 'ERRO',
        mensagemErro: 'Cancelado automaticamente por timeout (>30min em PROCESSANDO)'
      });

      // Estornar bônus ao parceiro
      if (compra.usuarioId && compra.valorBonus) {
        const partners = await base44.asServiceRole.entities.Partner.filter({ id: compra.usuarioId });
        if (partners.length > 0) {
          const p = partners[0];
          await base44.asServiceRole.entities.Partner.update(p.id, {
            bonus_for_purchases: (p.bonus_for_purchases || 0) + compra.valorBonus,
            total_spent_purchases: Math.max(0, (p.total_spent_purchases || 0) - compra.valorBonus)
          });
        }
      }

      canceladas++;
    }

    return Response.json({ success: true, canceladas, verificadas: comprasProcessando.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});