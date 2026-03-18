import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Buscar todas as sessões ativas
    const sessions = await base44.asServiceRole.entities.LoginSession.filter({ 
      is_active: true 
    });

    const now = new Date();
    let cleaned = 0;

    for (const session of sessions) {
      if (new Date(session.expires_at) < now) {
        await base44.asServiceRole.entities.LoginSession.update(session.id, {
          is_active: false
        });
        cleaned++;
      }
    }

    console.log(`[cleanExpiredSessions] ${cleaned} sessões expiradas foram desativadas`);

    return Response.json({
      success: true,
      total_sessions: sessions.length,
      cleaned,
      message: `${cleaned} sessões expiradas foram limpas`
    });

  } catch (error) {
    console.error('[cleanExpiredSessions] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});