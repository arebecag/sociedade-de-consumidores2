import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

// Hash simples usando Web Crypto API nativa do Deno
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { full_name, email, password, referrer_id, referrer_name } =
      await req.json();

    // Validar campos obrigatórios
    if (!full_name || !email || !password) {
      return Response.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 },
      );
    }

    // Validar formato de email
    const emailNormalized = email.toLowerCase().trim();
    if (!/\S+@\S+\.\S+/.test(emailNormalized)) {
      return Response.json(
        { error: "Formato de e-mail inválido" },
        { status: 400 },
      );
    }

    // Validar força da senha
    if (password.length < 8) {
      return Response.json(
        { error: "Senha deve ter no mínimo 8 caracteres" },
        { status: 400 },
      );
    }

    // Validar email único
    const existingUsers = await base44.asServiceRole.entities.LoginUser.filter({
      email: emailNormalized,
    });
    if (existingUsers.length > 0) {
      return Response.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }

    // Hash da senha
    const password_hash = await hashPassword(password);

    // Criar LoginUser com conta já ativa
    const loginUser = await base44.asServiceRole.entities.LoginUser.create({
      email: emailNormalized,
      password_hash,
      full_name: full_name.trim(),
      partner_id: null,
      status: "active",
      is_email_verified: false,
    });

    console.log("[authRegister] Usuário criado com sucesso:", loginUser.id);

    // Enviar código de verificação antes de concluir a resposta para detectar falhas de envio
    try {
      const previousCodes =
        await base44.asServiceRole.entities.EmailVerificationCode.filter({
          user_id: loginUser.id,
          used: false,
        });
      await Promise.all(
        previousCodes.map((item) =>
          base44.asServiceRole.entities.EmailVerificationCode.update(item.id, {
            used: true,
          }),
        ),
      );
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await base44.asServiceRole.entities.EmailVerificationCode.create({
        user_id: loginUser.id,
        email: emailNormalized,
        code: verificationCode,
        expires_at: expiresAt.toISOString(),
        used: false,
      });
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: emailNormalized,
        subject: "Código de Verificação - Sociedade de Consumidores",
        body: `<h2>Código de Verificação</h2><p>Bem-vindo(a)! Seu código de verificação é:</p><h1 style="color:#f97316;font-size:32px;letter-spacing:4px;">${verificationCode}</h1><p>Este código expira em 24 horas.</p>`,
      });
    } catch (e) {
      console.error(
        "[authRegister] Erro ao enviar código de verificação:",
        e.message,
      );
      await base44.asServiceRole.entities.LoginUser.delete(loginUser.id).catch(
        () => {},
      );
      return Response.json(
        {
          error:
            "Não foi possível enviar o e-mail de verificação. Confirme o endereço informado e tente novamente.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      user_id: loginUser.id,
      email: emailNormalized,
      message: "Cadastro realizado! Verifique seu e-mail.",
    });
  } catch (error) {
    console.error("[authRegister] Erro:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
