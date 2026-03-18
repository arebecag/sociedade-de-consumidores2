import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { dryRun = false, campanhaId } = await req.json();

    const logInicio = {
      dataProcessamento: new Date().toISOString(),
      tipoProcessamento: dryRun ? 'dry-run' : 'manual',
      campanhaId: campanhaId || null,
      status: 'sucesso',
      mensagem: '',
      detalhesTecnicos: {},
      parceirosProcessados: 0,
      recompensasGeradas: 0,
      erros: []
    };

    // Buscar campanha ativa
    let campanha;
    if (campanhaId) {
      campanha = await base44.asServiceRole.entities.CampanhasIncentivo.get(campanhaId);
    } else {
      const campanhas = await base44.asServiceRole.entities.CampanhasIncentivo.filter({
        ativa: true,
        nomeCampanha: 'Desafio 12+12+12'
      });
      campanha = campanhas[0];
    }

    if (!campanha) {
      logInicio.status = 'erro';
      logInicio.mensagem = 'Nenhuma campanha ativa encontrada';
      await base44.asServiceRole.entities.LogIntegracaoCampanha.create(logInicio);
      return Response.json({ error: 'Campanha não encontrada', log: logInicio }, { status: 404 });
    }

    // Verificar se campanha já expirou
    const dataFim = new Date(campanha.dataFim);
    const hoje = new Date();
    if (hoje > dataFim) {
      logInicio.status = 'erro';
      logInicio.mensagem = 'Campanha já encerrada';
      await base44.asServiceRole.entities.LogIntegracaoCampanha.create(logInicio);
      return Response.json({ error: 'Campanha encerrada', dataFim: campanha.dataFim }, { status: 400 });
    }

    // Buscar todos os parceiros ativos
    const parceiros = await base44.asServiceRole.entities.Partner.list(null, 1000);
    const parceirosValidos = parceiros.filter(p => p.unique_code && p.status === 'ativo');

    // Buscar TODAS as relações diretas de uma vez (otimização)
    const todasRelacoesDiretas = await base44.asServiceRole.entities.NetworkRelation.filter({
      relation_type: 'direct'
    });

    // Montar mapa: referrer_id -> array de referred_ids diretos
    const mapaRelacoesDiretas = {};
    for (const rel of todasRelacoesDiretas) {
      if (!mapaRelacoesDiretas[rel.referrer_id]) mapaRelacoesDiretas[rel.referrer_id] = [];
      mapaRelacoesDiretas[rel.referrer_id].push(rel.referred_id);
    }

    // Mapa de id -> parceiro para lookup rápido
    const mapaParceiros = {};
    for (const p of parceiros) mapaParceiros[p.id] = p;

    logInicio.parceirosProcessados = parceirosValidos.length;
    const resultados = [];
    let totalRecompensasGeradas = 0;

    // Processar cada parceiro
    for (const parceiro of parceirosValidos) {
      try {
        // Contar APENAS clientes diretos (onde o parceiro é o indicador) que estão ATIVOS
        const idsDirectos = mapaRelacoesDiretas[parceiro.id] || [];
        const clientesAtivosIds = idsDirectos.filter(id => {
          const p = mapaParceiros[id];
          return p && p.status === 'ativo';
        });

        const totalClientes = clientesAtivosIds.length;
        const blocosFechados = Math.floor(totalClientes / campanha.quantidadeNecessaria);
        const valorTotal = blocosFechados * campanha.valorPremio;

        // Buscar participante existente
        const participantes = await base44.asServiceRole.entities.CampanhaParticipantes.filter({
          campanhaId: campanha.id,
          parceiroId: parceiro.id
        });

        let participante = participantes[0];
        const blocosFechadosAnteriormente = participante?.totalBlocosFechados || 0;
        const novosBlocos = blocosFechados - blocosFechadosAnteriormente;

        if (!dryRun) {
          if (participante) {
            await base44.asServiceRole.entities.CampanhaParticipantes.update(participante.id, {
              totalClientesAtivos: totalClientes,
              totalBlocosFechados: blocosFechados,
              valorTotalPremiado: valorTotal,
              dataUltimaAtualizacao: new Date().toISOString(),
              clientesAtivosIds: clientesAtivosIds
            });
          } else {
            await base44.asServiceRole.entities.CampanhaParticipantes.create({
              campanhaId: campanha.id,
              parceiroId: parceiro.id,
              nomeParceiro: parceiro.full_name,
              emailParceiro: parceiro.email,
              totalClientesAtivos: totalClientes,
              totalBlocosFechados: blocosFechados,
              valorTotalPremiado: valorTotal,
              dataUltimaAtualizacao: new Date().toISOString(),
              clientesAtivosIds: clientesAtivosIds
            });
          }

          // Gerar recompensas para novos blocos
          for (let i = 1; i <= novosBlocos; i++) {
            const blocoNumero = blocosFechadosAnteriormente + i;
            await base44.asServiceRole.entities.CampanhaRecompensas.create({
              campanhaId: campanha.id,
              parceiroId: parceiro.id,
              nomeParceiro: parceiro.full_name,
              blocoNumero,
              quantidadeClientesConsiderada: totalClientes,
              valorPremio: campanha.valorPremio,
              dataGeracao: new Date().toISOString(),
              statusPagamento: 'pendente',
              observacao: `Bloco ${blocoNumero} fechado - ${totalClientes} clientes diretos ativos`,
              notificacaoEnviada: false
            });
            totalRecompensasGeradas++;

            await enviarNotificacaoPremio(base44, parceiro, blocoNumero, campanha.valorPremio);
          }
        }

        resultados.push({
          parceiro: parceiro.full_name,
          email: parceiro.email,
          clientesDiretosAtivos: totalClientes,
          blocosFechados,
          novosBlocos,
          valorTotal,
          faltamClientes: campanha.quantidadeNecessaria - (totalClientes % campanha.quantidadeNecessaria)
        });

      } catch (error) {
        console.error(`[Campanha] Erro ao processar ${parceiro.full_name}:`, error);
        logInicio.erros.push(`${parceiro.full_name}: ${error.message}`);
      }
    }

    logInicio.recompensasGeradas = totalRecompensasGeradas;
    logInicio.mensagem = dryRun
      ? `Simulação: ${totalRecompensasGeradas} recompensas seriam geradas`
      : `Processamento concluído: ${totalRecompensasGeradas} recompensas geradas`;
    logInicio.detalhesTecnicos = { resultados };

    if (logInicio.erros.length > 0) logInicio.status = 'parcial';

    if (!dryRun) {
      await base44.asServiceRole.entities.LogIntegracaoCampanha.create(logInicio);
    }

    return Response.json({
      success: true,
      dryRun,
      campanha: campanha.nomeCampanha,
      parceirosProcessados: logInicio.parceirosProcessados,
      recompensasGeradas: totalRecompensasGeradas,
      resultados,
      erros: logInicio.erros,
      log: logInicio
    });

  } catch (error) {
    console.error('[processarCampanha12x12] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function enviarNotificacaoPremio(base44, parceiro, blocoNumero, valor) {
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: parceiro.email,
      subject: `🎉 Parabéns! Você conquistou R$ ${valor.toFixed(2)}!`,
      body: `
        <h2>🎉 Desafio 12+12+12</h2>
        <p>Olá, <strong>${parceiro.full_name}</strong>!</p>
        <p>Parabéns! Você fechou o <strong>bloco ${blocoNumero}</strong> e conquistou <strong>R$ ${valor.toFixed(2)}</strong>!</p>
        <p>Continue trazendo novos clientes ativos para conquistar mais prêmios!</p>
        <p>A cada 12 clientes que <strong>você indicou diretamente</strong> e que estão ATIVOS, você ganha R$ 800,00 via PIX.</p>
        <p><em>Esta campanha termina em 15/04/2026.</em></p>
      `
    });
  } catch (error) {
    console.error('[Notificação] Erro ao enviar email:', error);
  }
}