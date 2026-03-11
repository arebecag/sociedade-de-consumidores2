import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'E-mail é obrigatório' }, { status: 400 });
    }

    // Buscar usuário
    const users = await base44.asServiceRole.entities.LoginUser.filter({ 
      email: email.toLowerCase() 
    });

    if (users.length === 0) {
      // Por segurança, retornar sucesso mesmo se o usuário não existir
      return Response.json({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá as instruções' });
    }

    const user = users[0];

    // Gerar token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // 2 horas

    await base44.asServiceRole.entities.PasswordResetToken.create({
      user_id: user.id,
      email: email.toLowerCase(),
      token,
      expires_at: expiresAt.toISOString(),
      used: false
    });

    // Enviar email (não aguarda para evitar timeout)
    const resetCode = token.split('-')[0]; // Usar apenas primeira parte do UUID como código
    base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Redefinição de Senha - Sociedade de Consumidores',
      body: `
        <h2>Redefinição de Senha</h2>
        <p>Você solicitou a redefinição de senha.</p>
        <p>Seu código de redefinição é:</p>
        <h1 style="color: #f97316; font-size: 24px; letter-spacing: 2px;">${resetCode}</h1>
        <p>Este código expira em 2 horas.</p>
        <p>Se você não solicitou esta redefinição, ignore este e-mail.</p>
      `
    }).catch(err => console.error('[requestPasswordReset] Erro ao enviar email (não crítico):', err));

    return Response.json({ success: true, message: 'Instruções enviadas para o e-mail' });

  } catch (error) {
    console.error('[requestPasswordReset] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});