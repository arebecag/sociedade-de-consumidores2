import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testa múltiplos endpoints da Cora API até achar um que retorne 200
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter token via proxy mTLS
    const tokenResp = await base44.functions.invoke('coraAuth', {});
    
    if (!tokenResp?.data?.access_token) {
      return Response.json({
        ok: false,
        error: "token_failed",
        details: tokenResp
      });
    }

    const token = tokenResp.data.access_token;
    const apiUrl = Deno.env.get("CORA_API_URL");

    // Endpoints para testar
    const endpoints = [
      '/v2/me',
      '/v2/customers',
      '/v2/accounts',
      '/v2/invoices',
      '/v2/transactions',
      '/v2/balance',
      '/v2/pix',
      '/v2/pix/qrcodes',
      '/v1/me',
      '/v1/accounts',
      '/customers',
      '/accounts',
      '/invoices'
    ];

    const results = [];
    let firstOk = null;

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${apiUrl}${endpoint}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        const status = res.status;
        const ok = res.ok;
        
        let data = null;
        try {
          const text = await res.text();
          data = text ? JSON.parse(text) : null;
        } catch {
          data = "non-json response";
        }

        results.push({
          endpoint,
          status,
          ok,
          data: ok ? data : (status === 404 ? "not found" : data)
        });

        if (ok && !firstOk) {
          firstOk = endpoint;
        }
      } catch (error) {
        results.push({
          endpoint,
          status: 'error',
          ok: false,
          error: error.message
        });
      }
    }

    return Response.json({
      ok: true,
      first_ok_endpoint: firstOk,
      total_tested: endpoints.length,
      results
    });
  } catch (error) {
    console.error("Error in coraProbe:", error.message);
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});