import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) return Response.json({ error: 'Token inválido' }, { status: 400 });

    const secret = Deno.env.get('INTERNAL_SECRET') || 'default_secret';

    // Decode token
    const safeToken = token.replace(/-/g, '+').replace(/_/g, '/');
    const dotIndex = safeToken.lastIndexOf('.');
    if (dotIndex === -1) return Response.json({ error: 'Token inválido' }, { status: 400 });

    const encodedPayload = safeToken.substring(0, dotIndex);
    const encodedSig = safeToken.substring(dotIndex + 1);

    let payload, partnerId, expiry;
    try {
      payload = atob(encodedPayload);
      [partnerId, expiry] = payload.split(':');
      expiry = parseInt(expiry);
    } catch {
      return Response.json({ error: 'Token inválido' }, { status: 400 });
    }

    // Check expiry
    if (Date.now() > expiry) {
      return Response.json({ error: 'Token expirado. Solicite um novo email de verificação.' }, { status: 400 });
    }

    // Verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const expectedSig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
    const expectedSigB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    if (encodedSig !== expectedSigB64) {
      return Response.json({ error: 'Token inválido ou adulterado' }, { status: 400 });
    }

    // Mark partner as verified using service role (não precisa de auth do usuário)
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.Partner.update(partnerId, { email_verified: true });
    console.log('[verifyEmail] Partner verificado:', partnerId);

    return Response.json({ success: true, message: 'Email verificado com sucesso!' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});