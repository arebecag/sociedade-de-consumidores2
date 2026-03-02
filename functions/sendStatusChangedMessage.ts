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
      subject = '⚠️ Sua conta está PENDENTE';
      content = `
Olá ${partner.full_name},

Identificamos algumas pendências em sua conta:

${reasons.map(r => `• ${r}`).join('\n')}

⚠️ Consequências:
- Bônus a receber ficam RETIDOS
- Pagamento de boletos BLOQUEADO

✅ Resolva as pendências para voltar ao status ATIVO automaticamente.

Acesse seu painel e regularize sua situação.

Equipe Sociedade de Consumidores
      `.trim();
    } else if (newStatus === 'ativo' && oldStatus === 'pendente') {
      subject = '✅ Sua conta está ATIVA novamente!';
      content = `
Olá ${partner.full_name},

Parabéns! Sua conta foi reativada.

Todas as pendências foram resolvidas e você já pode:
• Receber seus bônus normalmente
• Pagar boletos
• Fazer compras na loja

Continue crescendo sua rede e gerando renda!

Equipe Sociedade de Consumidores
      `.trim();
    } else if (newStatus === 'excluido') {
      subject = '❌ Sua conta foi EXCLUÍDA';
      content = `
Olá ${partner.full_name},

Sua conta na Sociedade de Consumidores foi excluída.

Motivos:
${reasons.map(r => `• ${r}`).join('\n')}

Para mais informações, entre em contato com o suporte.

Equipe Sociedade de Consumidores
      `.trim();
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