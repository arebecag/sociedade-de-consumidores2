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

    // Criar LoginUser (sem partner_id ainda - será definido depois)
    const loginUser = await base44.asServiceRole.entities.LoginUser.create({
      email: emailNormalized,
      password_hash,
      full_name: full_name.trim(),
      partner_id: null, // Será vinculado depois que o Partner for criado
      status: 'pending',
      is_email_verified: false
    });

    // Gerar código de verificação
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await base44.asServiceRole.entities.EmailVerificationCode.create({
      user_id: loginUser.id,
      email: emailNormalized,
      code: verificationCode,
      expires_at: expiresAt.toISOString(),
      used: false
    });

    // Se não tiver indicador (será vinculado ao Eder), ativar automaticamente
    if (!referrer_id) {
      await base44.asServiceRole.entities.LoginUser.update(loginUser.id, {
        is_email_verified: true,
        status: 'active'
      });
      console.log('[authRegister] Usuário sem indicador, conta ativada automaticamente');
    } else {
      // Enviar email de verificação apenas se tiver indicador
      // NOTA: Para receber emails, o usuário precisa estar convidado no Base44 via dashboard
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: emailNormalized,
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
        // Se falhar ao enviar, ativar mesmo assim
        await base44.asServiceRole.entities.LoginUser.update(loginUser.id, {
          is_email_verified: true,
          status: 'active'
        });
        console.log('[authRegister] Falha ao enviar email, conta ativada automaticamente');
      }
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