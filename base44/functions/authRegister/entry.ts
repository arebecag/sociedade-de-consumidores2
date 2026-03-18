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
    const { full_name, email, password, referrer_id, referrer_name } = await req.json();

    // Validar campos obrigatórios
    if (!full_name || !email || !password) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Validar formato de email
    const emailNormalized = email.toLowerCase().trim();
    if (!/\S+@\S+\.\S+/.test(emailNormalized)) {
      return Response.json({ error: 'Formato de e-mail inválido' }, { status: 400 });
    }

    // Validar força da senha
    if (password.length < 8) {
      return Response.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 });
    }

    // Validar email único
    const existingUsers = await base44.asServiceRole.entities.LoginUser.filter({ email: emailNormalized });
    if (existingUsers.length > 0) {
      return Response.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }

    // Hash da senha
    const password_hash = await hashPassword(password);

    // Criar LoginUser com conta já ativa
    const loginUser = await base44.asServiceRole.entities.LoginUser.create({
      email: emailNormalized,
      password_hash,
      full_name: full_name.trim(),
      partner_id: null,
      status: 'active',
      is_email_verified: false
    });

    console.log('[authRegister] Usuário criado com sucesso:', loginUser.id);

    return Response.json({
      success: true,
      user_id: loginUser.id,
      email: emailNormalized,
      message: 'Cadastro realizado! Verifique seu e-mail.'
    });

  } catch (error) {
    console.error('[authRegister] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});