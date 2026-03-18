import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar todos os Partners ativos (não excluídos)
    const allPartners = await base44.asServiceRole.entities.Partner.list();
    const validIds = new Set(allPartners.map(p => p.id));

    // Buscar todas as relações
    const allRelations = await base44.asServiceRole.entities.NetworkRelation.list();

    const orphans = allRelations.filter(rel =>
      !validIds.has(rel.referred_id) || !validIds.has(rel.referrer_id)
    );

    console.log(`[limparRelacoesOrfas] Total relações: ${allRelations.length}, Órfãs: ${orphans.length}`);

    const deleted = [];
    for (const rel of orphans) {
      await base44.asServiceRole.entities.NetworkRelation.delete(rel.id);
      deleted.push({
        id: rel.id,
        referrer: rel.referrer_name,
        referred: rel.referred_name,
        type: rel.relation_type
      });
      console.log(`[limparRelacoesOrfas] Deletada: ${rel.referrer_name} → ${rel.referred_name}`);
    }

    return Response.json({
      success: true,
      totalRelacoes: allRelations.length,
      totalOrfas: orphans.length,
      deletadas: deleted
    });
  } catch (error) {
    console.error('[limparRelacoesOrfas] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});