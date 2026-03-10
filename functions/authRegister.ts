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

    if (!full_name || !email || !password) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Validar email único
    const existingUsers = await base44.asServiceRole.entities.LoginUser.filter({ email: email.toLowerCase() });
    if (existingUsers.length > 0) {
      return Response.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }

    // Hash da senha
    const password_hash = await hashPassword(password);

    // Criar LoginUser
    const loginUser = await base44.asServiceRole.entities.LoginUser.create({
      email: email.toLowerCase(),
      password_hash,
      full_name,
      status: 'pending',
      is_email_verified: false
    });

    // Gerar código de verificação
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await base44.asServiceRole.entities.EmailVerificationCode.create({
      user_id: loginUser.id,
      email: email.toLowerCase(),
      code: verificationCode,
      expires_at: expiresAt.toISOString(),
      used: false
    });

    // Enviar email de verificação
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: 'Verificação de E-mail - Sociedade de Consumidores',
        body: `
          <h2>Bem-vindo à Sociedade de Consumidores!</h2>
          <p>Seu código de verificação é:</p>
          <h1 style="color: #f97316; font-size: 32px; letter-spacing: 4px;">${verificationCode}</h1>
          <p>Este código expira em 24 horas.</p>
          <p>Se você não se cadastrou, ignore este e-mail.</p>
        `
      });
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
    }

    return Response.json({
      success: true,
      user_id: loginUser.id,
      message: 'Cadastro realizado! Verifique seu e-mail.'
    });

  } catch (error) {
    console.error('[authRegister] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});