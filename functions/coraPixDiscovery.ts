import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCoraToken, coraBaseUrl } from './_cora.js';

/**
 * Teste 3: Descobrir endpoints PIX disponíveis
 * Testa múltiplos caminhos e retorna quais respondem
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("Getting Cora token...");
    const token = await getCoraToken();
    const baseUrl = coraBaseUrl();

    const paths = [
      '/v2/pix/transfer',
      '/v2/transfers',
      '/v2/pix/payments',
      '/v2/pix'
    ];

    console.log("Testing PIX endpoints...");
    const results = [];

    for (const path of paths) {
      const url = `${baseUrl}${path}`;
      console.log(`Testing ${url}...`);

      try {
        // Tentar OPTIONS primeiro
        let response = await fetch(url, {
          method: 'OPTIONS',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Se OPTIONS não funcionar, tentar GET
        if (!response.ok) {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        }

        results.push({
          path,
          status: response.status,
          ok: response.ok,
          method: response.status === 200 ? 'available' : 
                  response.status === 404 ? 'not_found' :
                  response.status === 405 ? 'method_not_allowed' : 'error'
        });
      } catch (error) {
        results.push({
          path,
          status: 'error',
          error: error.message
        });
      }
    }

    return Response.json({
      ok: true,
      results
    });
  } catch (error) {
    console.error("Error in coraPixDiscovery:", error.message);
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});