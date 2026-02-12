import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id obrigatório' }, { status: 400 });
    }

    // Get token
    const tokenResponse = await base44.functions.invoke('coraAuth');
    const token = tokenResponse.data?.access_token;

    if (!token) {
      return Response.json({ error: 'Falha ao obter token' }, { status: 500 });
    }

    // Check invoice via proxy
    const proxyUrl = `https://proxycora.vercel.app/api/cora?path=/v2/invoices/${invoice_id}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Try to renew token and retry
      const newTokenResponse = await base44.functions.invoke('coraAuth');
      const newToken = newTokenResponse.data?.access_token;

      if (newToken) {
        const retryResponse = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!retryResponse.ok) {
          return Response.json({ error: 'Erro ao consultar fatura' }, { status: 500 });
        }

        const retryData = await retryResponse.json();
        await updateInvoiceStatus(base44, invoice_id, retryData);
        return Response.json(retryData);
      }

      return Response.json({ error: 'Token expirado' }, { status: 401 });
    }

    if (response.status === 403) {
      return Response.json({ error: 'Credenciais inválidas' }, { status: 403 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cora API error:', response.status, errorText);
      return Response.json({ error: 'Erro ao consultar fatura' }, { status: 500 });
    }

    const invoiceData = await response.json();

    // Update database
    await updateInvoiceStatus(base44, invoice_id, invoiceData);

    return Response.json(invoiceData);

  } catch (error) {
    console.error('Error checking invoice:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function updateInvoiceStatus(base44, invoice_id, invoiceData) {
  const invoices = await base44.asServiceRole.entities.Invoice.filter({ invoice_id });
  
  if (invoices.length > 0) {
    const invoice = invoices[0];
    const updateData = {
      status: mapCoraStatus(invoiceData.status)
    };

    if (invoiceData.status === 'PAID' || invoiceData.status === 'paid') {
      updateData.paid_date = new Date().toISOString();
      
      // Liberar acesso se ainda não foi liberado
      if (!invoice.access_granted) {
        const accessResult = await base44.asServiceRole.functions.invoke('liberarAcesso', {
          invoice_id: invoice.id
        });
        
        if (accessResult.data?.success) {
          updateData.access_granted = true;
          updateData.access_link = accessResult.data.access_link;
        }
      }
    }

    await base44.asServiceRole.entities.Invoice.update(invoice.id, updateData);
  }
}

function mapCoraStatus(coraStatus) {
  const statusMap = {
    'PENDING': 'pending',
    'PAID': 'paid',
    'CANCELLED': 'cancelled',
    'EXPIRED': 'expired',
    'pending': 'pending',
    'paid': 'paid',
    'cancelled': 'cancelled',
    'expired': 'expired'
  };
  return statusMap[coraStatus] || 'pending';
}