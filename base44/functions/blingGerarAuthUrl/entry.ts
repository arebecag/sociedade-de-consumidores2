import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const BLING_OAUTH_BASE_URL = "https://www.bling.com.br/Api/v3";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }

    const clientId = Deno.env.get("BLING_CLIENT_ID");
    const redirectUri = Deno.env.get("BLING_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      return Response.json(
        {
          error:
            "Configuração incompleta. Configure BLING_CLIENT_ID e BLING_REDIRECT_URI",
        },
        { status: 500 },
      );
    }

    // Gerar state aleatório para segurança
    const state = crypto.randomUUID();

    // Salvar state para validação posterior
    const integracoes =
      await base44.asServiceRole.entities.IntegracaoBling.list();

    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.IntegracaoBling.update(
        integracoes[0].id,
        {
          state_atual: state,
        },
      );
    } else {
      await base44.asServiceRole.entities.IntegracaoBling.create({
        state_atual: state,
        status_integracao: "desconectado",
      });
    }

    // Log do início
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: "auth_inicio",
      status: "sucesso",
      mensagem: "URL de autorização gerada",
      detalhes: { state },
    });

    // Montar URL de autorização do Bling
    const authUrl = new URL(`${BLING_OAUTH_BASE_URL}/oauth/authorize`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return Response.json({
      success: true,
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error("[blingGerarAuthUrl] Erro:", error);
    return Response.json(
      {
        error: error.message || "Erro ao gerar URL de autorização",
      },
      { status: 500 },
    );
  }
});
