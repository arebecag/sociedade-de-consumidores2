import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Teste 1: Valida identidade na API Cora (endpoint /v2/me)
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

    const apiUrl = Deno.env.get("CORA_API_URL");
    const res = await fetch(`${apiUrl}/v2/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenResp.data.access_token}`,
        "Content-Type": "application/json"
      }
    });

    const text = await res.text();

    return Response.json({
      ok: res.ok,
      status: res.status,
      endpoint: "/v2/me",
      data: (() => {
        try { 
          return JSON.parse(text); 
        } catch { 
          return text; 
        }
      })()
    });
  } catch (error) {
    console.error("Error in coraWhoami:", error.message);
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});