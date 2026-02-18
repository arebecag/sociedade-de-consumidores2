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

    // O retorno vem como XML dentro de data.raw (que pode ser um objeto com .raw ou string direta)
    const xmlRaw = data?.raw?.raw || data?.raw || data;
    const xmlStr = typeof xmlRaw === 'string' ? xmlRaw : JSON.stringify(xmlRaw);

    // Extrair todos os blocos <Produto_...>...</Produto_...>
    const blocos = [];
    const blocoRegex = /<Produto_[^>]*>([\s\S]*?)<\/Produto_[^>]*>/g;
    let match;
    while ((match = blocoRegex.exec(xmlStr)) !== null) {
      blocos.push(match[1]);
    }

    if (!blocos.length) {
      return Response.json({ message: 'Nenhum produto encontrado no XML', raw: xmlStr.slice(0, 500) });
    }

    // Extrair id e nome de cada bloco
    const assinaturas = [];
    for (const bloco of blocos) {
      const idMatch = bloco.match(/<id>(.*?)<\/id>/);
      const nomeMatch = bloco.match(/<nome>(.*?)<\/nome>/);
      if (idMatch && nomeMatch) {
        assinaturas.push({
          id: parseInt(idMatch[1].trim()),
          nome: nomeMatch[1].trim()
        });
      }
    }

    if (!assinaturas.length) {
      return Response.json({ message: 'Nenhuma assinatura extraída do XML', xmlPreview: xmlStr.slice(0, 500) });
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
      if (!ass.id) continue;

      if (mapaExistentes[ass.id]) {
        if (mapaExistentes[ass.id].nome !== ass.nome) {
          await base44.asServiceRole.entities.CursosEAD.update(mapaExistentes[ass.id].id, { nome: ass.nome });
          atualizados++;
        }
      } else {
        await base44.asServiceRole.entities.CursosEAD.create({
          nome: ass.nome,
          descricao: ass.nome,
          valorBonus: 100,
          idAssinaturaGlobal: ass.id,
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