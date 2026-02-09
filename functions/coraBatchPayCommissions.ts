import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Processa em lote todos os withdrawals pendentes
 * Admin apenas - pode ser chamado manualmente ou via automação
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode executar pagamentos em lote
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Buscar todos withdrawals pendentes
    const pendingWithdrawals = await base44.asServiceRole.entities.Withdrawal.filter({ 
      status: 'pending' 
    });

    if (pendingWithdrawals.length === 0) {
      return Response.json({ 
        success: true,
        message: 'No pending withdrawals to process',
        processed: 0
      });
    }

    const results = {
      total: pendingWithdrawals.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Processar cada withdrawal
    for (const withdrawal of pendingWithdrawals) {
      try {
        const paymentResult = await base44.functions.invoke('coraPayCommission', {
          withdrawal_id: withdrawal.id
        });

        if (paymentResult.data?.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            withdrawal_id: withdrawal.id,
            partner_name: withdrawal.partner_name,
            error: paymentResult.data?.error || 'Unknown error'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          withdrawal_id: withdrawal.id,
          partner_name: withdrawal.partner_name,
          error: error.message
        });
      }

      // Delay entre pagamentos para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return Response.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error("Error in coraBatchPayCommissions:", error.message);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});