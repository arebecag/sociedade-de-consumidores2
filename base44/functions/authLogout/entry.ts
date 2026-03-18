import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  // Com JWT, logout é apenas do lado do cliente (remover o token do localStorage)
  // Não precisamos invalidar nada no servidor
  return Response.json({ success: true });
});