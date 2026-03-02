import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId, oldStatus, newStatus, reasons } = await req.json();
    
    const [partner] = await base44.asServiceRole.entities.Partner.filter({ id: partnerId });
    
    if (!partner) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    let subject = '';
    let content = '';

    if (newStatus === 'pendente') {
      subject = 'Seu status está PENDENTE - Sociedade de Consumidores';
      content = `Olá ${partner.full_name}! Seu status está PENDENTE, você NÃO recebe seus BÔNUS e NÃO consegue pagar seus boletos.

Confira no seu ESCRITÓRIO VIRTUAL as pendências:
${reasons && reasons.length > 0 ? reasons.map(r => `• ${r}`).join('\n') : ''}

Regularize as pendências ainda hoje, para que você possa ser beneficiado com TODOS os recursos dentro de nossa plataforma.

Equipe Sociedade de Consumidores`;
    } else if (newStatus === 'ativo' && oldStatus === 'pendente') {
      subject = 'Sua conta está ATIVA - Sociedade de Consumidores';
      content = `Olá ${partner.full_name}! Suas pendências foram resolvidas e sua conta está ATIVA novamente.

Você já pode usufruir de todos os benefícios da Sociedade de Consumidores:
• Receber seus bônus normalmente
• Pagar boletos
• Fazer compras na loja

Bom trabalho e boa divulgação!

Equipe Sociedade de Consumidores`;
    } else if (newStatus === 'excluido') {
      subject = 'Sua conta foi EXCLUÍDA - Sociedade de Consumidores';
      content = `Olá ${partner.full_name}! Você foi excluído e não poderá ACESSAR SEU SISTEMA.

Entre em contato com suporte ainda hoje, regularize seu STATUS para voltar a usufruir dos benefícios da SOCIEDADE DE CONSUMIDORES.

Equipe Sociedade de Consumidores`;
    }

    if (!subject) {
      return Response.json({ ok: true, message: 'No message needed for this status change' });
    }

    // Enviar email
    try {
      await base44.integrations.Core.SendEmail({
        to: partner.created_by,
        subject,
        body: content
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    // Registrar no MessageLog
    await base44.asServiceRole.entities.MessageLog.create({
      partner_id: partnerId,
      partner_name: partner.full_name,
      type: 'status_changed',
      subject,
      content,
      sent_via: 'email',
      status: 'sent',
      metadata: { oldStatus, newStatus, reasons }
    });

    return Response.json({
      ok: true,
      message: 'Status change message sent'
    });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});