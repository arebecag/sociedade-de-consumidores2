import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    // Buscar sessão ativa
    const sessions = await base44.asServiceRole.entities.LoginSession.filter({
      token,
      is_active: true
    });

    if (sessions.length === 0) {
      return Response.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const session = sessions[0];

    // Verificar expiração
    if (new Date(session.expires_at) < new Date()) {
      await base44.asServiceRole.entities.LoginSession.update(session.id, { is_active: false });
      return Response.json({ error: 'Sessão expirada' }, { status: 401 });
    }

    // Buscar usuário
    const users = await base44.asServiceRole.entities.LoginUser.filter({ id: session.user_id });
    if (users.length === 0) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const user = users[0];

    // Buscar Partner vinculado
    let partner = null;
    if (user.partner_id) {
      const partners = await base44.asServiceRole.entities.Partner.filter({ id: user.partner_id });
      if (partners.length > 0) {
        partner = partners[0];
      }
    }

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_email_verified: user.is_email_verified,
        status: user.status,
        partner_id: user.partner_id
      },
      partner
    });

  } catch (error) {
    console.error('[authMe] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});