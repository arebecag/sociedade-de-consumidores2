import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const integracoes = await base44.asServiceRole.entities.IntegracaoBling.list();
    
    if (integracoes.length === 0) {
      return Response.json({ 
        success: true,
        mensagem: 'Nenhuma integração para desconectar' 
      });
    }

    await base44.asServiceRole.entities.IntegracaoBling.update(integracoes[0].id, {
      access_token: null,
      refresh_token: null,
      status_integracao: 'desconectado',
      expira_em: null,
      ultimo_erro: 'Desconectado manualmente'
    });

    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: 'auth_inicio',
      status: 'sucesso',
      mensagem: 'Integração desconectada manualmente'
    });

    return Response.json({ 
      success: true,
      mensagem: 'Integração desconectada com sucesso' 
    });

  } catch (error) {
    console.error('[blingDesconectar] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});