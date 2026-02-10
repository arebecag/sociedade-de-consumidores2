import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCoraToken, coraBaseUrl } from './_cora.js';

/**
 * Teste 1: Validação de API - testa endpoints GET seguros
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

    const endpoints = [
      '/v2/me',
      '/v2/account',
      '/v2/accounts'
    ];

    console.log("Testing endpoints...");

    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      console.log(`Trying ${url}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Se retornar 404, tenta o próximo
      if (response.status === 404) {
        console.log(`${endpoint} returned 404, trying next...`);
        continue;
      }

      // Se retornar 401/403, retorna erro
      if (response.status === 401 || response.status === 403) {
        const body = await response.text();
        return Response.json({
          ok: false,
          endpoint,
          status: response.status,
          body
        });
      }

      // Se retornar 200-299, sucesso!
      if (response.ok) {
        const data = await response.json();
        return Response.json({
          ok: true,
          endpoint,
          status: response.status,
          data
        });
      }

      // Outro erro
      const body = await response.text();
      return Response.json({
        ok: false,
        endpoint,
        status: response.status,
        body
      });
    }

    // Nenhum endpoint respondeu OK
    return Response.json({
      ok: false,
      message: "Nenhum endpoint respondeu"
    });
  } catch (error) {
    console.error("Error in coraWhoami:", error.message);
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});