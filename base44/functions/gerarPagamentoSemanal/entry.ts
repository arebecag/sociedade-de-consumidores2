import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoje = new Date();
    const semana = hoje.toISOString().split('T')[0];

    // Verificar se já existe pagamento para esta semana
    const existentes = await base44.asServiceRole.entities.PagamentosEquipe.filter({
      semanaReferencia: semana
    });

    if (existentes.length > 0) {
      return Response.json({ message: 'Pagamento já gerado para esta semana', semana });
    }

    await base44.asServiceRole.entities.PagamentosEquipe.create({
      valor: 350.00,
      dataPagamento: semana,
      semanaReferencia: semana,
      status: 'pendente',
      usuarioNome: 'Equipe'
    });

    return Response.json({ success: true, semana, valor: 350.00 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});