import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId } = await req.json();
    
    if (!partnerId) {
      return Response.json({ error: 'partnerId required' }, { status: 400 });
    }

    // Avaliar status
    const evalResp = await base44.functions.invoke('evaluatePartnerStatus', { partnerId });
    
    if (!evalResp?.data?.ok) {
      return Response.json({ 
        ok: false, 
        error: 'Failed to evaluate status',
        details: evalResp?.data 
      });
    }

    const evaluation = evalResp.data;
    
    if (!evaluation.shouldUpdate) {
      return Response.json({
        ok: true,
        updated: false,
        message: 'Status already up to date',
        status: evaluation.currentStatus
      });
    }

    // Atualizar Partner
    await base44.asServiceRole.entities.Partner.update(partnerId, {
      status: evaluation.evaluatedStatus,
      pending_reasons: evaluation.reasons
    });

    // Enviar mensagem se mudou de status
    if (evaluation.currentStatus !== evaluation.evaluatedStatus) {
      await base44.functions.invoke('sendStatusChangedMessage', {
        partnerId,
        oldStatus: evaluation.currentStatus,
        newStatus: evaluation.evaluatedStatus,
        reasons: evaluation.reasons
      });
    }

    return Response.json({
      ok: true,
      updated: true,
      oldStatus: evaluation.currentStatus,
      newStatus: evaluation.evaluatedStatus,
      reasons: evaluation.reasons
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});