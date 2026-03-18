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
    const { email, token, newPassword } = await req.json();

    if (!email || !token || !newPassword) {
      return Response.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // Buscar token válido
    const tokens = await base44.asServiceRole.entities.PasswordResetToken.filter({
      email: email.toLowerCase(),
      used: false
    });

    // Procurar token que comece com o código fornecido
    const validToken = tokens.find(t => t.token.startsWith(token) && new Date(t.expires_at) > new Date());

    if (!validToken) {
      return Response.json({ error: 'Código inválido ou expirado' }, { status: 400 });
    }

    // Marcar token como usado
    await base44.asServiceRole.entities.PasswordResetToken.update(validToken.id, {
      used: true
    });

    // Atualizar senha
    const password_hash = await hashPassword(newPassword);
    await base44.asServiceRole.entities.LoginUser.update(validToken.user_id, {
      password_hash
    });

    return Response.json({ success: true, message: 'Senha redefinida com sucesso!' });

  } catch (error) {
    console.error('[resetPassword] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});