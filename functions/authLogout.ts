import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token não fornecido' }, { status: 400 });
    }

    // Invalidar sessão
    const sessions = await base44.asServiceRole.entities.LoginSession.filter({ token });
    if (sessions.length > 0) {
      await base44.asServiceRole.entities.LoginSession.update(sessions[0].id, {
        is_active: false
      });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('[authLogout] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});