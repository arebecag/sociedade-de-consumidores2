import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newEmail, step } = await req.json();
    
    if (step === 'request') {
      // Gerar código de confirmação
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos
      
      // Buscar partner
      const partners = await base44.asServiceRole.entities.Partner.filter({ 
        created_by: user.email 
      });
      
      if (partners.length === 0) {
        return Response.json({ error: 'Partner not found' }, { status: 404 });
      }
      
      // Salvar código temporário no partner
      await base44.asServiceRole.entities.Partner.update(partners[0].id, {
        email_change_code: code,
        email_change_expiry: expiry,
        email_change_new: newEmail
      });
      
      // Enviar email com código
      try {
        await base44.integrations.Core.SendEmail({
          to: newEmail,
          subject: '🔐 Código de Confirmação - Alteração de Email',
          body: `
Olá ${partners[0].full_name},

Você solicitou a alteração do seu email de cadastro.

Seu código de confirmação é: ${code}

Este código expira em 15 minutos.

Se você não solicitou esta alteração, ignore este email.

Equipe Sociedade de Consumidores
          `.trim()
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        return Response.json({ 
          ok: false, 
          error: 'Failed to send confirmation email' 
        });
      }
      
      return Response.json({ 
        ok: true, 
        message: 'Código enviado para o novo email' 
      });
    }
    
    if (step === 'confirm') {
      const { code } = await req.json();
      
      // Buscar partner
      const partners = await base44.asServiceRole.entities.Partner.filter({ 
        created_by: user.email 
      });
      
      if (partners.length === 0) {
        return Response.json({ error: 'Partner not found' }, { status: 404 });
      }
      
      const partner = partners[0];
      
      // Verificar código e validade
      if (!partner.email_change_code || partner.email_change_code !== code) {
        return Response.json({ 
          ok: false, 
          error: 'Código inválido' 
        });
      }
      
      if (new Date() > new Date(partner.email_change_expiry)) {
        return Response.json({ 
          ok: false, 
          error: 'Código expirado' 
        });
      }
      
      // Verificar se novo email já existe
      const existingPartners = await base44.asServiceRole.entities.Partner.filter({ 
        created_by: partner.email_change_new 
      });
      
      if (existingPartners.length > 0) {
        return Response.json({ 
          ok: false, 
          error: 'Este email já está em uso' 
        });
      }
      
      // Atualizar email (created_by)
      await base44.asServiceRole.entities.Partner.update(partner.id, {
        created_by: partner.email_change_new,
        email_change_code: null,
        email_change_expiry: null,
        email_change_new: null
      });
      
      // Enviar confirmação
      try {
        await base44.integrations.Core.SendEmail({
          to: partner.email_change_new,
          subject: '✅ Email Alterado com Sucesso',
          body: `
Olá ${partner.full_name},

Seu email de cadastro foi alterado com sucesso!

Novo email: ${partner.email_change_new}

Use este novo email para fazer login na plataforma.

Equipe Sociedade de Consumidores
          `.trim()
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
      
      return Response.json({ 
        ok: true, 
        message: 'Email alterado com sucesso! Faça login novamente.' 
      });
    }

    return Response.json({ error: 'Invalid step' }, { status: 400 });

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message 
    }, { status: 500 });
  }
});