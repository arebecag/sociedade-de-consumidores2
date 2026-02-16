import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gera boleto na API Cora para uma Purchase
 * Payload: { purchase_id: string }
 * 
 * NOTA: Esta função requer configuração do proxy mTLS da Vercel.
 * Será implementada após configuração dos certificados no proxy.
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
    if (!authRes.data?.access_token) {
      return Response.json({ error: 'Failed to authenticate with Cora' }, { status: 500 });
    }

    const token = authRes.data.access_token;
    
    // CORRIGIDO: Usar o proxy da Vercel
    const proxyUrl = Deno.env.get("CORA_BOLETO_PROXY_URL") || "https://proxycora.vercel.app/api/boleto";
    const environment = Deno.env.get("CORA_ENVIRONMENT") || "test";

    // Calcular datas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    
    const fineDate = new Date(dueDate);
    fineDate.setDate(fineDate.getDate() + 1);
    
    const amount = Math.round(purchase.paid_with_boleto * 100); // em centavos

    // Preparar payload (igual ao que você já tem, só ajustei os nomes dos campos)
    const boletoData = {
      code: `PURCHASE_${purchase_id}_${Date.now()}`,
      debtor: {
        name: partner.full_name || partner.name,
        taxpayer_id: partner.cpf?.replace(/\D/g, ''), // Cora espera "taxpayer_id" não "document"
        address: {
          street: partner.address?.street || "",
          number: partner.address?.number || "",
          neighborhood: partner.address?.neighborhood || "",
          city: partner.address?.city || "",
          state: partner.address?.state || "",
          zip_code: partner.address?.cep?.replace(/\D/g, '') || "",
          complement: partner.address?.complement || ""
        }
      },
      amount: amount,
      due_date: dueDate.toISOString().split('T')[0],
      description: `Compra ${purchase.product_name || 'Produto'}`,
      fine: {
        value: Math.round(amount * 0.02), // 2% em centavos (Cora espera "value" não "amount")
        date: fineDate.toISOString().split('T')[0]
      },
      interest: {
        value: Math.round(amount * 0.0001), // 0.01% ao dia (Cora espera "value" não "amount")
        type: "daily" // Cora espera "daily" não "DAILY"
      }
    };

    console.log("Enviando para proxy:", {
      url: `${proxyUrl}?env=${environment}`,
      payload: boletoData,
      token: token.substring(0, 20) + '...'
    });

    // CORRIGIDO: Enviar para o proxy, não direto para Cora
    const boletoResponse = await fetch(`${proxyUrl}?env=${environment}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(boletoData)
    });

    console.log("Resposta do proxy - Status:", boletoResponse.status);
    
    const responseText = await boletoResponse.text();
    console.log("Resposta do proxy - Body:", responseText);
    
    let boletoResult;
    try {
      boletoResult = JSON.parse(responseText);
    } catch (e) {
      console.error("Erro ao parsear resposta:", e.message);
      return Response.json({ 
        error: 'Invalid response from proxy',
        details: responseText
      }, { status: 500 });
    }

    if (!boletoResponse.ok) {
      console.error("Proxy/Cora error:", boletoResult);
      return Response.json({ 
        error: 'Failed to generate boleto',
        details: boletoResult,
        status: boletoResponse.status
      }, { status: boletoResponse.status });
    }

    // Atualizar Purchase com dados do boleto
    await base44.asServiceRole.entities.Purchase.update(purchase_id, {
      boleto_id: boletoResult.id,
      boleto_barcode: boletoResult.barcode,
      boleto_url: boletoResult.pdf_url,
      boleto_due_date: dueDate.toISOString().split('T')[0]
    });

    return Response.json({
      success: true,
      boleto: {
        id: boletoResult.id,
        barcode: boletoResult.barcode,
        pdf_url: boletoResult.pdf_url,
        due_date: dueDate.toISOString().split('T')[0],
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