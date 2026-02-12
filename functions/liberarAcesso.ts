import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id obrigatório' }, { status: 400 });
    }

    // Get invoice
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);

    if (!invoice) {
      return Response.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    // Get product to determine type and access link
    let accessLink = '';

    switch (invoice.product_type) {
      case 'curso':
        // For courses, return external link
        const products = await base44.asServiceRole.entities.Product.filter({ id: invoice.product_id });
        if (products.length > 0 && products[0].download_url) {
          accessLink = products[0].download_url;
        } else {
          accessLink = 'https://curso.example.com/acesso';
        }
        break;

      case 'consulta':
        // For consultations, return scheduling link
        accessLink = 'https://calendly.com/seu-link-de-agendamento';
        break;

      case 'drive':
        // For Google Drive, return drive link
        const driveProducts = await base44.asServiceRole.entities.Product.filter({ id: invoice.product_id });
        if (driveProducts.length > 0 && driveProducts[0].download_url) {
          accessLink = driveProducts[0].download_url;
        } else {
          accessLink = 'https://drive.google.com/...';
        }
        break;

      default:
        // For other products
        const otherProducts = await base44.asServiceRole.entities.Product.filter({ id: invoice.product_id });
        if (otherProducts.length > 0 && otherProducts[0].download_url) {
          accessLink = otherProducts[0].download_url;
        } else {
          accessLink = 'Acesso liberado. Entre em contato para mais detalhes.';
        }
        break;
    }

    return Response.json({
      success: true,
      access_link: accessLink,
      product_type: invoice.product_type,
      product_name: invoice.product_name
    });

  } catch (error) {
    console.error('Error granting access:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});