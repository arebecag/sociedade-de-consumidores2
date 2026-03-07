import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token } = body; // token = código de 6 dígitos

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return Response.json({ error: 'Código inválido' }, { status: 400 });
    }

    const code = token.trim();

    // Buscar partner pelo código de verificação
    const partners = await base44.asServiceRole.entities.Partner.filter({
      email_change_code: code
    });

    if (partners.length === 0) {
      return Response.json({ error: 'Código inválido ou já utilizado.' }, { status: 400 });
    }

    const partner = partners[0];

    // Verificar expiração
    if (partner.email_change_expiry) {
      const expiry = new Date(partner.email_change_expiry);
      if (Date.now() > expiry.getTime()) {
        return Response.json({ error: 'Código expirado. Solicite um novo código.' }, { status: 400 });
      }
    }

    // Marcar como verificado e limpar o código
    await base44.asServiceRole.entities.Partner.update(partner.id, {
      email_verified: true,
      email_change_code: null,
      email_change_expiry: null
    });

    console.log('[verifyEmail] Partner verificado por código:', partner.id, partner.email);
    return Response.json({ success: true, message: 'Parabéns, seu e-mail foi verificado!' });

  } catch (error) {
    console.error('[verifyEmail] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});