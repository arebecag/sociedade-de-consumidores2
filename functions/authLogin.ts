import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Hash simples usando Web Crypto API nativa do Deno
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    // Buscar usuário
    const users = await base44.asServiceRole.entities.LoginUser.filter({ 
      email: email.toLowerCase() 
    });

    if (users.length === 0) {
      return Response.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    }

    const user = users[0];

    // Verificar senha
    const password_hash = await hashPassword(password);
    const isValid = password_hash === user.password_hash;
    if (!isValid) {
      return Response.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
    }

    // Verificar se conta está bloqueada
    if (user.status === 'blocked') {
      return Response.json({ error: 'Conta bloqueada. Entre em contato com o suporte.' }, { status: 403 });
    }

    // Gerar token de sessão
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    // Criar sessão
    await base44.asServiceRole.entities.LoginSession.create({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
      is_active: true
    });

    // Atualizar último login
    await base44.asServiceRole.entities.LoginUser.update(user.id, {
      last_login_at: new Date().toISOString()
    });

    // Buscar Partner vinculado
    let partner = null;
    if (user.partner_id) {
      const partners = await base44.asServiceRole.entities.Partner.filter({ id: user.partner_id });
      if (partners.length > 0) {
        partner = partners[0];
      }
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
        partner_id: user.partner_id
      },
      partner
    });

  } catch (error) {
    console.error('[authLogin] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});