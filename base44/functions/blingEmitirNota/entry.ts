import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { partnerId, purchaseId, productName, amount } = await req.json();

    if (!partnerId || !amount) {
      return Response.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Buscar dados do parceiro
    const partner = await base44.asServiceRole.entities.Partner.get(partnerId);
    if (!partner) {
      return Response.json(
        { error: "Parceiro não encontrado" },
        { status: 404 },
      );
    }

    // Obter token válido do OAuth
    const tokenRes = await base44.functions.invoke("blingObterTokenValido", {});

    if (!tokenRes.data?.success || !tokenRes.data?.access_token) {
      return Response.json(
        {
          error: "Integração Bling não está conectada",
          message: "Conecte o Bling primeiro em Admin > Bling",
        },
        { status: 500 },
      );
    }

    const accessToken = tokenRes.data.access_token;

    // Preparar dados da nota fiscal (NFe de serviço - NFS-e)
    const notaData = {
      natureza_operacao: "Venda de mercadoria",
      data_emissao: new Date().toISOString().split("T")[0],
      tipo_documento: 1, // 1 = Saída
      cliente: {
        nome: partner.full_name,
        cpf_cnpj: partner.cpf?.replace(/\D/g, ""),
        email: partner.email,
        endereco: {
          logradouro: partner.address?.street || "",
          numero: partner.address?.number || "S/N",
          complemento: partner.address?.complement || "",
          bairro: partner.address?.neighborhood || "",
          cidade: partner.address?.city || "",
          uf: partner.address?.state || "",
          cep: partner.address?.cep?.replace(/\D/g, "") || "",
        },
      },
      itens: [
        {
          descricao: productName || "Produto Digital",
          quantidade: 1,
          valor_unitario: amount,
          codigo: purchaseId || "PROD001",
          tipo: "S", // S = Serviço
          origem: 0,
          ncm: "00", // Para serviços
          cfop: "5933", // Prestação de serviço
        },
      ],
      informacoes_adicionais_contribuinte:
        "Venda realizada através da plataforma Sociedade de Consumidores",
    };

    // Emitir nota no Bling (usando OAuth token)
    const response = await fetch("https://api.bling.com.br/Api/v3/nfe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "enable-jwt": "1",
      },
      body: JSON.stringify(notaData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[Bling] Erro ao emitir nota:", result);
      return Response.json(
        {
          error: "Erro ao emitir nota fiscal",
          details: result,
        },
        { status: response.status },
      );
    }

    console.log("[Bling] Nota emitida com sucesso:", result.data?.numero);

    // Registrar log da emissão
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: "api_call",
      status: "sucesso",
      mensagem: `Nota fiscal emitida: ${result.data?.numero || "N/A"}`,
      detalhes: {
        partnerId,
        numeroNota: result.data?.numero,
        chaveAcesso: result.data?.chave_acesso,
        purchaseId,
        productName,
        valor: amount,
      },
    });

    return Response.json({
      success: true,
      nota: {
        numero: result.data?.numero,
        chave_acesso: result.data?.chave_acesso,
        link_pdf: result.data?.link_pdf,
      },
    });
  } catch (error) {
    console.error("[blingEmitirNota] Erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
