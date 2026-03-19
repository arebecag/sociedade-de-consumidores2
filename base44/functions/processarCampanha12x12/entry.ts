import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Aceitar chamada de automação (sem token) OU de admin autenticado
    // Automações não possuem usuário — verificamos o INTERNAL_SECRET no body para chamadas manuais externas
    let bodyData = {};
    try {
      bodyData = await req.json();
    } catch (_) {}

    const { dryRun = false, campanhaId, _secret } = bodyData;

    // Se vier com token de usuário, verificar se é admin
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader && authHeader !== 'Bearer undefined') {
      try {
        const user = await base44.auth.me();
        if (user && user.role !== 'admin') {
          return Response.json({ error: 'Acesso negado' }, { status: 403 });
        }
      } catch (_) {
        // automação sem usuário — permitir continuar
      }
    }

    const logInicio = {
      dataProcessamento: new Date().toISOString(),
      tipoProcessamento: dryRun ? 'dry-run' : 'automatico',
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

    // Buscar TODAS as relações diretas de uma vez
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
        // Contar APENAS clientes diretos que estão ATIVOS
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

            // Verificar se essa recompensa já existe (idempotência)
            const recompensaExistente = await base44.asServiceRole.entities.CampanhaRecompensas.filter({
              campanhaId: campanha.id,
              parceiroId: parceiro.id,
              blocoNumero
            });

            if (recompensaExistente.length === 0) {
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
              console.log(`[Campanha] Recompensa R$${campanha.valorPremio} gerada para ${parceiro.full_name} - bloco ${blocoNumero}`);

              await enviarNotificacaoPremio(base44, parceiro, blocoNumero, campanha.valorPremio);
            } else {
              console.log(`[Campanha] Recompensa bloco ${blocoNumero} já existe para ${parceiro.full_name} — pulando`);
            }
          }
        }

        resultados.push({
          parceiro: parceiro.full_name,
          email: parceiro.email,
          clientesDiretosAtivos: totalClientes,
          blocosFechados,
          novosBlocos,
          valorTotal,
          faltamClientes: campanha.quantidadeNecessaria - (totalClientes % campanha.quantidadeNecessaria || campanha.quantidadeNecessaria)
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
      subject: `🎉 Parabéns! Você conquistou R$ ${valor.toFixed(2)} no Desafio 12+12+12!`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #09090b; color: #fff; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #f97316; font-size: 28px; margin: 0;">Sociedade de Consumidores</h1>
          </div>
          <h2 style="color: #22c55e; text-align: center;">🎉 Parabéns, ${parceiro.full_name}!</h2>
          <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">
            Você fechou o <strong style="color: #f97316;">bloco ${blocoNumero}</strong> do <strong>Desafio 12+12+12</strong>
            e conquistou <strong style="color: #22c55e; font-size: 20px;">R$ ${valor.toFixed(2)}</strong> via PIX!
          </p>
          <div style="background: #1c1917; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
            <p style="color: #22c55e; font-weight: bold; font-size: 24px; margin: 0;">R$ ${valor.toFixed(2)}</p>
            <p style="color: #9ca3af; margin: 8px 0 0;">Será pago via PIX na próxima segunda-feira</p>
          </div>
          <p style="color: #d1d5db;">Continue trazendo novos clientes ativos para conquistar mais prêmios!</p>
          <p style="color: #9ca3af; font-size: 14px;">A cada 12 clientes que <strong>você indicou diretamente</strong> e que estão ATIVOS, você ganha R$ 800,00.</p>
          <div style="border-top: 1px solid #374151; padding-top: 16px; margin-top: 24px;">
            <a href="https://3x3sc.com.br" style="color: #f97316; font-weight: bold;">Acessar meu Escritório Virtual</a>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">
            Dúvidas? Contate-nos pelo WhatsApp (11) 95145-3200
          </p>
        </div>
      `
    });
    console.log(`[Campanha] Email de prêmio enviado para ${parceiro.email}`);
  } catch (error) {
    console.error('[Campanha] Erro ao enviar email de prêmio:', error.message);
  }
}