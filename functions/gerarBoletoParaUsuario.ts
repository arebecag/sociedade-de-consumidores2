import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PROXY_URL = "https://arebecag-asaas-proxy.vercel.app";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const { userId, valor, descricao, dataVencimento } = await req.json();
    if (!userId || !valor || !dataVencimento) {
      return Response.json({ error: "userId, valor e dataVencimento são obrigatórios" }, { status: 400 });
    }

    // 1. Verificar se já existe boleto PENDING para esta descrição específica (não reutilizar para compras diferentes)
    const existentes = await base44.asServiceRole.entities.Financeiro.filter({ userId, status: "PENDING" });
    const mesmaDescricao = existentes.find(e => e.descricao === (descricao || "Compra de Produtos"));
    if (mesmaDescricao) {
      return Response.json({ success: true, reutilizado: true, boleto: mesmaDescricao });
    }

    // 2. Buscar dados do parceiro
    const parceiros = await base44.asServiceRole.entities.Partner.filter({ id: userId });
    if (!parceiros.length) return Response.json({ error: "Parceiro não encontrado" }, { status: 404 });
    const partner = parceiros[0];

    // 3. Validar CPF
    const cpfLimpo = (partner.cpf || "").replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return Response.json({ error: "CPF inválido ou não cadastrado. Atualize seu perfil." }, { status: 400 });
    }

    // 4. Criar cliente na Asaas
    const clienteResp = await fetch(`${PROXY_URL}/api/criar-cliente`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: partner.full_name,
        cpfCnpj: cpfLimpo,
        email: user.email,
        mobilePhone: (partner.phone || "").replace(/\D/g, ""),
        address: partner.address?.street || undefined,
        addressNumber: partner.address?.number || undefined,
        complement: partner.address?.complement || undefined,
        province: partner.address?.neighborhood || undefined,
        postalCode: (partner.address?.cep || "").replace(/\D/g, "") || undefined,
        city: partner.address?.city || undefined,
        state: partner.address?.state || undefined
      })
    });

    if (clienteResp.status === 401) {
      return Response.json({ error: "Erro de autenticação com Asaas (401)" }, { status: 502 });
    }
    if (!clienteResp.ok) {
      const err = await clienteResp.text();
      console.error("Asaas criar-cliente error:", err);
      return Response.json({ error: `Erro ao criar cliente: ${err}` }, { status: 502 });
    }
    const clienteData = await clienteResp.json();
    const asaasCustomerId = clienteData.id;

    // 5. Criar cobrança na Asaas
    const cobrancaResp = await fetch(`${PROXY_URL}/api/criar-cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "BOLETO",
        value: valor,
        dueDate: dataVencimento,
        description: descricao || "Compra de Produtos - Sociedade de Consumidores"
      })
    });

    if (cobrancaResp.status === 401) {
      return Response.json({ error: "Erro de autenticação com Asaas ao criar cobrança (401)" }, { status: 502 });
    }
    if (!cobrancaResp.ok) {
      const err = await cobrancaResp.text();
      console.error("Asaas criar-cobranca error:", err);
      return Response.json({ error: `Erro ao criar cobrança: ${err}` }, { status: 502 });
    }
    const cobrancaData = await cobrancaResp.json();

    // 6. Salvar no banco
    const boleto = await base44.asServiceRole.entities.Financeiro.create({
      userId,
      userEmail: user.email,
      userName: partner.full_name,
      asaasCustomerId,
      asaasPaymentId: cobrancaData.id,
      valor,
      descricao: descricao || "Compra de Produtos",
      invoiceUrl: cobrancaData.invoiceUrl || cobrancaData.bankSlipUrl,
      bankSlipUrl: cobrancaData.bankSlipUrl,
      status: cobrancaData.status || "PENDING",
      dataVencimento,
      tipoPagamento: "BOLETO",
      bonusLiberado: false
    });

    return Response.json({ success: true, reutilizado: false, boleto });
  } catch (error) {
    console.error("gerarBoletoParaUsuario error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});