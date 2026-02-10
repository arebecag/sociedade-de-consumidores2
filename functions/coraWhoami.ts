import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter token
    const tokenResp = await base44.functions.invoke('coraAuth', {});
    
    if (!tokenResp?.data?.ok || !tokenResp?.data?.data?.access_token) {
      return Response.json({
        ok: false,
        step: 'auth',
        error: tokenResp?.data
      });
    }

    const token = tokenResp.data.data.access_token;
    const proxyUrl = Deno.env.get("CORA_API_PROXY_URL");

    if (!proxyUrl) {
      return Response.json({
        ok: false,
        error: "CORA_API_PROXY_URL not configured"
      });
    }

    // Chamar via proxy
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        method: 'GET',
        path: '/v2/me'
      })
    });

    const data = await response.json();

    return Response.json({
      ok: response.ok,
      step: 'whoami',
      status: response.status,
      data
    });
  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});