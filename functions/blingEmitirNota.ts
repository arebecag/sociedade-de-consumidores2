import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { partnerId, purchaseId, productName, amount } = await req.json();

    if (!partnerId || !amount) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Buscar dados do parceiro
    const partner = await base44.asServiceRole.entities.Partner.get(partnerId);
    if (!partner) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    const apiKey = Deno.env.get('BLING_API_KEY');
    if (!apiKey) {
      return Response.json({ 
        error: 'BLING_API_KEY não configurada',
        message: 'Configure a chave de API do Bling nas configurações'
      }, { status: 500 });
    }

    // Preparar dados da nota fiscal (NFe de serviço - NFS-e)
    const notaData = {
      natureza_operacao: 'Venda de mercadoria',
      data_emissao: new Date().toISOString().split('T')[0],
      tipo_documento: 1, // 1 = Saída
      cliente: {
        nome: partner.full_name,
        cpf_cnpj: partner.cpf?.replace(/\D/g, ''),
        email: partner.email,
        endereco: {
          logradouro: partner.address?.street || '',
          numero: partner.address?.number || 'S/N',
          complemento: partner.address?.complement || '',
          bairro: partner.address?.neighborhood || '',
          cidade: partner.address?.city || '',
          uf: partner.address?.state || '',
          cep: partner.address?.cep?.replace(/\D/g, '') || ''
        }
      },
      itens: [{
        descricao: productName || 'Produto Digital',
        quantidade: 1,
        valor_unitario: amount,
        codigo: purchaseId || 'PROD001',
        tipo: 'S', // S = Serviço
        origem: 0,
        ncm: '00', // Para serviços
        cfop: '5933' // Prestação de serviço
      }],
      informacoes_adicionais_contribuinte: 'Venda realizada através da plataforma Sociedade de Consumidores'
    };

    // Emitir nota no Bling
    const response = await fetch('https://api.bling.com.br/Api/v3/nfe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(notaData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Bling] Erro ao emitir nota:', result);
      return Response.json({ 
        error: 'Erro ao emitir nota fiscal',
        details: result
      }, { status: response.status });
    }

    console.log('[Bling] Nota emitida com sucesso:', result.data?.numero);

    // Registrar log da emissão
    await base44.asServiceRole.entities.LogsFinanceiro.create({
      usuarioId: partnerId,
      tipo: 'nota_fiscal_emitida',
      descricao: `Nota fiscal emitida: ${result.data?.numero || 'N/A'}`,
      valor: amount,
      metadata: {
        numeroNota: result.data?.numero,
        chaveAcesso: result.data?.chave_acesso,
        purchaseId,
        productName
      }
    });

    return Response.json({
      success: true,
      nota: {
        numero: result.data?.numero,
        chave_acesso: result.data?.chave_acesso,
        link_pdf: result.data?.link_pdf
      }
    });

  } catch (error) {
    console.error('[blingEmitirNota] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});