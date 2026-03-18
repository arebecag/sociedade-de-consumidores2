import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId } = await req.json();
    
    const [partner] = await base44.asServiceRole.entities.Partner.filter({ id: partnerId });
    
    if (!partner) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const subject = 'Bem-vindo à Sociedade de Consumidores!';
    const content = `Olá ${partner.full_name}, meu nome é Eder Mateus, fundador da plataforma. Parabéns pela sua decisão em fazer parte da Sociedade de Consumidores. Somos uma empresa registrada e patenteada. Trabalhamos dentro das normas e regulamentos do país.

Temos algumas informações importantes.

Você poderá comprar com seus bônus tudo o que você desejar, basta seguir o REGIMENTO INTERNO, pois zelamos por nosso nome, por isto crescemos a cada dia.

Os depósitos em sua conta bancária ou PIX serão feitos toda segunda feira.

Atenção:
Quando você for enviar um boleto para pagarmos em nossa plataforma, confira se este boleto é válido, pois não podemos estornar valores pagos e se o boleto for falso, poderá gerar sua exclusão definitiva de nossa plataforma. Você poderá SIM enviar boletos de terceiros. (boletos em nome de outra pessoa).

ATENÇÃO DE NOVO:
Nunca envie seu contato pessoal para informações ou suporte, divulgue APENAS seu site e deixe todo suporte conosco. Temos uma equipe técnica preparada e qualificada para responder todas as dúvidas de seus futuros clientes.

E por fim, estamos a sua disposição caso necessite de algum suporte ou tirar alguma dúvida.

Faça sua primeira compra de produtos digitais ou serviços no valor mínimo de R$ 125,00 para ficar ativo na SOCIEDADE DE CONSUMIDORES e usufruir de todos os recursos de nossa plataforma.

O futuro, já começou! Bom trabalho, boa divulgação.

Eder Mateus Teixeira.`;

    // Enviar email para o email do próprio parceiro (não created_by)
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: partner.email,
        subject,
        body: `<div style="font-family: Arial, sans-serif; white-space: pre-line; max-width: 600px; margin: 0 auto; padding: 20px;">${content}</div>`
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Registrar no MessageLog
    await base44.asServiceRole.entities.MessageLog.create({
      partner_id: partnerId,
      partner_name: partner.full_name,
      type: 'welcome',
      subject,
      content,
      sent_via: 'email',
      status: 'sent'
    });

    return Response.json({
      ok: true,
      message: 'Welcome message sent'
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});