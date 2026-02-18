import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GLOBALEAD_API = "https://ead-integration.vercel.app/api/globalEad";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar assinaturas da GlobalEAD
    const res = await fetch(GLOBALEAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "findAssinaturas", payload: {} })
    });

    if (!res.ok) {
      return Response.json({ error: 'Erro ao buscar assinaturas da GlobalEAD' }, { status: 500 });
    }

    const data = await res.json();

    // A API pode retornar array direto ou dentro de uma propriedade
    const assinaturas = Array.isArray(data) ? data : (data.assinaturas || data.data || data.items || []);

    if (!assinaturas.length) {
      return Response.json({ message: 'Nenhuma assinatura retornada', raw: data });
    }

    // Buscar cursos existentes
    const cursosExistentes = await base44.asServiceRole.entities.CursosEAD.list();
    const mapaExistentes = {};
    for (const c of cursosExistentes) {
      mapaExistentes[c.idAssinaturaGlobal] = c;
    }

    let criados = 0;
    let atualizados = 0;

    for (const ass of assinaturas) {
      const idAss = ass.id || ass.idassinatura || ass.idAssinatura;
      const nomeAss = ass.nome || ass.name || ass.titulo || String(idAss);

      if (!idAss) continue;

      if (mapaExistentes[idAss]) {
        // Atualizar nome se mudou
        if (mapaExistentes[idAss].nome !== nomeAss) {
          await base44.asServiceRole.entities.CursosEAD.update(mapaExistentes[idAss].id, { nome: nomeAss });
          atualizados++;
        }
      } else {
        // Criar novo
        await base44.asServiceRole.entities.CursosEAD.create({
          nome: nomeAss,
          descricao: nomeAss,
          valorBonus: 100,
          idAssinaturaGlobal: idAss,
          ativo: true
        });
        criados++;
      }
    }

    return Response.json({
      success: true,
      total: assinaturas.length,
      criados,
      atualizados
    });

  } catch (error) {
    console.error("Erro em sincronizarCursosGlobal:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});