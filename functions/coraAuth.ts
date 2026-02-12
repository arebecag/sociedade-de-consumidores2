Deno.serve(async (req) => {
  try {
    const response = await fetch('https://proxycora.vercel.app/api/token', {
      method: 'POST'
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