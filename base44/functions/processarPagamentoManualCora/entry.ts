import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { valor, descricao, dataVencimento } = await req.json();

    if (!valor || !descricao) {
      return Response.json({ error: 'valor e descricao são obrigatórios' }, { status: 400 });
    }

    const environment = Deno.env.get("CORA_ENVIRONMENT") || "production";
    const apiUrl = Deno.env.get("CORA_API_URL");
    const clientId = Deno.env.get("CORA_CLIENT_ID");
    const clientSecret = Deno.env.get("CORA_CLIENT_SECRET");
    const tokenUrl = Deno.env.get("CORA_TOKEN_PROXY_URL") || Deno.env.get("CORA_TOKEN_URL");

    // Criar registro inicial
    const registro = await base44.asServiceRole.entities.PagamentosCora.create({
      valor,
      descricao,
      dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
      status: 'aguardando_pagamento',
      criadoPor: user.email,
      logTentativa: 'Iniciando geração de cobrança...'
    });

    let logTentativa = `[${new Date().toISOString()}] Iniciando cobrança Cora\n`;
    logTentativa += `Valor: R$ ${valor}, Descrição: ${descricao}\n`;

    try {
      // Obter token Cora
      logTentativa += `[${new Date().toISOString()}] Obtendo token...\n`;
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        logTentativa += `[ERRO] Token falhou: ${err}\n`;
        await base44.asServiceRole.entities.PagamentosCora.update(registro.id, {
          logTentativa,
          status: 'cancelado'
        });
        return Response.json({ error: 'Falha ao obter token Cora', detail: err }, { status: 500 });
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      logTentativa += `[${new Date().toISOString()}] Token obtido com sucesso.\n`;

      // Gerar cobrança
      const vencimento = dataVencimento || new Date().toISOString().split('T')[0];
      const payload = {
        code: `PAG-${registro.id}`,
        description: descricao,
        amount: Math.round(valor * 100),
        due_date: vencimento,
        payment_forms: [{ payment_type: 'BOLETO' }, { payment_type: 'PIX' }]
      };

      logTentativa += `[${new Date().toISOString()}] Enviando cobrança para Cora...\n`;
      const cobraRes = await fetch(`${apiUrl}/invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': registro.id
        },
        body: JSON.stringify(payload)
      });

      const cobraData = await cobraRes.json();
      logTentativa += `[${new Date().toISOString()}] Resposta Cora: ${JSON.stringify(cobraData)}\n`;

      if (!cobraRes.ok) {
        await base44.asServiceRole.entities.PagamentosCora.update(registro.id, {
          logTentativa,
          status: 'cancelado'
        });
        return Response.json({ error: 'Falha ao criar cobrança', detail: cobraData }, { status: 500 });
      }

      const linkPagamento = cobraData?.payment_url || cobraData?.url || cobraData?.link || '';
      const cobraId = cobraData?.id || '';

      await base44.asServiceRole.entities.PagamentosCora.update(registro.id, {
        cobraId,
        linkPagamento,
        logTentativa,
        status: 'aguardando_pagamento'
      });

      return Response.json({
        success: true,
        id: registro.id,
        cobraId,
        linkPagamento,
        status: 'aguardando_pagamento'
      });

    } catch (innerError) {
      logTentativa += `[ERRO] ${innerError.message}\n`;
      await base44.asServiceRole.entities.PagamentosCora.update(registro.id, {
        logTentativa,
        status: 'cancelado'
      });
      return Response.json({ error: innerError.message }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});