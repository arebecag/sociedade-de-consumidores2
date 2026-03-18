import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar partner pelo email do usuário
    let partners = await base44.asServiceRole.entities.Partner.filter({ email: user.email });
    if (!partners.length) return Response.json({ error: 'Partner not found' }, { status: 404 });
    const partner = partners[0];

    if (partner.email_verified) {
      return Response.json({ success: true, message: 'Email já verificado' });
    }

    // Gerar novo código de 6 dígitos
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const codeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.Partner.update(partner.id, {
      email_change_code: verificationCode,
      email_change_expiry: codeExpiry
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: 'Seu código de verificação - Sociedade de Consumidores',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #09090b; color: #fff; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #f97316; margin: 0; font-size: 26px;">Sociedade de Consumidores</h1>
          </div>
          <h2 style="color: #f97316;">Olá, ${partner.full_name}!</h2>
          <p style="color: #d1d5db;">Use o código abaixo para verificar seu e-mail no Escritório Virtual:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background: #1c1917; border: 2px solid #f97316; border-radius: 12px; padding: 20px 40px;">
              <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px;">Código de verificação:</p>
              <p style="color: #f97316; font-size: 40px; font-weight: bold; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">Este código expira em 24 horas.</p>
          <hr style="border: none; border-top: 1px solid #374151; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            Dúvidas? WhatsApp (11) 95145-3200 | suporte@sociedadedeconsumidores.com.br
          </p>
        </div>
      `
    });

    console.log('[sendVerificationEmail] Código enviado para:', user.email);
    return Response.json({ success: true, message: 'Código de verificação enviado!' });

  } catch (error) {
    console.error('[sendVerificationEmail] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});