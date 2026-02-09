import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Obtém access token OAuth2 da API Cora
 * Reutilizável por outras funções
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter credenciais das variáveis de ambiente (Base44 Secrets)
    const clientId = Deno.env.get("CORA_CLIENT_ID");
    const clientSecret = Deno.env.get("CORA_CLIENT_SECRET");
    const apiUrl = Deno.env.get("CORA_API_URL") || "https://matls-clients.api.stage.cora.com.br";

    console.log("=== CORA AUTH DEBUG ===");
    console.log("API URL:", apiUrl);
    console.log("Environment:", apiUrl.includes("stage") || apiUrl.includes("sandbox") ? "SANDBOX" : "PRODUCTION");
    console.log("Client ID configured:", clientId ? "YES" : "NO");
    console.log("Client Secret configured:", clientSecret ? "YES" : "NO");

    if (!clientId || !clientSecret) {
      console.error("❌ CORA credentials not configured");
      return Response.json({ 
        error: 'Cora credentials not configured',
        hint: 'Configure CORA_CLIENT_ID and CORA_CLIENT_SECRET in Base44 secrets'
      }, { status: 500 });
    }

    // Autenticação OAuth2 Client Credentials
    const authUrl = `${apiUrl}/token`;
    console.log("Auth endpoint:", authUrl);

    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials'
      }).toString()
    });

    console.log("Response status:", authResponse.status);

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("❌ Cora auth failed");
      console.error("Status:", authResponse.status);
      console.error("Response:", errorText);
      return Response.json({ 
        error: 'Failed to authenticate with Cora',
        status: authResponse.status,
        details: errorText,
        api_url: apiUrl
      }, { status: authResponse.status });
    }

    const authData = await authResponse.json();
    console.log("✅ CORA AUTH OK");
    console.log("Token type:", authData.token_type);
    console.log("Expires in:", authData.expires_in);

    return Response.json({
      success: true,
      status: "CORA AUTH OK",
      access_token: authData.access_token,
      expires_in: authData.expires_in,
      token_type: authData.token_type,
      environment: apiUrl.includes("stage") || apiUrl.includes("sandbox") ? "SANDBOX" : "PRODUCTION"
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