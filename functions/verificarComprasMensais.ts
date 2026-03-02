import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Roda todo dia 11 de cada mês
// Verifica quem não usou o bonus_for_purchases no mês corrente e coloca em PENDENTE

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

    // Buscar todos os parceiros ativos que já fizeram a primeira compra
    const partners = await base44.asServiceRole.entities.Partner.filter({ status: 'ativo' });
    const elegíveis = partners.filter(p => p.first_purchase_done && (p.bonus_for_purchases || 0) > 0);

    const pendentes = [];
    const ok = [];

    for (const partner of elegíveis) {
      // Buscar compras pagas este mês com uso de bônus
      const purchases = await base44.asServiceRole.entities.Purchase.filter({
        partner_id: partner.id,
        status: 'paid'
      });

      const comprasMes = purchases.filter(p => new Date(p.created_date) >= firstDayOfMonth);
      const totalBonusUsado = comprasMes.reduce((sum, p) => sum + (p.paid_with_bonus || 0), 0);

      // Deve usar pelo menos 50% do saldo de bonus_for_purchases
      const minimoObrigatorio = (partner.bonus_for_purchases || 0) * 0.50;

      if (totalBonusUsado < minimoObrigatorio) {
        // Colocar em pendente
        const novasRazoes = [...(partner.pending_reasons || []).filter(r => !r.includes('Compra mensal')), 
          `Compra mensal obrigatória não realizada (usou R$${totalBonusUsado.toFixed(2)} de R$${minimoObrigatorio.toFixed(2)} necessários)`
        ];

        await base44.asServiceRole.entities.Partner.update(partner.id, {
          status: 'pendente',
          pending_reasons: novasRazoes
        });

        // Notificar via função de mensagem
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: partner.email || partner.created_by,
            subject: '⚠️ Sua conta foi suspensa - Compra mensal não realizada',
            body: `Olá ${partner.full_name},

Sua conta na Sociedade de Consumidores foi colocada em PENDENTE pois você não realizou a compra mensal obrigatória com seu bônus até o dia 10.

Saldo que deveria ser utilizado: R$ ${minimoObrigatorio.toFixed(2)}
Valor utilizado: R$ ${totalBonusUsado.toFixed(2)}

Para reativar sua conta, acesse o Escritório Virtual e realize uma compra na Loja 3x3 usando seu bônus disponível.

Equipe Sociedade de Consumidores`
          });
        } catch (e) {
          console.error(`Erro ao enviar email para ${partner.email}:`, e.message);
        }

        pendentes.push({ id: partner.id, name: partner.full_name, bonusUsado: totalBonusUsado, minimo: minimoObrigatorio });
      } else {
        ok.push({ id: partner.id, name: partner.full_name });
      }
    }

    return Response.json({
      ok: true,
      mes: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      verificados: elegíveis.length,
      colocadosPendentes: pendentes.length,
      emDia: ok.length,
      pendentes
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});