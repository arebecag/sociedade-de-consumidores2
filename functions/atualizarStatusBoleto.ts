import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BONUS_PERCENTUAL = 0.20;

Deno.serve(async (req) => {
  try {
    // Proteção: só aceita chamadas internas via INTERNAL_SECRET
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const receivedSecret = req.headers.get("x-internal-secret");
    if (internalSecret && receivedSecret !== internalSecret) {
      console.warn("atualizarStatusBoleto: acesso não autorizado bloqueado");
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const paymentId = body.paymentId || body.payment?.id;
    const status = body.status || body.payment?.status;

    if (!paymentId) return Response.json({ received: true, skipped: "sem paymentId" });

    const boletos = await base44.asServiceRole.entities.Financeiro.filter({ asaasPaymentId: paymentId });
    if (!boletos.length) return Response.json({ received: true, skipped: "boleto não encontrado" });

    const boleto = boletos[0];
    const updateData = { status };

    if (["CONFIRMED", "RECEIVED"].includes(status)) {
      const agora = new Date().toISOString();
      updateData.dataPagamento = agora;
      updateData.acessoLiberado = true;

      // Liberar bônus apenas uma vez
      if (!boleto.bonusLiberado) {
        updateData.bonusLiberado = true;
        const valorBonus = (boleto.valor || 0) * BONUS_PERCENTUAL;
        updateData.valorBonus = valorBonus;

        const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: boleto.userId });
        if (parceiros.length > 0) {
          const p = parceiros[0];
          await base44.asServiceRole.entities.Partner.update(boleto.userId, {
            bonus_for_withdrawal: (p.bonus_for_withdrawal || 0) + valorBonus * 0.5,
            bonus_for_purchases: (p.bonus_for_purchases || 0) + valorBonus * 0.5,
            total_bonus_generated: (p.total_bonus_generated || 0) + valorBonus,
            first_purchase_done: true
          });

          await base44.asServiceRole.entities.BonusTransaction.create({
            partner_id: boleto.userId,
            partner_name: boleto.userName,
            purchase_id: boleto.id,
            type: "direct",
            percentage: BONUS_PERCENTUAL * 100,
            total_amount: valorBonus,
            amount_for_withdrawal: valorBonus * 0.5,
            amount_for_purchases: valorBonus * 0.5,
            status: "credited"
          });
        }
      }

    } else if (status === "OVERDUE") {
      updateData.acessoLiberado = false;
    }

    await base44.asServiceRole.entities.Financeiro.update(boleto.id, updateData);
    return Response.json({ received: true, updated: true, status, bonusLiberado: updateData.bonusLiberado || false });
  } catch (error) {
    console.error("atualizarStatusBoleto error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function gerarProximaCobranca(base44, boletoAtual, dataPagamento) {
  try {
    // Verificar se já existe PENDING para este usuário
    const pendentes = await base44.asServiceRole.entities.Financeiro.filter({
      userId: boletoAtual.userId,
      status: "PENDING"
    });
    if (pendentes.length > 0) return; // já tem próximo boleto

    // Calcular vencimento: +30 dias da data de pagamento
    const proximoVencimento = new Date(dataPagamento);
    proximoVencimento.setDate(proximoVencimento.getDate() + 30);
    const dataVencimento = proximoVencimento.toISOString().split("T")[0];

    // Criar cobrança na Asaas
    const cobrancaResp = await fetch(`${PROXY_URL}/api/criar-cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: boletoAtual.asaasCustomerId,
        billingType: "BOLETO",
        value: VALOR_PLANO,
        dueDate: dataVencimento,
        description: "Renovação Mensal - Sociedade de Consumidores"
      })
    });

    if (!cobrancaResp.ok) {
      const errText = await cobrancaResp.text();
      console.error("Erro ao gerar recorrência:", errText);
      // Registrar falha em LogsFinanceiro para visibilidade no admin
      await base44.asServiceRole.entities.LogsFinanceiro.create({
        tipo: "ESTORNO",
        userId: boletoAtual.userId,
        userEmail: boletoAtual.userEmail,
        userName: boletoAtual.userName,
        valor: 0,
        descricao: `RECORRENCIA_FALHOU: paymentId=${boletoAtual.asaasPaymentId} | erro=${errText}`,
        referenciaId: boletoAtual.id
      }).catch(e => console.error("Erro ao salvar log de falha:", e.message));
      return;
    }

    const cobrancaData = await cobrancaResp.json();

    await base44.asServiceRole.entities.Financeiro.create({
      userId: boletoAtual.userId,
      userEmail: boletoAtual.userEmail,
      userName: boletoAtual.userName,
      asaasCustomerId: boletoAtual.asaasCustomerId,
      asaasPaymentId: cobrancaData.id,
      valor: VALOR_PLANO,
      descricao: "Renovação Mensal - Sociedade de Consumidores",
      invoiceUrl: cobrancaData.invoiceUrl || cobrancaData.bankSlipUrl,
      bankSlipUrl: cobrancaData.bankSlipUrl,
      status: "PENDING",
      dataVencimento,
      tipoPagamento: "BOLETO",
      bonusLiberado: false,
      acessoLiberado: false
    });

    console.log(`Próxima cobrança gerada para ${boletoAtual.userName}: vencimento ${dataVencimento}`);
  } catch (err) {
    console.error("Erro ao gerar próxima cobrança:", err.message);
  }
}