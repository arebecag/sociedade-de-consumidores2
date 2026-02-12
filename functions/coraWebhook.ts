import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Extract invoice data from webhook
    const invoiceId = payload.invoice_id || payload.id || payload.data?.id;
    const status = payload.status || payload.data?.status;

    if (!invoiceId) {
      console.error('No invoice_id in webhook payload');
      return Response.json({ error: 'invoice_id missing' }, { status: 400 });
    }

    // Find invoice in database
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ invoice_id: invoiceId });
    
    if (invoices.length === 0) {
      console.error('Invoice not found:', invoiceId);
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoices[0];

    // Check if status is PAID
    if (status === 'PAID' || status === 'paid') {
      const updateData = {
        status: 'paid',
        paid_date: new Date().toISOString()
      };

      // Liberar acesso se ainda não foi liberado
      if (!invoice.access_granted) {
        try {
          const accessResult = await base44.asServiceRole.functions.invoke('liberarAcesso', {
            invoice_id: invoice.id
          });
          
          if (accessResult.data?.success) {
            updateData.access_granted = true;
            updateData.access_link = accessResult.data.access_link;

            // Send confirmation email
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: invoice.partner_id,
              subject: 'Pagamento Confirmado - Acesso Liberado',
              body: `
                <h2>Pagamento Confirmado!</h2>
                <p>Olá ${invoice.partner_name},</p>
                <p>Seu pagamento foi confirmado e seu acesso foi liberado.</p>
                <p><strong>Produto:</strong> ${invoice.product_name}</p>
                <p><strong>Link de Acesso:</strong> <a href="${accessResult.data.access_link}">${accessResult.data.access_link}</a></p>
                <p>Obrigado!</p>
              `
            });
          }
        } catch (error) {
          console.error('Error liberating access:', error);
        }
      }

      await base44.asServiceRole.entities.Invoice.update(invoice.id, updateData);

      return Response.json({ 
        success: true, 
        message: 'Invoice updated and access granted' 
      });
    }

    // Update status for other cases
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      status: mapCoraStatus(status)
    });

    return Response.json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

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