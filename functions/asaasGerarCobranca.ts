import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PROXY_URL = "https://arebecag-asaas-proxy.vercel.app";
const VALOR_PLANO = 97.00; // Valor padrão do plano

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { partnerId, cpf, valor, descricao, diasVencimento = 3 } = body;

    if (!partnerId) {
      return Response.json({ error: "partnerId obrigatório" }, { status: 400 });
    }

    // Verificar se já existe cobrança PENDING ativa para este parceiro
    const cobranças = await base44.asServiceRole.entities.Financeiro.filter({
      userId: partnerId,
      status: "PENDING"
    });

    if (cobranças.length > 0) {
      return Response.json({
        success: true,
        reutilizado: true,
        cobranca: cobranças[0],
        message: "Cobrança pendente já existente reutilizada"
      });
    }

    // Buscar dados do parceiro
    const partner = await base44.asServiceRole.entities.Partner.get(partnerId);
    if (!partner) {
      return Response.json({ error: "Parceiro não encontrado" }, { status: 404 });
    }

    const cpfLimpo = (cpf || partner.cpf || "").replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return Response.json({ error: "CPF inválido ou não informado" }, { status: 400 });
    }

    // 1. Criar ou buscar cliente na Asaas
    let asaasCustomerId = null;

    const clienteResp = await fetch(`${PROXY_URL}/api/criar-cliente`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: partner.full_name,
        cpfCnpj: cpfLimpo,
        email: user.email,
        mobilePhone: (partner.phone || "").replace(/\D/g, "")
      })
    });

    if (!clienteResp.ok) {
      const err = await clienteResp.text();
      // Se 401 trate especificamente
      if (clienteResp.status === 401) {
        return Response.json({ error: "Erro de autenticação com Asaas (401)" }, { status: 502 });
      }
      return Response.json({ error: `Erro ao criar cliente Asaas: ${err}` }, { status: 502 });
    }

    const clienteData = await clienteResp.json();
    asaasCustomerId = clienteData.id;

    // 2. Calcular data de vencimento
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + diasVencimento);
    const dataVencimento = vencimento.toISOString().split("T")[0];

    // 3. Criar cobrança na Asaas
    const cobrancaResp = await fetch(`${PROXY_URL}/api/criar-cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "BOLETO",
        value: valor || VALOR_PLANO,
        dueDate: dataVencimento,
        description: descricao || "Ativação de Plano - Sociedade de Consumidores"
      })
    });

    if (!cobrancaResp.ok) {
      const err = await cobrancaResp.text();
      return Response.json({ error: `Erro ao criar cobrança Asaas: ${err}` }, { status: 502 });
    }

    const cobrancaData = await cobrancaResp.json();

    // 4. Salvar no banco
    const financeiro = await base44.asServiceRole.entities.Financeiro.create({
      userId: partnerId,
      userEmail: user.email,
      userName: partner.full_name,
      asaasCustomerId,
      asaasPaymentId: cobrancaData.id,
      valor: valor || VALOR_PLANO,
      descricao: descricao || "Ativação de Plano",
      invoiceUrl: cobrancaData.invoiceUrl || cobrancaData.bankSlipUrl,
      bankSlipUrl: cobrancaData.bankSlipUrl,
      status: cobrancaData.status || "PENDING",
      dataVencimento,
      tipoPagamento: "BOLETO",
      bonusLiberado: false
    });

    return Response.json({
      success: true,
      cobranca: financeiro,
      invoiceUrl: financeiro.invoiceUrl,
      bankSlipUrl: financeiro.bankSlipUrl
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});