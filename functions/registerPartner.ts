import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partnerData, referrerPartnerId, referrerName } = body;

    if (!partnerData || !partnerData.user_id || !partnerData.email) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Verificar se já existe Partner para este user_id (evitar duplicatas)
    const existing = await base44.asServiceRole.entities.Partner.filter({ user_id: partnerData.user_id });
    if (existing.length > 0) {
      console.log('[registerPartner] Partner já existe para user_id:', partnerData.user_id);
      return Response.json({ partner: existing[0], alreadyExisted: true });
    }

    // Criar Partner com service role (não depende de sessão do usuário)
    const newPartner = await base44.asServiceRole.entities.Partner.create(partnerData);
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