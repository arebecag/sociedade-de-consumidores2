Deno.serve(async (req) => {
  try {
    const clientId = Deno.env.get('CORA_CLIENT_ID');
    const clientSecret = Deno.env.get('CORA_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'CORA_CLIENT_ID e CORA_CLIENT_SECRET devem estar configurados' 
      }, { status: 500 });
    }

    const response = await fetch('https://proxycora.vercel.app/api/token', {
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

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ 
        ok: false, 
        error: data 
      }, { status: response.status });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});