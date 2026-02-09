import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Obtém access token OAuth2 da API Cora via TOKEN PROXY (mTLS)
 * Reutilizável por outras funções
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter configurações das variáveis de ambiente (Base44 Secrets)
    const proxyUrl = Deno.env.get("CORA_TOKEN_PROXY_URL");
    const clientId = Deno.env.get("CORA_CLIENT_ID");
    const clientSecret = Deno.env.get("CORA_CLIENT_SECRET");

    console.log("=== CORA AUTH VIA PROXY ===");
    console.log("Proxy URL configured:", proxyUrl ? "YES" : "NO");
    console.log("Client ID configured:", clientId ? "YES" : "NO");
    console.log("Client Secret configured:", clientSecret ? "YES" : "NO");

    if (!proxyUrl || !clientId || !clientSecret) {
      console.error("❌ Configuration missing");
      return Response.json({ 
        error: 'Cora configuration incomplete',
        hint: 'Configure CORA_TOKEN_PROXY_URL, CORA_CLIENT_ID and CORA_CLIENT_SECRET in Base44 secrets'
      }, { status: 500 });
    }

    console.log("Calling proxy:", proxyUrl);

    // Chamar o proxy de token (que lida com mTLS)
    const proxyResponse = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });

    console.log("Proxy response status:", proxyResponse.status);

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      console.error("❌ Proxy auth failed");
      console.error("Status:", proxyResponse.status);
      console.error("Response:", errorText);
      return Response.json({ 
        error: 'Failed to authenticate via proxy',
        status: proxyResponse.status,
        details: errorText
      }, { status: proxyResponse.status });
    }

    const authData = await proxyResponse.json();
    console.log("✅ CORA AUTH OK");
    console.log("Token type:", authData.token_type || "bearer");
    console.log("Expires in:", authData.expires_in || "N/A");

    return Response.json({
      success: true,
      status: "CORA AUTH OK",
      access_token: authData.access_token,
      expires_in: authData.expires_in,
      token_type: authData.token_type || "Bearer"
    });
  } catch (error) {
    console.error("❌ Error in coraAuth:", error.message);
    console.error("Stack:", error.stack);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});