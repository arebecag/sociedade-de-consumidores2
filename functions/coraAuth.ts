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

    // Obter credenciais das variáveis de ambiente
    const clientId = Deno.env.get("CORA_CLIENT_ID");
    const clientSecret = Deno.env.get("CORA_CLIENT_SECRET");
    const apiUrl = Deno.env.get("CORA_API_URL") || "https://api.cora.com.br";

    if (!clientId || !clientSecret) {
      console.error("CORA credentials not configured");
      return Response.json({ 
        error: 'Cora credentials not configured' 
      }, { status: 500 });
    }

    // Autenticação OAuth2 Client Credentials
    const authResponse = await fetch(`${apiUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'boleto.read boleto.write pix.write pix.read'
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("Cora auth failed:", errorText);
      return Response.json({ 
        error: 'Failed to authenticate with Cora',
        details: authResponse.statusText
      }, { status: authResponse.status });
    }

    const authData = await authResponse.json();

    return Response.json({
      access_token: authData.access_token,
      expires_in: authData.expires_in,
      token_type: authData.token_type
    });
  } catch (error) {
    console.error("Error in coraAuth:", error.message);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});