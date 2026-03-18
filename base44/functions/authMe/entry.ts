import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as jose from 'npm:jose@5.10.0';

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('INTERNAL_SECRET') || 'sc3x3-secret-key-2024');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    // Verificar JWT (sem acesso ao banco)
    let payload;
    try {
      const result = await jose.jwtVerify(token, JWT_SECRET);
      payload = result.payload;
    } catch (e) {
      return Response.json({ error: 'Token inválido ou expirado' }, { status: 401 });
    }

    const userId = payload.uid;
    if (!userId) {
      return Response.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar usuário pelo ID
    const users = await base44.asServiceRole.entities.LoginUser.filter({ id: userId });
    if (users.length === 0) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    const loginUser = users[0];

    if (loginUser.status === 'blocked') {
      return Response.json({ error: 'Conta bloqueada' }, { status: 403 });
    }

    // Buscar Partner
    let partner = null;
    try {
      if (loginUser.partner_id) {
        const partners = await base44.asServiceRole.entities.Partner.filter({ id: loginUser.partner_id });
        if (partners.length > 0) partner = partners[0];
      }
      if (!partner) {
        const partnersByEmail = await base44.asServiceRole.entities.Partner.filter({ email: loginUser.email });
        if (partnersByEmail.length > 0) {
          partner = partnersByEmail[0];
          base44.asServiceRole.entities.LoginUser.update(loginUser.id, { partner_id: partner.id }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[authMe] Erro ao buscar Partner:', e.message);
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