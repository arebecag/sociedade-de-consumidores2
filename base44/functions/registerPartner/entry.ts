import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partnerData, referrerPartnerId, referrerName } = body;

    if (!partnerData || !partnerData.email) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Validar e normalizar email
    const emailNormalized = partnerData.email.toLowerCase().trim();
    
    // Verificar se já existe Partner para este email (evitar duplicatas)
    const existingByEmail = await base44.asServiceRole.entities.Partner.filter({ email: emailNormalized });
    if (existingByEmail.length > 0) {
      console.log('[registerPartner] Partner já existe para email:', emailNormalized);
      return Response.json({ partner: existingByEmail[0], alreadyExisted: true });
    }

    // Buscar LoginUser pelo email (email é lowercase)
    let loginUserId = partnerData.user_id;
    if (!loginUserId || loginUserId === 'pending') {
      try {
        const loginUsers = await base44.asServiceRole.entities.LoginUser.filter({ 
          email: emailNormalized
        });
        if (loginUsers.length > 0) {
          loginUserId = loginUsers[0].id;
          console.log('[registerPartner] LoginUser encontrado:', loginUserId);
        } else {
          console.warn('[registerPartner] LoginUser não encontrado para:', emailNormalized);
          return Response.json({ error: 'LoginUser não encontrado. Registre-se primeiro.' }, { status: 404 });
        }
      } catch (e) {
        console.error('[registerPartner] Erro ao buscar LoginUser:', e.message);
        return Response.json({ error: 'Erro ao validar usuário' }, { status: 500 });
      }
    }

    // Criar Partner com service role (garantir email normalizado)
    const newPartner = await base44.asServiceRole.entities.Partner.create({ 
      ...partnerData,
      email: emailNormalized,
      user_id: loginUserId 
    });
    console.log('[registerPartner] Partner criado:', newPartner.id, newPartner.full_name);

    if (!newPartner || !newPartner.id) {
      return Response.json({ error: 'Falha ao criar Partner' }, { status: 500 });
    }

    // Vincular Partner ao LoginUser (vínculo bidirecional)
    try {
      await base44.asServiceRole.entities.LoginUser.update(loginUserId, {
        partner_id: newPartner.id
      });
      console.log('[registerPartner] Vínculo bidirecional LoginUser ↔ Partner estabelecido');
    } catch (e) {
      console.error('[registerPartner] Erro ao vincular LoginUser:', e.message);
    }

    // Criar relações de rede se tiver indicador
    if (referrerPartnerId) {
      try {
        await createNetworkRelations(base44, referrerPartnerId, referrerName, newPartner.id, partnerData.full_name);
      } catch (e) {
        console.error('[registerPartner] Erro nas relações de rede (não crítico):', e.message);
      }
    }

    console.log('[registerPartner] Partner criado com sucesso, sem envio de email.');

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