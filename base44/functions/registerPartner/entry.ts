import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partnerData, referrerPartnerId, referrerName } = body;

    if (!partnerData || !partnerData.email) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const emailNormalized = partnerData.email.toLowerCase().trim();

    // Verificar se já existe Partner para este email
    const existingByEmail = await base44.asServiceRole.entities.Partner.filter({ email: emailNormalized });
    if (existingByEmail.length > 0) {
      console.log('[registerPartner] Partner já existe para email:', emailNormalized);
      return Response.json({ partner: existingByEmail[0], alreadyExisted: true });
    }

    // Buscar LoginUser pelo email
    let loginUserId = partnerData.user_id;
    if (!loginUserId || loginUserId === 'pending') {
      const loginUsers = await base44.asServiceRole.entities.LoginUser.filter({ email: emailNormalized });
      if (loginUsers.length > 0) {
        loginUserId = loginUsers[0].id;
      } else {
        return Response.json({ error: 'LoginUser não encontrado. Registre-se primeiro.' }, { status: 404 });
      }
    }

    // Criar Partner
    const newPartner = await base44.asServiceRole.entities.Partner.create({
      ...partnerData,
      email: emailNormalized,
      user_id: loginUserId
    });
    console.log('[registerPartner] Partner criado:', newPartner.id, newPartner.full_name);

    // Vincular Partner ao LoginUser
    try {
      await base44.asServiceRole.entities.LoginUser.update(loginUserId, { partner_id: newPartner.id });
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

    return Response.json({ partner: newPartner });
  } catch (error) {
    console.error('[registerPartner] ERRO:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function createNetworkRelations(base44, referrerId, referrerName, newPartnerId, newPartnerName) {
  // Buscar diretos do indicador e relação com avô em paralelo
  const [directRelations, grandpaRelations] = await Promise.all([
    base44.asServiceRole.entities.NetworkRelation.filter({ referrer_id: referrerId, relation_type: 'direct' }),
    base44.asServiceRole.entities.NetworkRelation.filter({ referred_id: referrerId, relation_type: 'direct' })
  ]);

  const grandpa = grandpaRelations.length > 0 ? grandpaRelations[0] : null;
  const sortedDirects = directRelations.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const directCount = sortedDirects.length;

  console.log(`[3x3] ${referrerName} tem ${directCount} diretos`);

  // FASE 1: Menos de 3 diretos → entra como DIRETO
  if (directCount < 3) {
    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId, referrer_name: referrerName,
      referred_id: newPartnerId, referred_name: newPartnerName,
      relation_type: 'direct', is_spillover: false, level: 1
    });
    if (grandpa) {
      await base44.asServiceRole.entities.NetworkRelation.create({
        referrer_id: grandpa.referrer_id, referrer_name: grandpa.referrer_name,
        referred_id: newPartnerId, referred_name: newPartnerName,
        relation_type: 'indirect', is_spillover: false, level: 2
      });
    }
    return;
  }

  // FASE 2: 3 diretos completos → verificar se grupo está cheio (9 indiretos)
  const indirectRelations = await base44.asServiceRole.entities.NetworkRelation.filter({
    referrer_id: referrerId, relation_type: 'indirect'
  });
  const totalIndiretos = indirectRelations.length;

  if (totalIndiretos >= 9) {
    // FASE 3: Grupo completo → novo grupo
    console.log(`[3x3] Grupo completo! Iniciando NOVO GRUPO para ${referrerName}`);
    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId, referrer_name: referrerName,
      referred_id: newPartnerId, referred_name: newPartnerName,
      relation_type: 'direct', is_spillover: false, level: 1
    });
    if (grandpa) {
      await base44.asServiceRole.entities.NetworkRelation.create({
        referrer_id: grandpa.referrer_id, referrer_name: grandpa.referrer_name,
        referred_id: newPartnerId, referred_name: newPartnerName,
        relation_type: 'indirect', is_spillover: false, level: 2
      });
    }
    return;
  }

  // Round-robin: contar spillovers por filho (3 queries em paralelo, max 3 filhos)
  const spilloverCounts = await Promise.all(
    sortedDirects.map(d =>
      base44.asServiceRole.entities.NetworkRelation.filter({
        referrer_id: d.referred_id, relation_type: 'direct', is_spillover: true
      }).then(rels => ({ child: d, count: rels.length }))
    )
  );

  // Escolher filho com menor spillover (round-robin por totalIndiretos)
  const roundRobinStart = totalIndiretos % 3;
  let targetDirect = null;
  for (let i = 0; i < 3; i++) {
    const candidate = spilloverCounts[(roundRobinStart + i) % 3];
    if (candidate.count < 3) {
      targetDirect = candidate.child;
      break;
    }
  }
  if (!targetDirect) targetDirect = sortedDirects[roundRobinStart];

  console.log(`[3x3] Derramando para ${targetDirect.referred_name}`);

  await Promise.all([
    base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: targetDirect.referred_id, referrer_name: targetDirect.referred_name,
      referred_id: newPartnerId, referred_name: newPartnerName,
      relation_type: 'direct', is_spillover: true, level: 1
    }),
    base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId, referrer_name: referrerName,
      referred_id: newPartnerId, referred_name: newPartnerName,
      relation_type: 'indirect', is_spillover: true, level: 2
    }),
    base44.asServiceRole.entities.Partner.update(newPartnerId, {
      referrer_id: targetDirect.referred_id, referrer_name: targetDirect.referred_name
    })
  ]);

  // Verificar fechamento do grupo
  const newTotal = totalIndiretos + 1;
  if (newTotal >= 9) {
    console.log(`[3x3] GRUPO FECHADO! ${referrerName} completou 12 membros!`);
    const referrerPartners = await base44.asServiceRole.entities.Partner.filter({ id: referrerId });
    if (referrerPartners.length > 0) {
      await base44.asServiceRole.entities.Partner.update(referrerId, {
        groups_formed: (referrerPartners[0].groups_formed || 0) + 1
      });
    }
  }
}