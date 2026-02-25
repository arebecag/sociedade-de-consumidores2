import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partnerData, referrerPartnerId, referrerName } = body;

    if (!partnerData || !partnerData.email) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Buscar user_id da sessão autenticada
    let userId = partnerData.user_id;
    if (!userId) {
      try {
        const me = await base44.auth.me();
        if (me?.id) {
          userId = me.id;
          console.log('[registerPartner] user_id obtido da sessão:', userId);
        }
      } catch (e) {
        console.error('[registerPartner] Erro ao obter sessão:', e.message);
      }
    }

    if (!userId) {
      return Response.json({ error: 'Sessão expirou. Faça login e tente novamente.' }, { status: 401 });
    }

    // Verificar se já existe Partner para este email (evitar duplicatas)
    const existingByEmail = await base44.asServiceRole.entities.Partner.filter({ email: partnerData.email });
    if (existingByEmail.length > 0) {
      console.log('[registerPartner] Partner já existe para email:', partnerData.email);
      return Response.json({ partner: existingByEmail[0], alreadyExisted: true });
    }

    // Criar Partner com service role
    const newPartner = await base44.asServiceRole.entities.Partner.create({ ...partnerData, user_id: userId });
    console.log('[registerPartner] Partner criado:', newPartner.id, newPartner.full_name);

    if (!newPartner || !newPartner.id) {
      return Response.json({ error: 'Falha ao criar Partner' }, { status: 500 });
    }

    // Criar relações de rede se tiver indicador
    if (referrerPartnerId) {
      try {
        await createNetworkRelations(base44, referrerPartnerId, referrerName, newPartner.id, partnerData.full_name);
      } catch (e) {
        console.error('[registerPartner] Erro nas relações de rede (não crítico):', e.message);
      }
    }

    // Enviar email de verificação automaticamente
    try {
      const secret = Deno.env.get('INTERNAL_SECRET') || 'default_secret';
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      const payload = `${newPartner.id}:${expiry}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
      const token = btoa(payload) + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));
      const safeToken = token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const origin = partnerData._origin || 'https://app.base44.com';
      const link = `${origin}?page=VerifyEmail&token=${safeToken}`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: partnerData.email,
        subject: 'Verifique seu email - Sociedade de Consumidores',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f97316;">Bem-vindo(a), ${partnerData.full_name}!</h2>
            <p>Obrigado por se cadastrar na <strong>Sociedade de Consumidores</strong>.</p>
            <p>Para confirmar seu email e garantir a segurança da sua conta, clique no botão abaixo:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" 
                 style="background-color: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                ✅ Verificar meu email
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Este link expira em 24 horas.</p>
            <p style="color: #666; font-size: 14px;">Se você não se cadastrou, ignore este email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">Sociedade de Consumidores</p>
          </div>
        `
      });
      console.log('[registerPartner] Email de verificação enviado para:', partnerData.email);
    } catch (emailErr) {
      console.error('[registerPartner] Erro ao enviar email de verificação (não crítico):', emailErr.message);
    }

    return Response.json({ partner: newPartner });
  } catch (error) {
    console.error('[registerPartner] ERRO:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function createNetworkRelations(base44, referrerId, referrerName, newPartnerId, newPartnerName) {
  // Buscar avô
  const grandpaRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
    referred_id: referrerId,
    relation_type: 'direct'
  });
  const grandpa = grandpaRelations.length > 0 ? grandpaRelations[0] : null;

  // Buscar diretos do indicador
  const directRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
    referrer_id: referrerId,
    relation_type: 'direct'
  });

  const sortedDirects = directRelations.sort((a, b) =>
    new Date(a.created_date) - new Date(b.created_date)
  );
  const directCount = sortedDirects.length;
  console.log(`[3x3] ${referrerName} tem ${directCount} diretos`);

  // FASE 1: Menos de 3 diretos → entra como DIRETO
  if (directCount < 3) {
    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId,
      referrer_name: referrerName,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: 'direct',
      is_spillover: false,
      level: 1
    });

    if (grandpa) {
      await base44.asServiceRole.entities.NetworkRelation.create({
        referrer_id: grandpa.referrer_id,
        referrer_name: grandpa.referrer_name,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: 'indirect',
        is_spillover: false,
        level: 2
      });
    }
    return;
  }

  // FASE 2: 3 diretos completos → ROUND-ROBIN para nível 2
  const indirectRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
    referrer_id: referrerId,
    relation_type: 'indirect'
  });
  const totalDistribuidos = indirectRelations.length;

  if (totalDistribuidos < 9) {
    const roundRobinIndex = totalDistribuidos % 3;
    const targetDirect = sortedDirects[roundRobinIndex];

    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: targetDirect.referred_id,
      referrer_name: targetDirect.referred_name,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: 'direct',
      is_spillover: true,
      level: 1
    });

    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId,
      referrer_name: referrerName,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: 'indirect',
      is_spillover: true,
      level: 2
    });

    await base44.asServiceRole.entities.Partner.update(newPartnerId, {
      referrer_id: targetDirect.referred_id,
      referrer_name: targetDirect.referred_name
    });

    const newTotal = totalDistribuidos + 1;
    if (newTotal >= 9) {
      const referrerPartner = await base44.asServiceRole.entities.Partner.filter({ id: referrerId });
      if (referrerPartner.length > 0) {
        await base44.asServiceRole.entities.Partner.update(referrerId, {
          groups_formed: (referrerPartner[0].groups_formed || 0) + 1
        });
      }
    }
    return;
  }

  // FASE 3: Grupo completo → NOVO GRUPO
  await base44.asServiceRole.entities.NetworkRelation.create({
    referrer_id: referrerId,
    referrer_name: referrerName,
    referred_id: newPartnerId,
    referred_name: newPartnerName,
    relation_type: 'direct',
    is_spillover: false,
    level: 1
  });

  if (grandpa) {
    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: grandpa.referrer_id,
      referrer_name: grandpa.referrer_name,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: 'indirect',
      is_spillover: false,
      level: 2
    });
  }
}