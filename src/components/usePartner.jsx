import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Gera código único aleatório garantindo unicidade no banco
async function generateUniqueCode() {
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const existing = await base44.entities.Partner.filter({ unique_code: code });
    if (existing.length === 0) isUnique = true;
  }
  return code;
}

// Cria Partner mínimo para usuário autenticado sem Partner
async function createPartnerForUser(me) {
  console.log("[usePartner] Criando Partner automático para:", me.email, "id:", me.id);
  const uniqueCode = await generateUniqueCode();
  const partnerData = {
    user_id: me.id,
    email: me.email,
    full_name: me.full_name || me.email,
    birth_date: "1900-01-01",
    gender: "prefiro_nao_informar",
    phone: "00000000000",
    status: "pendente",
    pending_reasons: ["Falta da primeira compra", "Falta de informações no cadastro"],
    graduation: "cliente_iniciante",
    graduation_start_date: new Date().toISOString().split("T")[0],
    first_purchase_done: false,
    total_bonus_generated: 0,
    bonus_for_withdrawal: 0,
    bonus_for_purchases: 0,
    total_withdrawn: 0,
    total_spent_purchases: 0,
    groups_formed: 0,
    unique_code: uniqueCode,
    accepted_terms: false,
    accepted_rules: false,
    notification_email: true,
    notification_sms: false,
    notification_whatsapp: false,
    notification_frequency: "semanalmente",
    email_verified: false,
    phone_verified: false,
  };

  try {
    const created = await base44.entities.Partner.create(partnerData);
    console.log("[usePartner] Partner criado com sucesso. ID:", created?.id, "Código:", uniqueCode);
    return created;
  } catch (err) {
    console.error("[usePartner] FALHA ao criar Partner automático:", err);
    throw err;
  }
}

/**
 * Hook central que garante que todo usuário autenticado tem um Partner.
 * Busca por user_id OU por created_by (email) para compatibilidade com registros antigos.
 * Se não encontrar, cria automaticamente.
 *
 * Retorna: { partner, user, loading, reload }
 */
export function usePartner() {
  const [partner, setPartner] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

const load = async () => {
  setLoading(true);
  try {
    if (!base44.auth || !base44.auth.me) {
      console.warn("[usePartner] Auth não disponível ainda.");
      setLoading(false);
      return;
    }

    let me = null;
    try {
      me = await base44.auth.me();
    } catch {
      // Usuário não autenticado — isso é normal
      setLoading(false);
      return;
    }

    if (!me?.id) {
      setLoading(false);
      return;
    }

    setUser(me);

    // Admins: busca Partner existente por email ou user_id, mas NUNCA cria automaticamente
    if (me.role === 'admin') {
      try {
        let adminPartners = await base44.entities.Partner.filter({ user_id: me.id });
        adminPartners = adminPartners.filter(p => p.email === me.email);
        if (!adminPartners.length) {
          adminPartners = await base44.entities.Partner.filter({ email: me.email });
        }
        if (adminPartners.length > 0) {
          const found = adminPartners[0];
          // Gerar unique_code se estiver faltando (mesmo para admin)
          if (!found.unique_code) {
            try {
              const code = await generateUniqueCode();
              await base44.entities.Partner.update(found.id, { unique_code: code });
              found.unique_code = code;
              console.log("[usePartner] Admin: unique_code gerado:", code);
            } catch (e) {
              console.warn("[usePartner] Admin: Não foi possível gerar unique_code:", e);
            }
          }
          setPartner(found);
          console.log("[usePartner] Admin: Partner carregado:", found.full_name);
        } else {
          console.log("[usePartner] Admin sem Partner — OK, não cria automaticamente.");
        }
      } catch (e) {
        console.warn("[usePartner] Admin: erro ao buscar Partner:", e);
      }
      setLoading(false);
      return;
    }

      // Buscar SOMENTE por user_id (identificador único e seguro da sessão)
      let partners = [];
      try {
        partners = await base44.entities.Partner.filter({ user_id: me.id });
        console.log("[usePartner] Busca por user_id:", partners.length, "resultado(s)");
        
        // Se houver múltiplos Partners, usar o mais recente (created_date DESC)
        if (partners.length > 1) {
          partners.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          console.log("[usePartner] Múltiplos Partners encontrados. Usando o mais recente:", partners[0].full_name);
        }
      } catch (e) {
        console.warn("[usePartner] Erro ao buscar por user_id:", e);
      }

      // Se encontrou por user_id mas o email não bate, é um Partner de outro usuário (bug de cadastro)
      // Filtrar apenas Partners cujo email bate com o usuário logado
      if (partners.length > 0) {
        const emailMatch = partners.filter(p => p.email === me.email);
        if (emailMatch.length > 0) {
          partners = emailMatch;
        } else {
          // Nenhum Partner com email correto — ignorar os encontrados e buscar por email
          console.warn("[usePartner] Partner(s) encontrado(s) por user_id mas com email diferente. Buscando por email...");
          partners = [];
          try {
            const byEmail = await base44.entities.Partner.filter({ email: me.email });
            if (byEmail.length > 0) {
              partners = byEmail.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
              // Corrigir user_id no registro encontrado
              if (partners[0].user_id !== me.id) {
                await base44.entities.Partner.update(partners[0].id, { user_id: me.id });
                partners[0].user_id = me.id;
                console.log("[usePartner] user_id corrigido para Partner:", partners[0].full_name);
              }
            }
          } catch (e) {
            console.warn("[usePartner] Erro ao buscar por email:", e);
          }
        }
      }

      if (partners.length > 0) {
        const found = partners[0];
        // Se encontrou mas não tem user_id, preencher automaticamente
        if (!found.user_id && me.id) {
          console.log("[usePartner] Partner sem user_id, corrigindo...");
          try {
            await base44.entities.Partner.update(found.id, { user_id: me.id });
            found.user_id = me.id;
          } catch (e) {
            console.warn("[usePartner] Não foi possível corrigir user_id:", e);
          }
        }
        // Se não tem unique_code, gerar um
        if (!found.unique_code) {
          console.log("[usePartner] Partner sem unique_code, gerando...");
          try {
            const code = await generateUniqueCode();
            await base44.entities.Partner.update(found.id, { unique_code: code });
            found.unique_code = code;
          } catch (e) {
            console.warn("[usePartner] Não foi possível gerar unique_code:", e);
          }
        }
        setPartner(found);
        console.log("[usePartner] Partner carregado:", found.full_name, "| código:", found.unique_code);
      } else {
        // Nenhum Partner encontrado → criar automaticamente
        console.warn("[usePartner] Nenhum Partner para", me.email, "— criando automaticamente...");
        const created = await createPartnerForUser(me);
        setPartner(created);
      }
    } catch (error) {
      console.error("[usePartner] Erro geral:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { partner, user, loading, reload: load };
}