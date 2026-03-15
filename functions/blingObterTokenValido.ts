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
    
    if (integracoes.length === 0) {
      return Response.json({ 
        success: false,
        conectado: false,
        mensagem: 'Integração não configurada' 
      });
    }

    const integracao = integracoes[0];

    if (integracao.status_integracao !== 'conectado' || !integracao.access_token) {
      return Response.json({ 
        success: false,
        conectado: false,
        mensagem: 'Integração desconectada' 
      });
    }

    // Verificar se o token está próximo de expirar (menos de 5 minutos)
    const expiraEm = new Date(integracao.expira_em);
    const agora = new Date();
    const diferencaMinutos = (expiraEm - agora) / 1000 / 60;

    if (diferencaMinutos < 5) {
      // Renovar token automaticamente
      const clientId = Deno.env.get('BLING_CLIENT_ID');
      const clientSecret = Deno.env.get('BLING_CLIENT_SECRET');
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

      if (tokenResponse.ok) {
        const novaExpiracao = new Date(Date.now() + (tokenData.expires_in * 1000));

        await base44.asServiceRole.entities.IntegracaoBling.update(integracao.id, {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          expira_em: novaExpiracao.toISOString(),
          status_integracao: 'conectado'
        });

        await base44.asServiceRole.entities.LogIntegracaoBling.create({
          tipo: 'refresh_token',
          status: 'sucesso',
          mensagem: 'Token renovado automaticamente',
          detalhes: { motivo: 'próximo_de_expirar' }
        });

        return Response.json({ 
          success: true,
          conectado: true,
          access_token: tokenData.access_token,
          renovado: true
        });
      } else {
        await base44.asServiceRole.entities.IntegracaoBling.update(integracao.id, {
          status_integracao: 'desconectado',
          ultimo_erro: 'Falha ao renovar token automaticamente'
        });

        return Response.json({ 
          success: false,
          conectado: false,
          mensagem: 'Token expirado e não foi possível renovar' 
        });
      }
    }

    return Response.json({ 
      success: true,
      conectado: true,
      access_token: integracao.access_token,
      expira_em: integracao.expira_em
    });

  } catch (error) {
    console.error('[blingObterTokenValido] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});