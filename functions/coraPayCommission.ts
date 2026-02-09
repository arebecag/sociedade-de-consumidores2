import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Executa pagamento de comissão via PIX usando API Cora
 * Payload: { withdrawal_id: string }
 * Admin apenas
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode executar pagamentos
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { withdrawal_id } = await req.json();

    if (!withdrawal_id) {
      return Response.json({ error: 'withdrawal_id is required' }, { status: 400 });
    }

    // Buscar Withdrawal
    const withdrawals = await base44.asServiceRole.entities.Withdrawal.filter({ 
      id: withdrawal_id 
    });

    if (withdrawals.length === 0) {
      return Response.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const withdrawal = withdrawals[0];

    // Validação: apenas withdrawals pendentes
    if (withdrawal.status !== 'pending') {
      return Response.json({ 
        error: `Withdrawal already processed with status: ${withdrawal.status}` 
      }, { status: 400 });
    }

    // Buscar Partner
    const partners = await base44.asServiceRole.entities.Partner.filter({ 
      id: withdrawal.partner_id 
    });

    if (partners.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];

    // Validação 1: partner ativo
    if (partner.status !== 'ativo') {
      await base44.asServiceRole.entities.Withdrawal.update(withdrawal_id, {
        status: 'cancelled'
      });
      return Response.json({ 
        error: 'Partner is not active',
        withdrawal_status: 'cancelled'
      }, { status: 400 });
    }

    // Validação 2: PIX configurado
    if (!partner.pix_key || !partner.pix_key_type) {
      await base44.asServiceRole.entities.Withdrawal.update(withdrawal_id, {
        status: 'cancelled'
      });
      return Response.json({ 
        error: 'Partner PIX not configured',
        withdrawal_status: 'cancelled'
      }, { status: 400 });
    }

    // Marcar como processando
    await base44.asServiceRole.entities.Withdrawal.update(withdrawal_id, {
      status: 'processing'
    });

    // Obter token Cora
    const authRes = await base44.functions.invoke('coraAuth', {});
    if (!authRes.data.access_token) {
      await base44.asServiceRole.entities.Withdrawal.update(withdrawal_id, {
        status: 'pending'
      });
      return Response.json({ error: 'Failed to authenticate with Cora' }, { status: 500 });
    }

    const token = authRes.data.access_token;
    const apiUrl = Deno.env.get("CORA_API_URL") || "https://api.cora.com.br";

    // Criar identificador único para idempotência
    const idempotencyKey = `WITHDRAWAL_${withdrawal_id}`;

    // Executar PIX via Cora
    const pixData = {
      idempotency_key: idempotencyKey,
      amount: Math.round(withdrawal.amount * 100), // em centavos
      description: `Pagamento de comissão - ${partner.full_name}`,
      pix_key: {
        type: partner.pix_key_type.toUpperCase(),
        key: partner.pix_key
      },
      debtor: {
        name: partner.full_name,
        document: partner.cpf
      }
    };

    const pixResponse = await fetch(`${apiUrl}/pix/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(pixData)
    });

    if (!pixResponse.ok) {
      const errorText = await pixResponse.text();
      console.error("Cora PIX payment failed:", errorText);
      
      // Marcar como erro
      await base44.asServiceRole.entities.Withdrawal.update(withdrawal_id, {
        status: 'cancelled',
        error_message: `PIX payment failed: ${errorText}`
      });

      return Response.json({ 
        error: 'Failed to execute PIX payment',
        details: errorText,
        withdrawal_status: 'cancelled'
      }, { status: pixResponse.status });
    }

    const pixResult = await pixResponse.json();

    // Atualizar Withdrawal como completo
    await base44.asServiceRole.entities.Withdrawal.update(withdrawal_id, {
      status: 'completed',
      completed_date: new Date().toISOString(),
      transaction_id: pixResult.id,
      end_to_end_id: pixResult.end_to_end_id
    });

    // Atualizar saldo do Partner
    await base44.asServiceRole.entities.Partner.update(partner.id, {
      total_withdrawn: (partner.total_withdrawn || 0) + withdrawal.amount
    });

    return Response.json({
      success: true,
      withdrawal: {
        id: withdrawal_id,
        status: 'completed',
        amount: withdrawal.amount,
        transaction_id: pixResult.id,
        end_to_end_id: pixResult.end_to_end_id
      }
    });
  } catch (error) {
    console.error("Error in coraPayCommission:", error.message);
    
    // Tentar reverter status para pending em caso de erro
    try {
      const body = await req.json();
      await base44.asServiceRole.entities.Withdrawal.update(body.withdrawal_id, {
        status: 'pending',
        error_message: error.message
      });
    } catch (e) {
      console.error("Failed to revert withdrawal status:", e.message);
    }

    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
});