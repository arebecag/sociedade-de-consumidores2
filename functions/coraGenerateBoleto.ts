import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gera boleto na API Cora para uma Purchase
 * Payload: { purchase_id: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { purchase_id } = await req.json();

    if (!purchase_id) {
      return Response.json({ error: 'purchase_id is required' }, { status: 400 });
    }

    // Buscar Purchase
    const purchases = await base44.entities.Purchase.filter({ id: purchase_id });
    if (purchases.length === 0) {
      return Response.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const purchase = purchases[0];

    // Buscar Partner
    const partners = await base44.asServiceRole.entities.Partner.filter({ id: purchase.partner_id });
    if (partners.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];

    // Obter token Cora
    const authRes = await base44.functions.invoke('coraAuth', {});
    if (!authRes.data.access_token) {
      return Response.json({ error: 'Failed to authenticate with Cora' }, { status: 500 });
    }

    const token = authRes.data.access_token;
    const proxyUrl = Deno.env.get("CORA_TOKEN_PROXY_URL");

    if (!proxyUrl) {
      return Response.json({ error: "CORA_TOKEN_PROXY_URL not configured" }, { status: 500 });
    }

    // Criar boleto via PROXY VERCEL (mTLS)
    const boletoData = {
      total_amount: purchase.paid_with_boleto * 100,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      payment_form: "BANK_SLIP",
      customer: {
        name: partner.full_name,
        document: partner.cpf,
        email: user.email
      }
    };

    const boletoResponse = await fetch(
      `${proxyUrl}/api/cora?path=/v2/invoices`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify(boletoData)
      }
    );

    if (!boletoResponse.ok) {
      const errorText = await boletoResponse.text();
      console.error("Cora boleto generation failed:", errorText);
      return Response.json({ 
        error: 'Failed to generate boleto',
        details: errorText
      }, { status: boletoResponse.status });
    }

    const boletoResult = await boletoResponse.json();

    // Atualizar Purchase com dados do boleto
    await base44.asServiceRole.entities.Purchase.update(purchase_id, {
      boleto_id: boletoResult.id,
      boleto_barcode: boletoResult.barcode,
      boleto_url: boletoResult.pdf_url,
      boleto_due_date: boletoData.due_date
    });

    return Response.json({
      success: true,
      boleto: {
        id: boletoResult.id,
        barcode: boletoResult.barcode,
        pdf_url: boletoResult.pdf_url,
        due_date: boletoData.due_date,
        amount: purchase.paid_with_boleto
      }
    });
  } catch (error) {
    console.error("Error in coraGenerateBoleto:", error.message);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});