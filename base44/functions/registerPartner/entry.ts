import { createClientFromRequest } from "npm:@base44/sdk@0.8.21";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partnerData, referrerPartnerId, referrerName } = body;

    if (!partnerData || !partnerData.email) {
      return Response.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const emailNormalized = partnerData.email.toLowerCase().trim();

    // Verificar se já existe Partner para este email
    const existingByEmail = await base44.asServiceRole.entities.Partner.filter({
      email: emailNormalized,
    });
    if (existingByEmail.length > 0) {
      console.log(
        "[registerPartner] Partner já existe para email:",
        emailNormalized,
      );
      return Response.json({
        partner: existingByEmail[0],
        alreadyExisted: true,
      });
    }

    // Buscar LoginUser pelo email
    let loginUserId = partnerData.user_id;
    if (!loginUserId || loginUserId === "pending") {
      const loginUsers = await base44.asServiceRole.entities.LoginUser.filter({
        email: emailNormalized,
      });
      if (loginUsers.length > 0) {
        loginUserId = loginUsers[0].id;
      } else {
        return Response.json(
          { error: "LoginUser não encontrado. Registre-se primeiro." },
          { status: 404 },
        );
      }
    }

    // Criar Partner
    const newPartner = await base44.asServiceRole.entities.Partner.create({
      ...partnerData,
      email: emailNormalized,
      user_id: loginUserId,
    });
    console.log(
      "[registerPartner] Partner criado:",
      newPartner.id,
      newPartner.full_name,
    );

    // Vincular Partner ao LoginUser
    try {
      await base44.asServiceRole.entities.LoginUser.update(loginUserId, {
        partner_id: newPartner.id,
      });
    } catch (e) {
      console.error("[registerPartner] Erro ao vincular LoginUser:", e.message);
    }

    // Criar relações de rede se tiver indicador
    if (referrerPartnerId) {
      try {
        await createNetworkRelations(
          base44,
          referrerPartnerId,
          referrerName,
          newPartner.id,
          partnerData.full_name,
        );
      } catch (e) {
        console.error(
          "[registerPartner] Erro nas relações de rede (não crítico):",
          e.message,
        );
      }
    }

    return Response.json({ partner: newPartner });
  } catch (error) {
    console.error("[registerPartner] ERRO:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function createNetworkRelations(
  base44,
  referrerId,
  referrerName,
  newPartnerId,
  newPartnerName,
) {
  // Buscar diretos do indicador e relação do indicador com seu pai
  const [directRelations, parentRelation] = await Promise.all([
    base44.asServiceRole.entities.NetworkRelation.filter({
      referrer_id: referrerId,
      relation_type: "direct",
    }),
    base44.asServiceRole.entities.NetworkRelation.filter({
      referred_id: referrerId,
      relation_type: "direct",
    }),
  ]);

  const grandpa = parentRelation.length > 0 ? parentRelation[0] : null;
  const sortedDirects = directRelations.sort(
    (a, b) => new Date(a.created_date) - new Date(b.created_date),
  );
  const directCount = sortedDirects.length;

  console.log(`[3x3] ${referrerName} tem ${directCount} diretos`);

  // FASE 1: Menos de 3 diretos → entra como DIRETO normal
  if (directCount < 3) {
    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId,
      referrer_name: referrerName,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: "direct",
      is_spillover: false,
      level: 1,
    });
    if (grandpa) {
      await base44.asServiceRole.entities.NetworkRelation.create({
        referrer_id: grandpa.referrer_id,
        referrer_name: grandpa.referrer_name,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "indirect",
        is_spillover: false,
        level: 2,
      });
    }
    return;
  }

  // FASE 2: 3 diretos → verificar indiretos do grupo atual (3 primeiros diretos)
  // Usar apenas os 3 primeiros diretos do grupo atual para contar indiretos
  const primeirosTresDiretos = sortedDirects.slice(0, 3);
  const indiretosCounts = await Promise.all(
    primeirosTresDiretos.map((d) =>
      base44.asServiceRole.entities.NetworkRelation.filter({
        referrer_id: d.referred_id,
        relation_type: "direct",
      }).then((rels) => ({ child: d, count: rels.length })),
    ),
  );

  const totalIndiretosDoPai = indiretosCounts.reduce(
    (sum, c) => sum + c.count,
    0,
  );
  console.log(`[3x3] Total de membros nos filhos: ${totalIndiretosDoPai}`);

  // Se todos os filhos já têm 3 diretos cada = grupo completo (3+9=12)
  const grupoCompleto = indiretosCounts.every((c) => c.count >= 3);
  if (grupoCompleto) {
    console.log(
      `[3x3] Grupo completo! Iniciando NOVO GRUPO para ${referrerName}`,
    );
    // Entrar como direto no novo grupo
    await base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId,
      referrer_name: referrerName,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: "direct",
      is_spillover: false,
      level: 1,
    });
    if (grandpa) {
      await base44.asServiceRole.entities.NetworkRelation.create({
        referrer_id: grandpa.referrer_id,
        referrer_name: grandpa.referrer_name,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "indirect",
        is_spillover: false,
        level: 2,
      });
    }
    // Atualizar groups_formed do indicador
    const referrerData =
      await base44.asServiceRole.entities.Partner.get(referrerId);
    if (referrerData) {
      await base44.asServiceRole.entities.Partner.update(referrerId, {
        groups_formed: (referrerData.groups_formed || 0) + 1,
      });
    }
    return;
  }

  // DERRAMAMENTO: escolher filho com menos diretos (round-robin por totalIndiretos)
  // Ordenar por quantidade de diretos ASC, depois por ordem original
  const candidatos = indiretosCounts
    .filter((c) => c.count < 3)
    .sort((a, b) => a.count - b.count);

  const targetDirect = candidatos[0].child;
  console.log(
    `[3x3] Derramando para ${targetDirect.referred_name} (${candidatos[0].count}/3 diretos)`,
  );

  await Promise.all([
    // Novo membro entra como DIRETO do filho escolhido
    base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: targetDirect.referred_id,
      referrer_name: targetDirect.referred_name,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: "direct",
      is_spillover: true,
      level: 1,
    }),
    // E como INDIRETO do indicador original
    base44.asServiceRole.entities.NetworkRelation.create({
      referrer_id: referrerId,
      referrer_name: referrerName,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: "indirect",
      is_spillover: true,
      level: 2,
    }),
    // Atualizar referrer do novo membro para o filho que o absorveu
    base44.asServiceRole.entities.Partner.update(newPartnerId, {
      referrer_id: targetDirect.referred_id,
      referrer_name: targetDirect.referred_name,
    }),
  ]);

  // Verificar se completou o grupo após o derramamento
  const newTotalIndiretos = totalIndiretosDoPai + 1;
  if (newTotalIndiretos >= 9) {
    console.log(`[3x3] GRUPO FECHADO! ${referrerName} completou 12 membros!`);
    const referrerData =
      await base44.asServiceRole.entities.Partner.get(referrerId);
    if (referrerData) {
      await base44.asServiceRole.entities.Partner.update(referrerId, {
        groups_formed: (referrerData.groups_formed || 0) + 1,
      });
    }
  }
}
