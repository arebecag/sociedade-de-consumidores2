import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    // Testar diferentes formas de convidar
    console.log('[testInvite] Testando convite para:', email);
    
    try {
      const result = await base44.asServiceRole.users.invite({ email, role: "user" });
      console.log('[testInvite] Sucesso método 1:', result);
      return Response.json({ success: true, method: 1, result });
    } catch (e1) {
      console.log('[testInvite] Erro método 1:', e1.message);
      
      try {
        const result = await base44.users.invite(email, "user");
        console.log('[testInvite] Sucesso método 2:', result);
        return Response.json({ success: true, method: 2, result });
      } catch (e2) {
        console.log('[testInvite] Erro método 2:', e2.message);
        return Response.json({ 
          error: 'Ambos falharam', 
          error1: e1.message, 
          error2: e2.message 
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('[testInvite] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});