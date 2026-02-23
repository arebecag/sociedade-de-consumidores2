import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { code } = await req.json();

    if (!code) {
      return Response.json({ error: 'Código não informado' }, { status: 400 });
    }

    // Usa service role para buscar sem autenticação
    const partners = await base44.asServiceRole.entities.Partner.filter({ unique_code: code });

    if (partners.length === 0) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    const p = partners[0];
    // Retorna apenas os campos públicos necessários
    return Response.json({
      id: p.id,
      display_name: p.display_name || p.full_name,
      unique_code: p.unique_code,
      status: p.status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});