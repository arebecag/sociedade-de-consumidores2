import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partnerData, referrerPartnerId, referrerName } = body;

    if (!partnerData || !partnerData.email) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Verificar se já existe Partner para este email (evitar duplicatas)
    const existingByEmail = await base44.asServiceRole.entities.Partner.filter({ email: partnerData.email });
    if (existingByEmail.length > 0) {
      console.log('[registerPartner] Partner já existe para email:', partnerData.email);
      return Response.json({ partner: existingByEmail[0], alreadyExisted: true });
    }

    // Buscar userId via service role pelo email (evita depender do token recém-criado)
    let userId = partnerData.user_id;
    if (!userId || userId === 'pending') {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: partnerData.email });
        if (users.length > 0) {
          userId = users[0].id;
          console.log('[registerPartner] userId encontrado via service role:', userId);
        }
      } catch (e) {
        console.warn('[registerPartner] Não foi possível buscar userId:', e.message);
      }
    }

    // Criar Partner com service role
    const newPartner = await base44.asServiceRole.entities.Partner.create({ ...partnerData, user_id: userId || 'unknown' });
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
  // Buscar spillovers por filho para garantir que nenhum receba mais de 3
  const indirectRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
    referrer_id: referrerId,
    relation_type: 'indirect'
  });
  const totalDistribuidos = indirectRelations.length;
  console.log(`[3x3] Total indiretos já distribuídos: ${totalDistribuidos}`);

  if (totalDistribuidos < 9) {
    // Contar quantos spillovers cada filho já recebeu
    const spilloverCountPerChild = {};
    for (const rel of indirectRelations) {
      // Descobrir para qual filho esse indireto foi → buscar relação direta do newPartnerId com filho
      const directOfChild = await base44.asServiceRole.entities.NetworkRelation.filter({
        referred_id: rel.referred_id,
        relation_type: 'direct',
        is_spillover: true
      });
      for (const d of directOfChild) {
        spilloverCountPerChild[d.referrer_id] = (spilloverCountPerChild[d.referrer_id] || 0) + 1;
      }
    }

    // Escolher filho com menor número de spillovers (respeitando ordem round-robin)
    // Ordem sequencial: D1 → D2 → D3 → D1...
    let targetDirect = null;
    for (let i = 0; i < 3; i++) {
      const roundRobinIndex = totalDistribuidos % 3;
      const candidate = sortedDirects[(totalDistribuidos + i) % 3];
      const count = spilloverCountPerChild[candidate.referred_id] || 0;
      if (count < 3) {
        targetDirect = candidate;
        break;
      }
    }

    // Se por algum motivo não achou (não deveria acontecer antes de 9), usa o índice simples
    if (!targetDirect) {
      targetDirect = sortedDirects[totalDistribuidos % 3];
    }

    console.log(`[3x3] Round-robin index ${totalDistribuidos % 3} → derramando para ${targetDirect.referred_name}`);

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

    // Verificar fechamento do grupo (9 indiretos = grupo fechado)
    const newTotal = totalDistribuidos + 1;
    if (newTotal >= 9) {
      console.log(`[3x3] GRUPO FECHADO! ${referrerName} completou 12 membros!`);
      const referrerPartners = await base44.asServiceRole.entities.Partner.filter({ id: referrerId });
      if (referrerPartners.length > 0) {
        await base44.asServiceRole.entities.Partner.update(referrerId, {
          groups_formed: (referrerPartners[0].groups_formed || 0) + 1
        });
        console.log(`[3x3] groups_formed incrementado para ${referrerPartners[0].full_name}`);
      }
    }
    return;
  }

  // FASE 3: Grupo completo (9 indiretos) → NOVO GRUPO (começa novo ciclo de 3 diretos)
  console.log(`[3x3] Grupo completo! Iniciando NOVO GRUPO para ${referrerName}`);
  await base44.asServiceRole.entities.NetworkRelation.create({
    referrer_id: referrerId,
    referrer_name: referrerName,
    referred_id: newPartnerId,
    referred_name: newPartnerName,
    relation_type: 'direct',
    is_spillover: false,
    level: 1
  });
  console.log(`[3x3] ${newPartnerName} é o 1º direto do novo grupo de ${referrerName}`);

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
    console.log(`[3x3] Relação indireta com avô mantida no novo grupo: ${grandpa.referrer_name}`);
  }
}