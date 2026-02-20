import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Dados bancários fixos da Cora para recebimento de TED
const DADOS_BANCARIOS = {
  banco: "Cora (403)",
  agencia: "0001",
  conta: "Consulte o admin",
  tipoConta: "Conta Corrente",
  cnpj: "Consulte o admin",
  favorecido: "Sociedade de Consumidores"
};

function gerarIdentificador() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `TED-${ano}${mes}${dia}-${rand}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { valor } = body;

    if (!valor || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
      return Response.json({ error: "Valor inválido" }, { status: 400 });
    }

    const identificadorPagamento = gerarIdentificador();

    const pagamento = await base44.entities.PagamentosTED.create({
      usuarioId: user.id,
      usuarioEmail: user.email,
      usuarioNome: user.full_name,
      valor: parseFloat(valor),
      identificadorPagamento,
      status: "aguardando_ted"
    });

    return Response.json({
      success: true,
      pagamentoId: pagamento.id,
      identificadorPagamento,
      valor: parseFloat(valor),
      dadosBancarios: DADOS_BANCARIOS,
      instrucoes: `Use o identificador ${identificadorPagamento} na descrição/mensagem do TED para identificação.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});