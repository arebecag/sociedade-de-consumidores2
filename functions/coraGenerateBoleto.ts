import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Validar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extrair purchase_id do body
    const body = await req.json();
    const { purchase_id } = body;

    if (!purchase_id) {
      return Response.json({ error: 'purchase_id é obrigatório' }, { status: 400 });
    }

    console.log('[INFO] Gerando boleto para purchase:', purchase_id);

    // 3. Buscar a Purchase
    const purchases = await base44.asServiceRole.entities.Purchase.filter({ id: purchase_id });
    if (!purchases || purchases.length === 0) {
      return Response.json({ error: 'Purchase não encontrada' }, { status: 404 });
    }
    const purchase = purchases[0];

    console.log('[INFO] Purchase encontrada:', {
      id: purchase.id,
      partner_id: purchase.partner_id,
      amount: purchase.amount,
      paid_with_boleto: purchase.paid_with_boleto
    });

    // 4. Buscar o Partner
    const partners = await base44.asServiceRole.entities.Partner.filter({ id: purchase.partner_id });
    if (!partners || partners.length === 0) {
      return Response.json({ error: 'Partner não encontrado' }, { status: 404 });
    }
    const partner = partners[0];

    console.log('[INFO] Partner encontrado:', {
      id: partner.id,
      name: partner.full_name,
      cpf: partner.cpf
    });

    // 5. Obter token da Cora
    console.log('[INFO] Obtendo token da Cora...');
    const authResponse = await base44.asServiceRole.functions.invoke('coraAuth', {});
    if (!authResponse.data || !authResponse.data.token) {
      console.error('[ERROR] Falha ao obter token da Cora:', authResponse);
      return Response.json({ 
        error: 'Erro ao autenticar com a Cora', 
        details: authResponse.data 
      }, { status: 500 });
    }
    const token = authResponse.data.token;
    console.log('[INFO] Token obtido com sucesso');

    // 6. Montar payload do boleto
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);
    const fineDateObj = new Date(dueDate);
    fineDateObj.setDate(fineDateObj.getDate() + 1);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dueDateStr = formatDate(dueDate);
    const fineDateStr = formatDate(fineDateObj);
    
    const amountInCents = Math.round(purchase.paid_with_boleto * 100);
    const fineAmount = Math.round(amountInCents * 0.02); // 2% multa
    const interestAmount = Math.round(amountInCents * 0.0001); // 0.01% ao dia

    // Limpar CPF (remover formatação)
    const cleanCPF = (partner.cpf || '').replace(/[^\d]/g, '');

    const boletoPayload = {
      code: `PURCHASE_${purchase_id}_${Date.now()}`,
      debtor: {
        name: partner.full_name,
        document: {
          type: 'CPF',
          number: cleanCPF
        },
        address: {
          street: partner.address?.street || '',
          number: partner.address?.number || '',
          complement: partner.address?.complement || '',
          neighborhood: partner.address?.neighborhood || '',
          city: partner.address?.city || '',
          state: partner.address?.state || '',
          postal_code: (partner.address?.cep || '').replace(/[^\d]/g, '')
        }
      },
      amount: amountInCents,
      due_date: dueDateStr,
      fine: {
        amount: fineAmount,
        date: fineDateStr
      },
      interest: {
        amount: interestAmount
      },
      description: `Compra ${purchase.product_name || 'Produto'}`
    };

    console.log('[INFO] Payload do boleto:', JSON.stringify(boletoPayload, null, 2));

    // 7. Enviar para o proxy
    console.log('[INFO] Enviando requisição para o proxy Vercel...');
    const proxyResponse = await fetch('https://proxycora.vercel.app/api/boleto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(boletoPayload)
    });

    console.log('[INFO] Status da resposta do proxy:', proxyResponse.status);

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      console.error('[ERROR] Erro do proxy:', errorText);
      return Response.json({
        error: 'Erro ao gerar boleto na Cora',
        status: proxyResponse.status,
        details: errorText
      }, { status: proxyResponse.status });
    }

    const boletoData = await proxyResponse.json();
    console.log('[INFO] Boleto gerado com sucesso:', boletoData);

    // 8. Atualizar a Purchase
    await base44.asServiceRole.entities.Purchase.update(purchase.id, {
      boleto_id: boletoData.id,
      boleto_barcode: boletoData.barcode,
      boleto_url: boletoData.pdf_url || boletoData.url,
      boleto_due_date: dueDateStr
    });

    console.log('[INFO] Purchase atualizada com dados do boleto');

    // 9. Retornar dados do boleto
    return Response.json({
      success: true,
      boleto: {
        id: boletoData.id,
        barcode: boletoData.barcode,
        url: boletoData.pdf_url || boletoData.url,
        due_date: dueDateStr,
        amount: amountInCents,
        code: boletoPayload.code
      }
    });

  } catch (error) {
    console.error('[ERROR] Erro em coraGenerateBoleto:', error.message);
    console.error('[ERROR] Stack trace:', error.stack);
    return Response.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
});