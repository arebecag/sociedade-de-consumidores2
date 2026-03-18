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
      return Response.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    const loginUser = users[0];

    // Buscar Partner vinculado via partner_id ou fallback por email
    let partner = null;
    try {
      if (loginUser.partner_id) {
        const partners = await base44.asServiceRole.entities.Partner.filter({ id: loginUser.partner_id });
        if (partners.length > 0) {
          partner = partners[0];
        }
      }
      
      // Fallback: buscar por email se não encontrou por partner_id (self-healing)
      if (!partner) {
        const partnersByEmail = await base44.asServiceRole.entities.Partner.filter({ 
          email: loginUser.email 
        });
        if (partnersByEmail.length > 0) {
          partner = partnersByEmail[0];
          
          // Reparar vínculo automaticamente
          if (!loginUser.partner_id) {
            await base44.asServiceRole.entities.LoginUser.update(loginUser.id, {
              partner_id: partner.id
            });
            console.log('[authMe] Self-healing: Partner vinculado via email:', partner.id);
          }
        }
      }
    } catch (e) {
      console.warn('[authMe] Erro ao buscar Partner:', e);
    }

    return Response.json({
      user: {
        id: loginUser.id,
        email: loginUser.email,
        full_name: loginUser.full_name,
        is_email_verified: loginUser.is_email_verified,
        status: loginUser.status,
        partner_id: loginUser.partner_id || partner?.id
      },
      partner
    });

  } catch (error) {
    console.error('[authMe] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});