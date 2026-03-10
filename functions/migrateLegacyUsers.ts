import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Hash simples usando Web Crypto API nativa do Deno
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar se é admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { mode } = await req.json();
    
    if (mode === 'dry-run') {
      // Apenas contar quantos precisam migrar
      const partners = await base44.asServiceRole.entities.Partner.list(null, 1000);
      const loginUsers = await base44.asServiceRole.entities.LoginUser.list(null, 1000);
      const loginUserEmails = new Set(loginUsers.map(u => u.email.toLowerCase()));
      
      const needsMigration = partners.filter(p => 
        p.email && !loginUserEmails.has(p.email.toLowerCase())
      );

      return Response.json({
        total_partners: partners.length,
        total_login_users: loginUsers.length,
        needs_migration: needsMigration.length,
        partners_to_migrate: needsMigration.map(p => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name
        }))
      });
    }

    if (mode === 'migrate') {
      // Migrar usuários legados
      const partners = await base44.asServiceRole.entities.Partner.list(null, 1000);
      const loginUsers = await base44.asServiceRole.entities.LoginUser.list(null, 1000);
      const loginUsersByEmail = new Map(
        loginUsers.map(u => [u.email.toLowerCase(), u])
      );

      const migrated = [];
      const errors = [];
      const defaultPassword = 'Mudar@123'; // Senha temporária

      for (const partner of partners) {
        if (!partner.email) continue;
        
        const email = partner.email.toLowerCase();
        let loginUser = loginUsersByEmail.get(email);

        try {
          // Se não existe LoginUser, criar
          if (!loginUser) {
            const password_hash = await hashPassword(defaultPassword);
            
            loginUser = await base44.asServiceRole.entities.LoginUser.create({
              email,
              password_hash,
              full_name: partner.full_name,
              partner_id: partner.id,
              status: partner.status === 'ativo' ? 'active' : 'pending',
              is_email_verified: partner.email_verified || false
            });

            migrated.push({
              partner_id: partner.id,
              email,
              action: 'created_login_user',
              temp_password: defaultPassword
            });
          } else {
            // LoginUser existe, apenas vincular se não está vinculado
            if (!loginUser.partner_id) {
              await base44.asServiceRole.entities.LoginUser.update(loginUser.id, {
                partner_id: partner.id
              });

              migrated.push({
                partner_id: partner.id,
                email,
                action: 'linked_existing_login_user'
              });
            }
          }

          // Atualizar Partner com user_id se necessário
          if (!partner.user_id || partner.user_id === 'unknown') {
            await base44.asServiceRole.entities.Partner.update(partner.id, {
              user_id: loginUser.id
            });
          }
        } catch (error) {
          errors.push({
            partner_id: partner.id,
            email,
            error: error.message
          });
        }
      }

      return Response.json({
        success: true,
        migrated: migrated.length,
        errors: errors.length,
        details: { migrated, errors }
      });
    }

    return Response.json({ error: 'Modo inválido. Use dry-run ou migrate' }, { status: 400 });

  } catch (error) {
    console.error('[migrateLegacyUsers] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});