import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Teste 0: Valida obtenção de token via proxy mTLS
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proxyUrl = Deno.env.get("CORA_TOKEN_PROXY_URL");
    
    if (!proxyUrl) {
      return Response.json({ 
        ok: false, 
        error: "CORA_TOKEN_PROXY_URL not configured" 
      });
    }

    console.log("Testing token proxy...");

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: Deno.env.get("CORA_CLIENT_ID"),
        client_secret: Deno.env.get("CORA_CLIENT_SECRET"),
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({
        ok: false,
        status: response.status,
        data: errorText
      });
    }

    const data = await response.json();

    return Response.json({
      ok: true,
      has_access_token: !!data.access_token,
      token_type: data.token_type || "Bearer",
      expires_in: data.expires_in || "unknown"
    });
  } catch (error) {
    console.error("Error in coraAuth:", error.message);
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});