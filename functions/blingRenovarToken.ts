import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLING_BASE_URL = 'https://www.bling.com.br/Api/v3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const integracoes = await base44.asServiceRole.entities.IntegracaoBling.list();
    
    if (integracoes.length === 0 || !integracoes[0].refresh_token) {
      return Response.json({ 
        error: 'Nenhuma integração encontrada ou refresh_token ausente' 
      }, { status: 400 });
    }

    const integracao = integracoes[0];
    const clientId = Deno.env.get('BLING_CLIENT_ID');
    const clientSecret = Deno.env.get('BLING_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Configuração incompleta');
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const tokenResponse = await fetch(`${BLING_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integracao.refresh_token
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      await base44.asServiceRole.entities.LogIntegracaoBling.create({
        tipo: 'refresh_token',
        status: 'erro',
        mensagem: 'Erro ao renovar token',
        codigo_http: tokenResponse.status,
        erro: JSON.stringify(tokenData)
      });

      await base44.asServiceRole.entities.IntegracaoBling.update(integracao.id, {
        status_integracao: 'desconectado',
        ultimo_erro: tokenData.error_description || tokenData.error || 'Erro ao renovar'
      });

      return Response.json({ 
        success: false,
        error: tokenData.error_description || 'Erro ao renovar token' 
      }, { status: tokenResponse.status });
    }

    const expiraEm = new Date(Date.now() + (tokenData.expires_in * 1000));

    await base44.asServiceRole.entities.IntegracaoBling.update(integracao.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      expira_em: expiraEm.toISOString(),
      status_integracao: 'conectado',
      ultimo_erro: null
    });

    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: 'refresh_token',
      status: 'sucesso',
      mensagem: 'Token renovado com sucesso',
      codigo_http: 200,
      detalhes: { expires_in: tokenData.expires_in }
    });

    return Response.json({ 
      success: true, 
      mensagem: 'Token renovado',
      expira_em: expiraEm.toISOString()
    });

  } catch (error) {
    console.error('[blingRenovarToken] Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro ao renovar token' 
    }, { status: 500 });
  }
});