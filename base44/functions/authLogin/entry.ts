import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as jose from 'npm:jose@5.10.0';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('INTERNAL_SECRET') || 'sc3x3-secret-key-2024');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    const emailNormalized = email.toLowerCase().trim();

    const users = await base44.asServiceRole.entities.LoginUser.filter({ email: emailNormalized });
    if (users.length === 0) {
      return Response.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    }

    const user = users[0];

    const password_hash = await hashPassword(password);
    if (password_hash !== user.password_hash) {
      return Response.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    }

    if (user.status === 'blocked') {
      return Response.json({ error: 'Conta bloqueada. Entre em contato com o suporte.' }, { status: 403 });
    }

    // Gerar JWT (expira em 30 dias)
    const token = await new jose.SignJWT({ uid: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .setIssuedAt()
      .sign(JWT_SECRET);

    // Atualizar último login em background (não bloqueia resposta)
    base44.asServiceRole.entities.LoginUser.update(user.id, {
      last_login_at: new Date().toISOString()
    }).catch(() => {});

    // Buscar Partner
    let partner = null;
    try {
      if (user.partner_id) {
        const partners = await base44.asServiceRole.entities.Partner.filter({ id: user.partner_id });
        if (partners.length > 0) partner = partners[0];
      }
      if (!partner) {
        const partnersByEmail = await base44.asServiceRole.entities.Partner.filter({ email: emailNormalized });
        if (partnersByEmail.length > 0) {
          partner = partnersByEmail[0];
          base44.asServiceRole.entities.LoginUser.update(user.id, { partner_id: partner.id }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[authLogin] Erro ao buscar Partner:', e.message);
    }

    return Response.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_email_verified: user.is_email_verified,
        status: user.status,
        partner_id: user.partner_id || partner?.id
      },
      partner
    });

  } catch (error) {
    console.error('[authLogin] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});