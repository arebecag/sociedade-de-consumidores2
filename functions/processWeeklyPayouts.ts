import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todos os parceiros ativos com saldo para saque
    const partners = await base44.asServiceRole.entities.Partner.filter({
      status: 'ativo'
    });

    const eligiblePartners = partners.filter(p => 
      (p.bonus_for_withdrawal || 0) >= 50 // Mínimo R$50 para saque
    );

    const results = [];
    const coraAvailable = false; // Simular enquanto API retorna 403

    for (const partner of eligiblePartners) {
      const amount = partner.bonus_for_withdrawal;

      if (coraAvailable) {
        // TODO: Quando Cora liberar, implementar pagamento real
        // const paymentResult = await base44.functions.invoke('coraPayCommission', {
        //   pixKey: partner.pix_key,
        //   amount: amount
        // });
      }

      // Criar registro de saque
      const withdrawal = await base44.asServiceRole.entities.Withdrawal.create({
        partner_id: partner.id,
        partner_name: partner.full_name,
        amount: amount,
        pix_key: partner.pix_key,
        status: coraAvailable ? 'completed' : 'pending',
        completed_date: coraAvailable ? new Date().toISOString() : null
      });

      // Atualizar Partner
      await base44.asServiceRole.entities.Partner.update(partner.id, {
        bonus_for_withdrawal: 0,
        total_withdrawn: (partner.total_withdrawn || 0) + amount
      });

      // Enviar notificação
      try {
        await base44.integrations.Core.SendEmail({
          to: partner.created_by,
          subject: '💰 Pagamento Semanal Processado',
          body: `
Olá ${partner.full_name},

Seu pagamento semanal foi processado!

Valor: R$ ${amount.toFixed(2)}
Chave PIX: ${partner.pix_key}
Status: ${coraAvailable ? 'Pago' : 'Pendente (aguardando liberação Cora)'}

${coraAvailable ? 'O valor já foi transferido para sua conta.' : 'Assim que a integração Cora for liberada, o pagamento será realizado automaticamente.'}

Equipe Sociedade de Consumidores
          `.trim()
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      results.push({
        partnerId: partner.id,
        partnerName: partner.full_name,
        amount: amount,
        status: withdrawal.status
      });
    }

    return Response.json({
      ok: true,
      processed: results.length,
      totalAmount: results.reduce((sum, r) => sum + r.amount, 0),
      results,
      note: coraAvailable ? 'Payments completed' : 'Payments pending - Cora API awaiting authorization'
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});