/**
 * Helper compartilhado para integração Cora
 * NÃO é um endpoint Deno.serve, apenas funções auxiliares
 */

/**
 * Obtém access token via proxy mTLS
 */
export async function getCoraToken() {
  const proxyUrl = Deno.env.get("CORA_TOKEN_PROXY_URL");
  
  if (!proxyUrl) {
    throw new Error("CORA_TOKEN_PROXY_URL not configured");
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: Deno.env.get("CORA_CLIENT_ID"),
      client_secret: Deno.env.get("CORA_CLIENT_SECRET"),
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token proxy failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("Token proxy returned no access_token");
  }

  return data.access_token;
}

/**
 * Retorna base URL da API Cora (sem barra final)
 */
export function coraBaseUrl() {
  const url = Deno.env.get("CORA_API_URL") || "https://api.cora.com.br";
  return url.endsWith('/') ? url.slice(0, -1) : url;
}