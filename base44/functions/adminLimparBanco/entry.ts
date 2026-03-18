import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // CRÍTICO: Apenas admin pode executar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const results = {};

    // 1. Buscar email do admin antes de limpar
    const adminUser = await base44.asServiceRole.entities.LoginUser.filter({ id: user.id });
    const adminEmail = adminUser[0]?.email;
    console.log('[adminLimparBanco] Admin email:', adminEmail);

    // 2. Limpar entidades (exceto User e dados do admin)
    try {
      // Partner - manter apenas o admin
      const allPartners = await base44.asServiceRole.entities.Partner.list();
      const partnersToDelete = allPartners.filter(p => p.email !== adminEmail);
      for (const p of partnersToDelete) {
        await base44.asServiceRole.entities.Partner.delete(p.id);
      }
      results.partners_deleted = partnersToDelete.length;
    } catch (e) {
      results.partners_error = e.message;
    }

    try {
      // LoginUser - manter apenas o admin
      const allLoginUsers = await base44.asServiceRole.entities.LoginUser.list();
      const loginUsersToDelete = allLoginUsers.filter(u => u.email !== adminEmail);
      for (const u of loginUsersToDelete) {
        await base44.asServiceRole.entities.LoginUser.delete(u.id);
      }
      results.loginUsers_deleted = loginUsersToDelete.length;
    } catch (e) {
      results.loginUsers_error = e.message;
    }

    try {
      // NetworkRelation - limpar tudo
      const allNetworkRelations = await base44.asServiceRole.entities.NetworkRelation.list();
      for (const nr of allNetworkRelations) {
        await base44.asServiceRole.entities.NetworkRelation.delete(nr.id);
      }
      results.networkRelations_deleted = allNetworkRelations.length;
    } catch (e) {
      results.networkRelations_error = e.message;
    }

    try {
      // Financeiro - limpar tudo
      const allFinanceiro = await base44.asServiceRole.entities.Financeiro.list();
      for (const f of allFinanceiro) {
        await base44.asServiceRole.entities.Financeiro.delete(f.id);
      }
      results.financeiro_deleted = allFinanceiro.length;
    } catch (e) {
      results.financeiro_error = e.message;
    }

    try {
      // Purchase - limpar tudo
      const allPurchases = await base44.asServiceRole.entities.Purchase.list();
      for (const p of allPurchases) {
        await base44.asServiceRole.entities.Purchase.delete(p.id);
      }
      results.purchases_deleted = allPurchases.length;
    } catch (e) {
      results.purchases_error = e.message;
    }

    try {
      // BonusTransaction - limpar tudo
      const allBonus = await base44.asServiceRole.entities.BonusTransaction.list();
      for (const b of allBonus) {
        await base44.asServiceRole.entities.BonusTransaction.delete(b.id);
      }
      results.bonusTransactions_deleted = allBonus.length;
    } catch (e) {
      results.bonusTransactions_error = e.message;
    }

    try {
      // EmailVerificationCode - limpar tudo
      const allCodes = await base44.asServiceRole.entities.EmailVerificationCode.list();
      for (const c of allCodes) {
        await base44.asServiceRole.entities.EmailVerificationCode.delete(c.id);
      }
      results.emailCodes_deleted = allCodes.length;
    } catch (e) {
      results.emailCodes_error = e.message;
    }

    try {
      // LoginSession - manter apenas do admin
      const allSessions = await base44.asServiceRole.entities.LoginSession.list();
      const sessionsToDelete = allSessions.filter(s => s.user_id !== user.id);
      for (const s of sessionsToDelete) {
        await base44.asServiceRole.entities.LoginSession.delete(s.id);
      }
      results.sessions_deleted = sessionsToDelete.length;
    } catch (e) {
      results.sessions_error = e.message;
    }

    try {
      // PasswordResetToken - limpar tudo
      const allTokens = await base44.asServiceRole.entities.PasswordResetToken.list();
      for (const t of allTokens) {
        await base44.asServiceRole.entities.PasswordResetToken.delete(t.id);
      }
      results.passwordTokens_deleted = allTokens.length;
    } catch (e) {
      results.passwordTokens_error = e.message;
    }

    try {
      // Withdrawal - limpar tudo
      const allWithdrawals = await base44.asServiceRole.entities.Withdrawal.list();
      for (const w of allWithdrawals) {
        await base44.asServiceRole.entities.Withdrawal.delete(w.id);
      }
      results.withdrawals_deleted = allWithdrawals.length;
    } catch (e) {
      results.withdrawals_error = e.message;
    }

    try {
      // Boleto - limpar tudo
      const allBoletos = await base44.asServiceRole.entities.Boleto.list();
      for (const b of allBoletos) {
        await base44.asServiceRole.entities.Boleto.delete(b.id);
      }
      results.boletos_deleted = allBoletos.length;
    } catch (e) {
      results.boletos_error = e.message;
    }

    try {
      // MessageLog - limpar tudo
      const allMessages = await base44.asServiceRole.entities.MessageLog.list();
      for (const m of allMessages) {
        await base44.asServiceRole.entities.MessageLog.delete(m.id);
      }
      results.messages_deleted = allMessages.length;
    } catch (e) {
      results.messages_error = e.message;
    }

    try {
      // CampanhaParticipantes - limpar tudo
      const allParticipantes = await base44.asServiceRole.entities.CampanhaParticipantes.list();
      for (const p of allParticipantes) {
        await base44.asServiceRole.entities.CampanhaParticipantes.delete(p.id);
      }
      results.campanhaParticipantes_deleted = allParticipantes.length;
    } catch (e) {
      results.campanhaParticipantes_error = e.message;
    }

    try {
      // CampanhaRecompensas - limpar tudo
      const allRecompensas = await base44.asServiceRole.entities.CampanhaRecompensas.list();
      for (const r of allRecompensas) {
        await base44.asServiceRole.entities.CampanhaRecompensas.delete(r.id);
      }
      results.campanhaRecompensas_deleted = allRecompensas.length;
    } catch (e) {
      results.campanhaRecompensas_error = e.message;
    }

    try {
      // LogIntegracaoCampanha - limpar tudo
      const allLogsCampanha = await base44.asServiceRole.entities.LogIntegracaoCampanha.list();
      for (const l of allLogsCampanha) {
        await base44.asServiceRole.entities.LogIntegracaoCampanha.delete(l.id);
      }
      results.logsCampanha_deleted = allLogsCampanha.length;
    } catch (e) {
      results.logsCampanha_error = e.message;
    }

    try {
      // ComprasCursosEAD - limpar tudo
      const allComprasEAD = await base44.asServiceRole.entities.ComprasCursosEAD.list();
      for (const c of allComprasEAD) {
        await base44.asServiceRole.entities.ComprasCursosEAD.delete(c.id);
      }
      results.comprasEAD_deleted = allComprasEAD.length;
    } catch (e) {
      results.comprasEAD_error = e.message;
    }

    return Response.json({
      success: true,
      message: 'Banco de dados limpo com sucesso (admin mantido)',
      admin_email: adminEmail,
      results
    });

  } catch (error) {
    console.error('[adminLimparBanco] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});