import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GLOBALEAD_API = "https://ead-integration.vercel.app/api/globalEad";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { compraId, cursoId } = await req.json();

    if (!compraId || !cursoId) {
      return Response.json({ error: 'compraId e cursoId são obrigatórios' }, { status: 400 });
    }

    // Buscar parceiro, curso e compra em paralelo
    const [partners, cursos, compras] = await Promise.all([
      base44.asServiceRole.entities.Partner.filter({ created_by: user.email }),
      base44.asServiceRole.entities.CursosEAD.filter({ id: cursoId }),
      base44.asServiceRole.entities.ComprasCursosEAD.filter({ id: compraId })
    ]);

    if (!partners.length) return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    if (!cursos.length) return Response.json({ error: 'Curso não encontrado' }, { status: 404 });
    if (!compras.length) return Response.json({ error: 'Compra não encontrada' }, { status: 404 });

    const partner = partners[0];
    const curso = cursos[0];
    const compra = compras[0];

    // Idempotência: se já processada com sucesso, retornar sucesso
    if (compra.status === 'LIBERADO') {
      return Response.json({ success: true, idAlunoGlobal: compra.idAlunoGlobal, urlRedirecionamento: "https://globaleadflix.com.br/login" });
    }

    // Bloquear se não está PROCESSANDO
    if (compra.status !== 'PROCESSANDO') {
      return Response.json({ error: 'Compra em estado inválido: ' + compra.status }, { status: 400 });
    }

    // Verificar saldo fresco no banco (segurança)
    const saldoAtual = partner.bonus_for_purchases || 0;
    if (saldoAtual < curso.valorBonus) {
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
        status: 'ERRO',
        mensagemErro: `Saldo insuficiente: ${saldoAtual} < ${curso.valorBonus}`
      });
      return Response.json({ success: false, error: `Saldo insuficiente: disponível R$ ${saldoAtual}` }, { status: 400 });
    }

    // Verificar inadimplência: bloquear se não tem cobrança ativa CONFIRMED/RECEIVED
    const cobranças = await base44.asServiceRole.entities.Financeiro.filter({ userId: partner.id }, "-created_date", 5);
    const temAcessoAtivo = cobranças.some(c => ["CONFIRMED", "RECEIVED"].includes(c.status));
    if (!temAcessoAtivo) {
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
        status: 'ERRO',
        mensagemErro: 'Acesso bloqueado por inadimplência'
      });
      return Response.json({ success: false, error: 'Seu acesso está suspenso. Regularize o pagamento.' }, { status: 403 });
    }

    const saveLog = async (acao, respostaAPI, sucesso) => {
      await base44.asServiceRole.entities.LogsIntegracaoEAD.create({
        usuarioId: partner.id,
        email: user.email,
        cursoId,
        acao,
        respostaAPI: typeof respostaAPI === 'string' ? respostaAPI : JSON.stringify(respostaAPI),
        sucesso,
        data: new Date().toISOString()
      }).catch(e => console.error("Erro ao salvar log EAD:", e.message));
    };

    // 1. Verificar se aluno já existe na plataforma EAD
    const findRes = await fetch(GLOBALEAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "findAlunoByEmail", payload: { email: user.email } })
    });
    const findData = await findRes.json();
    await saveLog("FIND", findData, findRes.ok);

    let idAlunoGlobal = null;

    if (findData.code_return === 2 || findData.code_return === "2") {
      // Aluno não existe — criar
      const senha = Math.random().toString(36).slice(-8) + "A1";
      const createRes = await fetch(GLOBALEAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "createAluno",
          payload: {
            idtutor: 259,
            email: user.email,
            senha,
            nome: partner.full_name || user.full_name,
            telefone: partner.phone || "",
            status: 1
          }
        })
      });
      const createData = await createRes.json();
      await saveLog("CREATE", createData, createRes.ok);

      if (!createRes.ok || createData.error) {
        const errMsg = createData.message || createData.error || 'Erro ao criar aluno na plataforma EAD';
        await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, { status: 'ERRO', mensagemErro: errMsg });
        return Response.json({ success: false, error: errMsg }, { status: 500 });
      }
      idAlunoGlobal = createData.id || createData.idaluno || createData.aluno?.id;
    } else {
      idAlunoGlobal = findData.id || findData.idaluno || findData.aluno?.id;
    }

    if (!idAlunoGlobal) {
      const errMsg = 'Não foi possível obter o ID do aluno na plataforma EAD';
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, { status: 'ERRO', mensagemErro: errMsg });
      return Response.json({ success: false, error: errMsg }, { status: 500 });
    }

    // 2. Vincular assinatura na EAD
    const vinculoRes = await fetch(GLOBALEAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "vinculaAlunoAssinatura",
        payload: { idaluno: idAlunoGlobal, idassinatura: curso.idAssinaturaGlobal }
      })
    });
    const vinculoData = await vinculoRes.json();
    await saveLog("VINCULO", vinculoData, vinculoRes.ok);

    if (!vinculoRes.ok || vinculoData.error) {
      const errMsg = vinculoData.message || vinculoData.error || 'Erro ao vincular assinatura na plataforma EAD';
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, { status: 'ERRO', mensagemErro: errMsg, idAlunoGlobal });
      return Response.json({ success: false, error: errMsg }, { status: 500 });
    }

    // ✅ Matrícula confirmada — agora debitar saldo com segurança
    const saldoDepois = Math.max(0, saldoAtual - curso.valorBonus);

    await Promise.all([
      // Debitar bônus do parceiro
      base44.asServiceRole.entities.Partner.update(partner.id, {
        bonus_for_purchases: saldoDepois,
        total_spent_purchases: (partner.total_spent_purchases || 0) + curso.valorBonus
      }),
      // Marcar compra como LIBERADO
      base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
        status: 'LIBERADO',
        idAlunoGlobal
      }),
      // Registrar log financeiro de auditoria com saldoAntes/saldoDepois
      base44.asServiceRole.entities.LogsFinanceiro.create({
        tipo: "BONUS",
        userId: partner.id,
        userEmail: user.email,
        userName: partner.full_name,
        valor: curso.valorBonus,
        descricao: `BONUS_USADO_CURSO | Curso: ${curso.nome} | cursoId: ${cursoId} | compraId: ${compraId} | saldoAntes: ${saldoAtual.toFixed(2)} | saldoDepois: ${saldoDepois.toFixed(2)}`,
        referenciaId: compraId
      })
    ]);

    console.log(`Curso liberado: ${partner.full_name} -> ${curso.nome} (${curso.valorBonus} bônus debitados)`);

    return Response.json({
      success: true,
      idAlunoGlobal,
      urlRedirecionamento: "https://globaleadflix.com.br/login"
    });

  } catch (error) {
    console.error("Erro em liberarCursoIndividual:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});