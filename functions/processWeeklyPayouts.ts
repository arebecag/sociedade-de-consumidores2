import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Processa pagamentos semanais de comissões
 * Deve ser executado toda segunda-feira 00:00-06:00
 * Admin only
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log("=== STARTING WEEKLY PAYOUTS ===");
    console.log("Execution time:", new Date().toISOString());

    // Buscar todos os parceiros ativos com saldo disponível
    const allPartners = await base44.asServiceRole.entities.Partner.list();
    const eligiblePartners = allPartners.filter(p => 
      p.status === "ativo" && 
      p.bonus_for_withdrawal > 0 && 
      p.pix_key
    );

    console.log(`Found ${eligiblePartners.length} eligible partners`);

    const results = {
      total: eligiblePartners.length,
      processed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const partner of eligiblePartners) {
      try {
        // Verificar se já existe saque pendente na mesma semana
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        weekStart.setHours(0, 0, 0, 0);

        const existingWithdrawals = await base44.asServiceRole.entities.Withdrawal.filter({
          partner_id: partner.id,
          status: "pending"
        });

        const recentWithdrawal = existingWithdrawals.find(w => {
          const withdrawalDate = new Date(w.created_date);
          return withdrawalDate >= weekStart;
        });

        if (recentWithdrawal) {
          console.log(`Skipping ${partner.full_name} - already has pending withdrawal this week`);
          results.skipped++;
          results.details.push({
            partner: partner.full_name,
            status: "skipped",
            reason: "pending_withdrawal_exists"
          });
          continue;
        }

        // Criar registro de saque
        const withdrawalAmount = partner.bonus_for_withdrawal;
        
        await base44.asServiceRole.entities.Withdrawal.create({
          partner_id: partner.id,
          partner_name: partner.full_name,
          amount: withdrawalAmount,
          pix_key: partner.pix_key,
          status: "pending"
        });

        // Processar pagamento via Cora
        const paymentResult = await base44.asServiceRole.functions.invoke('coraPayCommission', {
          partner_id: partner.id,
          amount: withdrawalAmount,
          pix_key: partner.pix_key
        });

        if (paymentResult.data.success) {
          results.processed++;
          results.details.push({
            partner: partner.full_name,
            amount: withdrawalAmount,
            status: "success"
          });
          console.log(`✅ Paid ${withdrawalAmount} to ${partner.full_name}`);
        } else {
          results.failed++;
          results.details.push({
            partner: partner.full_name,
            amount: withdrawalAmount,
            status: "failed",
            error: paymentResult.data.error
          });
          console.error(`❌ Failed to pay ${partner.full_name}:`, paymentResult.data.error);
        }

        // Delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        results.failed++;
        results.details.push({
          partner: partner.full_name,
          status: "error",
          error: error.message
        });
        console.error(`❌ Error processing ${partner.full_name}:`, error.message);
      }
    }

    console.log("=== WEEKLY PAYOUTS COMPLETED ===");
    console.log(`Processed: ${results.processed}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

    return Response.json({
      success: true,
      summary: {
        total_eligible: results.total,
        processed: results.processed,
        failed: results.failed,
        skipped: results.skipped
      },
      details: results.details
    });
  } catch (error) {
    console.error("❌ Error in processWeeklyPayouts:", error.message);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});