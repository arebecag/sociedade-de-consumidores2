import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get("CORA_CLIENT_ID"),
        client_secret: Deno.env.get("CORA_CLIENT_SECRET"),
        grant_type: 'client_credentials'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        ok: false,
        status: response.status,
        error: data
      });
    }

    return Response.json({
      ok: true,
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