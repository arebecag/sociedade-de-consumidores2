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

    // Buscar configurações EAD
    const configs = await base44.asServiceRole.entities.ConfiguracoesEAD.list();
    if (configs.length === 0) {
      return Response.json({ error: 'Configurações EAD não encontradas' }, { status: 500 });
    }
    const config = configs[0];
    const idTutorGlobal = config.idTutorGlobal || 259;
    const urlRedirecionamento = config.urlRedirecionamentoEAD || '';

    // Buscar parceiro/usuário
    const partners = await base44.asServiceRole.entities.Partner.filter({ created_by: user.email });
    if (partners.length === 0) {
      return Response.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }
    const partner = partners[0];

    // Buscar curso
    const cursos = await base44.asServiceRole.entities.CursosEAD.filter({ id: cursoId });
    if (cursos.length === 0) {
      return Response.json({ error: 'Curso não encontrado' }, { status: 404 });
    }
    const curso = cursos[0];

    // Verificar se a compra existe e está PROCESSANDO
    const compras = await base44.asServiceRole.entities.ComprasCursosEAD.filter({ id: compraId });
    if (compras.length === 0) {
      return Response.json({ error: 'Compra não encontrada' }, { status: 404 });
    }
    const compra = compras[0];
    if (compra.status !== 'PROCESSANDO') {
      return Response.json({ error: 'Compra já processada' }, { status: 400 });
    }

    const saveLog = async (acao, respostaAPI, sucesso) => {
      await base44.asServiceRole.entities.LogsIntegracaoEAD.create({
        usuarioId: partner.id,
        email: user.email,
        cursoId: cursoId,
        acao,
        respostaAPI: typeof respostaAPI === 'string' ? respostaAPI : JSON.stringify(respostaAPI),
        sucesso,
        data: new Date().toISOString()
      });
    };

    // 1. Verificar se aluno já existe
    const findRes = await fetch(GLOBALEAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "findAlunoByEmail",
        payload: { email: user.email }
      })
    });
    const findData = await findRes.json();
    await saveLog("FIND", findData, findRes.ok);

    let idAlunoGlobal = null;

    if (findData.code_return === 2 || findData.code_return === "2") {
      // Aluno não existe, criar
      const senha = Math.random().toString(36).slice(-8) + "A1";
      const createRes = await fetch(GLOBALEAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "createAluno",
          payload: {
            idtutor: idTutorGlobal,
            email: user.email,
            senha: senha,
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
        await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
          status: 'ERRO',
          mensagemErro: errMsg
        });
        return Response.json({ success: false, error: errMsg }, { status: 500 });
      }

      idAlunoGlobal = createData.id || createData.idaluno || createData.aluno?.id;
    } else {
      // Aluno já existe
      idAlunoGlobal = findData.id || findData.idaluno || findData.aluno?.id;
    }

    if (!idAlunoGlobal) {
      const errMsg = 'Não foi possível obter o ID do aluno na plataforma EAD';
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
        status: 'ERRO',
        mensagemErro: errMsg
      });
      return Response.json({ success: false, error: errMsg }, { status: 500 });
    }

    // 2. Vincular assinatura
    const vinculoRes = await fetch(GLOBALEAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "vinculaAlunoAssinatura",
        payload: {
          idaluno: idAlunoGlobal,
          idassinatura: curso.idAssinaturaGlobal
        }
      })
    });
    const vinculoData = await vinculoRes.json();
    await saveLog("VINCULO", vinculoData, vinculoRes.ok);

    if (!vinculoRes.ok || vinculoData.error) {
      const errMsg = vinculoData.message || vinculoData.error || 'Erro ao vincular assinatura na plataforma EAD';
      await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
        status: 'ERRO',
        mensagemErro: errMsg,
        idAlunoGlobal: idAlunoGlobal
      });
      return Response.json({ success: false, error: errMsg }, { status: 500 });
    }

    // Sucesso - atualizar compra
    await base44.asServiceRole.entities.ComprasCursosEAD.update(compraId, {
      status: 'LIBERADO',
      idAlunoGlobal: idAlunoGlobal
    });

    return Response.json({
      success: true,
      idAlunoGlobal,
      urlRedirecionamento
    });

  } catch (error) {
    console.error("Erro em liberarCursoIndividual:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});