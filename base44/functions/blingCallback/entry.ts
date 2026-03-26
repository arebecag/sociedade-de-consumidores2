import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const BLING_API_BASE_URL = "https://api.bling.com.br/Api/v3";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Log do callback
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: "callback",
      status: error ? "erro" : "sucesso",
      mensagem: error ? `Erro no callback: ${error}` : "Callback recebido",
      detalhes: {
        code: code?.substring(0, 10) + "...",
        state,
        error,
        errorDescription,
      },
    });

    if (error) {
      return new Response(
        `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>❌ Erro na autorização</h1>
            <p>${errorDescription || error}</p>
            <a href="/AdminBling" style="color: #f97316;">Voltar para configurações</a>
          </body>
        </html>
      `,
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (!code || !state) {
      return Response.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    // Validar state
    const integracoes =
      await base44.asServiceRole.entities.IntegracaoBling.list();
    if (integracoes.length === 0 || integracoes[0].state_atual !== state) {
      await base44.asServiceRole.entities.LogIntegracaoBling.create({
        tipo: "erro",
        status: "erro",
        mensagem: "State inválido - possível ataque CSRF",
        detalhes: { state_recebido: state },
      });

      return Response.json({ error: "State inválido" }, { status: 400 });
    }

    // Trocar code por token
    const clientId = Deno.env.get("BLING_CLIENT_ID");
    const clientSecret = Deno.env.get("BLING_CLIENT_SECRET");
    const redirectUri = Deno.env.get("BLING_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Configuração incompleta");
    }

    // Montar Authorization Basic
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const tokenResponse = await fetch(`${BLING_API_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
        "enable-jwt": "1",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      await base44.asServiceRole.entities.LogIntegracaoBling.create({
        tipo: "troca_token",
        status: "erro",
        mensagem: "Erro ao trocar code por token",
        codigo_http: tokenResponse.status,
        erro: JSON.stringify(tokenData),
      });

      return new Response(
        `
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>❌ Erro ao obter token</h1>
            <p>${tokenData.error_description || tokenData.error || "Erro desconhecido"}</p>
            <a href="/AdminBling" style="color: #f97316;">Tentar novamente</a>
          </body>
        </html>
      `,
        {
          status: 500,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    // Calcular data de expiração
    const expiraEm = new Date(Date.now() + tokenData.expires_in * 1000);

    // Salvar tokens
    await base44.asServiceRole.entities.IntegracaoBling.update(
      integracoes[0].id,
      {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || "Bearer",
        expires_in: tokenData.expires_in,
        scope: tokenData.scope || "",
        expira_em: expiraEm.toISOString(),
        status_integracao: "conectado",
        data_autenticacao: new Date().toISOString(),
        ultimo_erro: null,
        state_atual: null,
      },
    );

    // Log de sucesso
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: "troca_token",
      status: "sucesso",
      mensagem: "Token obtido com sucesso",
      codigo_http: 200,
      detalhes: { expires_in: tokenData.expires_in, scope: tokenData.scope },
    });

    return new Response(
      `
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>✅ Integração conectada!</h1>
          <p>Bling foi conectado com sucesso.</p>
          <p style="color: #666; font-size: 14px;">Token expira em: ${expiraEm.toLocaleString("pt-BR")}</p>
          <a href="/AdminBling" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #f97316; color: white; text-decoration: none; border-radius: 8px;">
            Ir para Configurações
          </a>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch (error) {
    console.error("[blingCallback] Erro:", error);

    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.LogIntegracaoBling.create({
      tipo: "erro",
      status: "erro",
      mensagem: "Erro fatal no callback",
      erro: error.message,
    });

    return new Response(
      `
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>❌ Erro</h1>
          <p>${error.message}</p>
          <a href="/AdminBling" style="color: #f97316;">Voltar</a>
        </body>
      </html>
    `,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
});
