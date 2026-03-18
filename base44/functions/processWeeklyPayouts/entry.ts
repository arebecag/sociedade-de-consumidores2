import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Cria automaticamente solicitações de saque na entidade Saques para todos os parceiros ativos com saldo >= R$50
// O admin depois aprova em AdminSaques e faz o PIX manualmente

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const partners = await base44.asServiceRole.entities.Partner.filter({ status: 'ativo' });

    const elegíveis = partners.filter(p =>
      (p.bonus_for_withdrawal || 0) >= 50 &&
      p.pix_key
    );

    const resultados = [];

    for (const partner of elegíveis) {
      const valor = partner.bonus_for_withdrawal;

      // Verificar se já tem saque pendente para não criar duplicado
      const pendentes = await base44.asServiceRole.entities.Saques.filter({
        userId: partner.id,
        status: 'PENDENTE'
      });

      if (pendentes.length > 0) {
        resultados.push({ parceiro: partner.full_name, status: 'já tem saque pendente', valor });
        continue;
      }

      // Criar solicitação de saque
      await base44.asServiceRole.entities.Saques.create({
        userId: partner.id,
        userEmail: partner.email || partner.created_by,
        userName: partner.full_name,
        valor,
        status: 'PENDENTE',
        dataSolicitacao: new Date().toISOString(),
        pixKey: partner.pix_key
      });

      // Log financeiro
      await base44.asServiceRole.entities.LogsFinanceiro.create({
        tipo: 'SAQUE',
        userId: partner.id,
        userEmail: partner.email || partner.created_by,
        userName: partner.full_name,
        valor,
        descricao: `Saque semanal automático. PIX: ${partner.pix_key}`
      });

      // Notificar parceiro
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: partner.email || partner.created_by,
          subject: '💰 Saque Semanal Criado',
          body: `Olá ${partner.full_name},\n\nSeu saque semanal de R$ ${valor.toFixed(2)} foi gerado e está aguardando processamento.\n\nChave PIX: ${partner.pix_key}\n\nVocê receberá a confirmação quando for processado.\n\nEquipe Sociedade de Consumidores`
        });
      } catch (e) {
        console.error('Erro ao enviar email:', e.message);
      }

      resultados.push({ parceiro: partner.full_name, status: 'saque criado', valor });
    }

    return Response.json({
      ok: true,
      processados: resultados.length,
      totalElegíveis: elegíveis.length,
      resultados
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});