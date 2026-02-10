import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId } = await req.json();
    
    const partner = await base44.asServiceRole.entities.Partner.get(partnerId);
    
    if (!partner) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const subject = '🎉 Bem-vindo à Sociedade de Consumidores!';
    const content = `
Olá ${partner.full_name}!

Seja muito bem-vindo(a) à Sociedade de Consumidores 3X3 SC!

Você agora faz parte de uma comunidade que valoriza o consumo inteligente e a geração de renda através de indicações.

📋 Próximos passos:
1. Complete seu cadastro com todos os dados bancários
2. Faça sua primeira compra (mínimo R$125) para ativar sua conta
3. Compartilhe seu link de indicação e comece a formar sua rede

🔗 Seu link exclusivo: ${partner.unique_code ? `https://seusite.com.br/${partner.unique_code}` : 'Em breve'}

Qualquer dúvida, consulte nossa seção de Perguntas Frequentes.

Sucesso!
Equipe Sociedade de Consumidores
    `.trim();

    // Enviar email
    const userEntity = await base44.asServiceRole.entities.User.filter({ 
      email: partner.created_by 
    });
    
    if (userEntity.length > 0) {
      try {
        await base44.integrations.Core.SendEmail({
          to: partner.created_by,
          subject,
          body: content
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
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