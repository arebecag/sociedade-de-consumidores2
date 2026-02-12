import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, due_date, payer, product_id, product_name, product_type } = await req.json();

    if (!amount || !due_date || !payer || !product_id) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Get token
    const tokenResponse = await base44.functions.invoke('coraAuth');
    const token = tokenResponse.data?.access_token;

    if (!token) {
      return Response.json({ error: 'Falha ao obter token' }, { status: 500 });
    }

    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    // Create invoice via proxy
    const proxyUrl = 'https://proxycora.vercel.app/api/cora?path=/v2/invoices';
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        amount,
        due_date,
        payer
      })
    });

    if (response.status === 401) {
      return Response.json({ error: 'Token expirado. Tente novamente.' }, { status: 401 });
    }

    if (response.status === 403) {
      return Response.json({ error: 'Credenciais inválidas' }, { status: 403 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cora API error:', response.status, errorText);
      return Response.json({ error: 'Erro ao criar fatura' }, { status: 500 });
    }

    const invoiceData = await response.json();

    // Get partner
    const partners = await base44.entities.Partner.filter({ created_by: user.email });
    const partner = partners[0];

    if (!partner) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    // Save to database
    const invoice = await base44.entities.Invoice.create({
      invoice_id: invoiceData.id,
      partner_id: partner.id,
      partner_name: partner.full_name,
      amount,
      due_date,
      status: 'pending',
      payment_link: invoiceData.payment_link || invoiceData.digitable_line,
      product_id,
      product_name,
      product_type: product_type || 'outro',
      access_granted: false
    });

    return Response.json({
      invoice_id: invoice.invoice_id,
      payment_link: invoice.payment_link,
      status: invoice.status,
      database_id: invoice.id
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});