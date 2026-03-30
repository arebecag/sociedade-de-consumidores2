import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();
    const emailNormalized = email?.toLowerCase().trim();

    if (!emailNormalized) {
      return Response.json({ error: "E-mail é obrigatório" }, { status: 400 });
    }

    // Buscar usuário
    const users = await base44.asServiceRole.entities.LoginUser.filter({
      email: emailNormalized,
    });

    if (users.length === 0) {
      return Response.json(
        { error: "Usuário não encontrado" },
        { status: 404 },
      );
    }

    const user = users[0];
    const previousCodes =
      await base44.asServiceRole.entities.EmailVerificationCode.filter({
        user_id: user.id,
        used: false,
      });

    await Promise.all(
      previousCodes.map((item) =>
        base44.asServiceRole.entities.EmailVerificationCode.update(item.id, {
          used: true,
        }),
      ),
    );

    // Gerar novo código
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await base44.asServiceRole.entities.EmailVerificationCode.create({
      user_id: user.id,
      email: emailNormalized,
      code: verificationCode,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

    // Enviar email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: emailNormalized,
      subject: "Código de Verificação - Sociedade de Consumidores",
      body: `
        <h2>Código de Verificação</h2>
        <p>Seu código de verificação é:</p>
        <h1 style="color: #f97316; font-size: 32px; letter-spacing: 4px;">${verificationCode}</h1>
        <p>Este código expira em 24 horas.</p>
      `,
    });

    return Response.json({
      success: true,
      message: "Código enviado para o e-mail",
    });
  } catch (error) {
    console.error("[sendEmailVerificationCode] Erro:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
