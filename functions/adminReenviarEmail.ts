import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { partnerId, partnerEmail, partnerName, origin } = await req.json();
    if (!partnerId || !partnerEmail) {
      return Response.json({ error: 'partnerId e partnerEmail obrigatórios' }, { status: 400 });
    }

    const secret = Deno.env.get('INTERNAL_SECRET') || 'default_secret';
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    const payload = `${partnerId}:${expiry}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
    const token = btoa(payload) + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));
    const safeToken = token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const appUrl = origin || req.headers.get('origin') || 'https://app.base44.com';
    const link = `${appUrl}?page=VerifyEmail&token=${safeToken}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: partnerEmail,
      subject: 'Bem-vindo(a)! Verifique seu email - Sociedade de Consumidores',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f97316;">Bem-vindo(a), ${partnerName || partnerEmail}!</h2>
          <p>Obrigado por se cadastrar na <strong>Sociedade de Consumidores</strong>.</p>
          <p>Para confirmar seu email e acessar sua conta, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" 
               style="background-color: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
              ✅ Verificar meu email e entrar
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Este link expira em 24 horas.</p>
          <p style="color: #666; font-size: 14px;">Se você não se cadastrou, ignore este email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Sociedade de Consumidores</p>
        </div>
      `
    });

    console.log('[adminReenviarEmail] Email enviado para:', partnerEmail);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[adminReenviarEmail] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});