import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, code } = await req.json();

    if (!email || !code) {
      return Response.json({ error: 'E-mail e código são obrigatórios' }, { status: 400 });
    }

    // Buscar código válido
    const codes = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      email: email.toLowerCase(),
      code,
      used: false
    });

    if (codes.length === 0) {
      return Response.json({ error: 'Código inválido ou já utilizado' }, { status: 400 });
    }

    const verificationCode = codes[0];

    // Verificar expiração
    if (new Date(verificationCode.expires_at) < new Date()) {
      return Response.json({ error: 'Código expirado' }, { status: 400 });
    }

    // Marcar código como usado
    await base44.asServiceRole.entities.EmailVerificationCode.update(verificationCode.id, {
      used: true
    });

    // Atualizar LoginUser
    const users = await base44.asServiceRole.entities.LoginUser.filter({ id: verificationCode.user_id });
    if (users.length > 0) {
      await base44.asServiceRole.entities.LoginUser.update(users[0].id, {
        is_email_verified: true,
        status: 'active'
      });
    }

    return Response.json({ success: true, message: 'E-mail verificado com sucesso!' });

  } catch (error) {
    console.error('[verifyEmailCode] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});