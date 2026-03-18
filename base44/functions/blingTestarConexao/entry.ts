import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLING_BASE_URL = 'https://www.bling.com.br/Api/v3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Obter token válido (renova automaticamente se necessário)
    const tokenRes = await base44.functions.invoke('blingObterTokenValido', {});
    
    if (!tokenRes.data?.success || !tokenRes.data?.access_token) {
      return Response.json({ 
        success: false,
        conectado: false,
        mensagem: 'Integração não está conectada' 
      });
    }

    const accessToken = tokenRes.data.access_token;

    // Testar chamada à API - endpoint de situações (simples e sem efeitos colaterais)
    const testeResponse = await fetch(`${BLING_BASE_URL}/situacoes/modulos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const testeData = await testeResponse.json();

    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: 'api_call',
      status: testeResponse.ok ? 'sucesso' : 'erro',
      mensagem: testeResponse.ok ? 'Teste de conexão bem-sucedido' : 'Falha no teste de conexão',
      codigo_http: testeResponse.status,
      detalhes: { endpoint: '/situacoes/modulos' }
    });

    if (!testeResponse.ok) {
      return Response.json({ 
        success: false,
        conectado: false,
        mensagem: 'Erro ao testar API do Bling',
        erro: testeData,
        codigo_http: testeResponse.status
      });
    }

    return Response.json({ 
      success: true,
      conectado: true,
      mensagem: 'Conexão com Bling OK',
      dados_teste: testeData
    });

  } catch (error) {
    console.error('[blingTestarConexao] Erro:', error);
    
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: 'erro',
      status: 'erro',
      mensagem: 'Erro ao testar conexão',
      erro: error.message
    });

    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});