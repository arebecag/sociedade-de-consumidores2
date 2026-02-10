import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCoraToken, coraBaseUrl } from './_cora.js';

/**
 * Teste 2: Pagar boleto via API Cora (ATENÇÃO: PRODUÇÃO!)
 * Input: { barcode: string, amount: number }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barcode, amount } = await req.json();

    // Validação de campos obrigatórios
    if (!barcode || !amount) {
      return Response.json({
        ok: false,
        error: "barcode and amount are required"
      }, { status: 400 });
    }

    console.log("Getting Cora token...");
    const token = await getCoraToken();
    const baseUrl = coraBaseUrl();

    const url = `${baseUrl}/v2/invoices/pay`;
    console.log(`Calling ${url}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        barcode,
        amount
      })
    });

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return Response.json({
      ok: response.ok,
      status: response.status,
      data
    });
  } catch (error) {
    console.error("Error in coraPayInvoice:", error.message);
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});