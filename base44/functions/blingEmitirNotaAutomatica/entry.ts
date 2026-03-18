import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLING_BASE_URL = 'https://www.bling.com.br/Api/v3';

async function obterTokenValido(base44) {
  const integracoes = await base44.asServiceRole.entities.IntegracaoBling.list();
  
  if (integracoes.length === 0 || integracoes[0].status_integracao !== 'conectado') {
    throw new Error('Integração Bling não está conectada');
  }

  const integracao = integracoes[0];
  const expiraEm = new Date(integracao.expira_em);
  const agora = new Date();
  const diferencaMinutos = (expiraEm - agora) / 1000 / 60;

  // Se token vai expirar em menos de 5 minutos, renovar
  if (diferencaMinutos < 5) {
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

    if (!tokenResponse.ok) {
      throw new Error('Falha ao renovar token do Bling');
    }

    const tokenData = await tokenResponse.json();
    const novaExpiracao = new Date(Date.now() + (tokenData.expires_in * 1000));

    await base44.asServiceRole.entities.IntegracaoBling.update(integracao.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      expira_em: novaExpiracao.toISOString()
    });

    return tokenData.access_token;
  }

  return integracao.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { payment_id } = await req.json();

    if (!payment_id) {
      return Response.json({ error: 'payment_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados do pagamento
    const pagamentos = await base44.asServiceRole.entities.Financeiro.filter({
      asaasPaymentId: payment_id
    });

    if (pagamentos.length === 0) {
      return Response.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    const pagamento = pagamentos[0];

    // Buscar dados do parceiro
    const parceiros = await base44.asServiceRole.entities.Partner.filter({
      id: pagamento.userId
    });

    if (parceiros.length === 0) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    const parceiro = parceiros[0];

    // Obter token válido
    const accessToken = await obterTokenValido(base44);

    // Montar dados da nota fiscal
    const notaFiscalData = {
      numero: null, // Bling gera automaticamente
      dataEmissao: new Date().toISOString().split('T')[0],
      naturezaOperacao: {
        id: 1 // Venda de produção do estabelecimento (ajustar conforme necessário)
      },
      cliente: {
        nome: parceiro.full_name,
        cpfCnpj: parceiro.cpf,
        email: parceiro.email,
        telefone: parceiro.phone,
        endereco: {
          logradouro: parceiro.address?.street || '',
          numero: parceiro.address?.number || 'S/N',
          complemento: parceiro.address?.complement || '',
          bairro: parceiro.address?.neighborhood || '',
          cep: parceiro.address?.cep?.replace(/\D/g, '') || '',
          municipio: parceiro.address?.city || '',
          uf: parceiro.address?.state || ''
        }
      },
      itens: [{
        codigo: 'SERV001',
        descricao: pagamento.descricao || 'Serviço de plataforma',
        quantidade: 1,
        valor: pagamento.valor,
        unidade: 'UN',
        tipo: 'S' // S = Serviço, P = Produto
      }],
      valorTotal: pagamento.valor
    };

    // Emitir nota fiscal no Bling
    const notaResponse = await fetch(`${BLING_BASE_URL}/nfe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(notaFiscalData)
    });

    const notaResult = await notaResponse.json();

    // Log da operação
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: 'api_call',
      status: notaResponse.ok ? 'sucesso' : 'erro',
      mensagem: notaResponse.ok 
        ? `Nota fiscal emitida para ${parceiro.full_name}` 
        : 'Erro ao emitir nota fiscal',
      codigo_http: notaResponse.status,
      detalhes: {
        payment_id,
        parceiro_id: parceiro.id,
        valor: pagamento.valor,
        response: notaResult
      }
    });

    if (!notaResponse.ok) {
      return Response.json({ 
        success: false,
        error: 'Erro ao emitir nota fiscal no Bling',
        detalhes: notaResult
      }, { status: notaResponse.status });
    }

    // Atualizar pagamento com dados da nota
    await base44.asServiceRole.entities.Financeiro.update(pagamento.id, {
      notaFiscalEmitida: true,
      notaFiscalNumero: notaResult.data?.numero,
      notaFiscalChave: notaResult.data?.chaveAcesso,
      notaFiscalUrl: notaResult.data?.linkDownload
    });

    return Response.json({ 
      success: true,
      mensagem: 'Nota fiscal emitida com sucesso',
      nota: notaResult.data
    });

  } catch (error) {
    console.error('[blingEmitirNotaAutomatica] Erro:', error);
    
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: 'erro',
      status: 'erro',
      mensagem: 'Erro ao emitir nota automática',
      erro: error.message
    });

    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});