import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const [referrerCode, setReferrerCode] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerPartnerId, setReferrerPartnerId] = useState(null);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingReferrer, setLoadingReferrer] = useState(true);
  const [invalidReferrer, setInvalidReferrer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    birth_date: "",
    gender: "",
    email: "",
    phone: "",
    password: "",
    accepted_terms: false,
    accepted_rules: false
  });

  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ valid: false, message: "" });

  useEffect(() => {
    checkFirstUser();
  }, []);

  const checkFirstUser = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("ref");
      
      if (code) {
        setReferrerCode(code);
        loadReferrer(code);
      } else {
        // Sem código de indicação — NOT verificar se é primeiro usuário
        // Pois a página de Register é pública e não deve fazer chamadas autenticadas
        // Sempre exigir link de indicação exceto se o app disser explicitamente que é o primeiro
        setLoadingReferrer(false);
      }
    } catch (error) {
      console.error("Error checking first user:", error);
      setLoadingReferrer(false);
    }
  };

  const handleManualReferrerCode = async (code) => {
    if (!code || code.trim().length < 3) {
      setReferrerPartnerId(null);
      setReferrerName("");
      return;
    }
    try {
      const partners = await base44.entities.Partner.filter({ unique_code: code.trim().toUpperCase() });
      if (partners.length > 0) {
        setReferrerName(partners[0].display_name || partners[0].full_name);
        setReferrerPartnerId(partners[0].id);
        setErrors(prev => ({ ...prev, referrer: "" }));
      } else {
        setReferrerPartnerId(null);
        setReferrerName("");
      }
    } catch (e) {
      setReferrerPartnerId(null);
    }
  };

 const loadReferrer = async (code) => {
  try {
    const normalizedCode = code.trim().toUpperCase();

    const partners = await base44.entities.Partner.filter({
      unique_code: normalizedCode
    });

    if (partners.length > 0) {
      setReferrerName(partners[0].display_name || partners[0].full_name);
      setReferrerPartnerId(partners[0].id);
      setInvalidReferrer(false);
    } else {
      setInvalidReferrer(true);
    }
  } catch (error) {
    console.error("Error loading referrer:", error);
    setInvalidReferrer(true);
  } finally {
    setLoadingReferrer(false);
  }
};

  const validatePassword = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    if (!isLongEnough) {
      return { valid: false, message: "Mínimo 8 caracteres" };
      }
      if (!hasUpperCase) {
      return { valid: false, message: "Precisa ter letra maiúscula (ex: A, B, C)" };
      }
      if (!hasLowerCase) {
      return { valid: false, message: "Precisa ter letra minúscula (ex: a, b, c)" };
      }
      if (!hasNumber) {
      return { valid: false, message: "Precisa ter um número (ex: 1, 2, 3)" };
      }
    return { valid: true, message: "Senha válida ✓" };
  };

  const validateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 15;
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleChange = (field, value) => {
    if (field === "phone") {
      value = formatPhone(value);
    }
    if (field === "password") {
      setPasswordStrength(validatePassword(value));
    }
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const generateUniqueCode = async () => {
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const existing = await base44.entities.Partner.filter({ unique_code: code });
      if (existing.length === 0) {
        isUnique = true;
      }
    }
    
    return code;
  };

  // Matriz 3x3: cada parceiro tem 3 diretos, cada direto recebe até 3 (nível 2) = 12 membros por grupo
  // Distribuição: ROUND-ROBIN SEQUENCIAL pela ordem de criação dos diretos
  // 4º→D1, 5º→D2, 6º→D3, 7º→D1, 8º→D2, 9º→D3, 10º→D1, 11º→D2, 12º→D3
  // Ao completar 12 → incrementa groups_formed e inicia novo grupo automaticamente
  const createNetworkRelationsWithSpillover = async (referrerId, referrerName, newPartnerId, newPartnerName) => {
    // Buscar avô do indicador (para relação indireta nível 2)
    const grandpaRelations = await base44.entities.NetworkRelation.filter({
      referred_id: referrerId,
      relation_type: "direct"
    });
    const grandpa = grandpaRelations.length > 0 ? grandpaRelations[0] : null;

    // Buscar diretos do indicador ordenados por criação (round-robin sequencial)
    const directRelations = await base44.entities.NetworkRelation.filter({
      referrer_id: referrerId,
      relation_type: "direct"
    });

    // Ordenar por created_date para garantir ordem determinística
    const sortedDirects = directRelations.sort((a, b) =>
      new Date(a.created_date) - new Date(b.created_date)
    );
    const directCount = sortedDirects.length;
    console.log(`[3x3] ${referrerName} tem ${directCount} diretos`);

    // ── FASE 1: Menos de 3 diretos → entra como DIRETO ──
    if (directCount < 3) {
      await base44.entities.NetworkRelation.create({
        referrer_id: referrerId,
        referrer_name: referrerName,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "direct",
        is_spillover: false,
        level: 1
      });
      console.log(`[3x3] DIRETO ${directCount + 1}/3 de ${referrerName}`);

      // Relação indireta com avô (sempre que existir)
      if (grandpa) {
        await base44.entities.NetworkRelation.create({
          referrer_id: grandpa.referrer_id,
          referrer_name: grandpa.referrer_name,
          referred_id: newPartnerId,
          referred_name: newPartnerName,
          relation_type: "indirect",
          is_spillover: false,
          level: 2
        });
        console.log(`[3x3] Relação indireta criada com avô: ${grandpa.referrer_name}`);
      }
      return;
    }

    // ── FASE 2: 3 diretos completos → ROUND-ROBIN para o nível 2 ──
    // Contar total de indiretos já distribuídos para calcular o índice correto
    const indirectRelations = await base44.entities.NetworkRelation.filter({
      referrer_id: referrerId,
      relation_type: "indirect"
    });
    const totalDistribuidos = indirectRelations.length;
    console.log(`[3x3] Total indiretos já distribuídos: ${totalDistribuidos}`);

    // Verificar se ainda há espaço no grupo atual (máx 9 indiretos = 3×3)
    if (totalDistribuidos < 9) {
      // Round-robin: índice baseado no total já distribuído
      const roundRobinIndex = totalDistribuidos % 3;
      const targetDirect = sortedDirects[roundRobinIndex];
      console.log(`[3x3] Round-robin index ${roundRobinIndex} → derramando para ${targetDirect.referred_name}`);

      // Criar como DIRETO do filho escolhido (spillover)
      await base44.entities.NetworkRelation.create({
        referrer_id: targetDirect.referred_id,
        referrer_name: targetDirect.referred_name,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "direct",
        is_spillover: true,
        level: 1
      });

      // Criar como INDIRETO do dono do grupo (referrerId = "avô" desta pessoa)
      await base44.entities.NetworkRelation.create({
        referrer_id: referrerId,
        referrer_name: referrerName,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "indirect",
        is_spillover: true,
        level: 2
      });

      // Atualizar Partner: pai real é o direto de destino
      await base44.entities.Partner.update(newPartnerId, {
        referrer_id: targetDirect.referred_id,
        referrer_name: targetDirect.referred_name
      });

      // Verificar fechamento do grupo (3 diretos + 9 indiretos = 12)
      const newTotal = totalDistribuidos + 1;
      if (newTotal >= 9) {
        console.log(`[3x3] GRUPO FECHADO! ${referrerName} completou 12 membros!`);
        // Incrementar groups_formed no parceiro indicador
        const referrerPartner = await base44.entities.Partner.filter({ id: referrerId });
        if (referrerPartner.length > 0) {
          await base44.entities.Partner.update(referrerId, {
            groups_formed: (referrerPartner[0].groups_formed || 0) + 1
          });
          console.log(`[3x3] groups_formed incrementado para ${referrerPartner[0].full_name}`);
        }
      }
      return;
    }

    // ── FASE 3: Grupo completo (9 indiretos) → NOVO GRUPO ──
    console.log(`[3x3] Grupo completo! Iniciando NOVO GRUPO para ${referrerName}`);
    await base44.entities.NetworkRelation.create({
      referrer_id: referrerId,
      referrer_name: referrerName,
      referred_id: newPartnerId,
      referred_name: newPartnerName,
      relation_type: "direct",
      is_spillover: false,
      level: 1
    });
    console.log(`[3x3] ${newPartnerName} é o 1º direto do novo grupo de ${referrerName}`);

    // Relação indireta com avô mantida no novo grupo também
    if (grandpa) {
      await base44.entities.NetworkRelation.create({
        referrer_id: grandpa.referrer_id,
        referrer_name: grandpa.referrer_name,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "indirect",
        is_spillover: false,
        level: 2
      });
      console.log(`[3x3] Relação indireta com avô mantida no novo grupo: ${grandpa.referrer_name}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};

    if (!formData.full_name.trim()) newErrors.full_name = "Nome completo é obrigatório";
    if (!formData.birth_date) {
      newErrors.birth_date = "Data de nascimento é obrigatória";
    } else if (!validateAge(formData.birth_date)) {
      newErrors.birth_date = "Você precisa ter pelo menos 15 anos";
    }
    if (!formData.gender) newErrors.gender = "Gênero é obrigatório";
    if (!formData.email) {
      newErrors.email = "E-mail é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "E-mail inválido";
    }
    if (!formData.phone || formData.phone.replace(/\D/g, "").length < 11) {
      newErrors.phone = "Telefone com DDD é obrigatório (ex: 11 99999-9999)";
    }
    if (!passwordStrength.valid) newErrors.password = passwordStrength.message || "Senha inválida";
    if (!formData.accepted_terms) newErrors.accepted_terms = "Você precisa aceitar o contrato";
    if (!formData.accepted_rules) newErrors.accepted_rules = "Você precisa aceitar o regimento";
    if (!isFirstUser && !referrerPartnerId) newErrors.referrer = "Indicador inválido ou não encontrado";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Por favor, corrija os campos destacados em vermelho.");
      return;
    }

    setLoading(true);
    try {
      // ETAPA 1: Gerar código único
      const uniqueCode = await generateUniqueCode();

      // ETAPA 2: Criar conta de autenticação
      const registeredUser = await base44.auth.register({ email: formData.email, password: formData.password, full_name: formData.full_name });

      // Aguardar token propagar
      await new Promise(resolve => setTimeout(resolve, 1500));
      const authenticatedUser = await base44.auth.me();

      // ETAPA 3: Criar Partner via backend function
      const partnerData = {
        user_id: authenticatedUser?.id || registeredUser?.id,
        email: formData.email,
        full_name: formData.full_name,
        birth_date: formData.birth_date,
        gender: formData.gender,
        phone: formData.phone,
        referrer_id: referrerPartnerId || null,
        referrer_name: referrerName || null,
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
        notification_email: true,
        notification_sms: false,
        notification_whatsapp: false,
        notification_frequency: "semanalmente",
        email_verified: false,
        phone_verified: false,
        accepted_terms: true,
        accepted_rules: true,
        unique_code: uniqueCode,
        display_name: formData.full_name.split(" ")[0]
      };

      const res = await base44.functions.invoke('registerPartner', {
        partnerData: { ...partnerData, _origin: window.location.origin },
        referrerPartnerId: referrerPartnerId || null,
        referrerName: referrerName || null
      });

      if (!res.data?.partner?.id) {
        throw new Error("Falha ao criar perfil: " + (res.data?.error || "Tente novamente."));
      }

      toast.success("Cadastro realizado com sucesso! Bem-vindo(a)!");
      navigate(createPageUrl("Dashboard"));

    } catch (xe) {
  console.error("[Register] ERRO COMPLETO:", xe);
  console.error("[Register] MESSAGE:", xe?.message);
  console.error("[Register] RESPONSE:", xe?.response);
  console.error("[Register] DATA:", xe?.response?.data);

  toast.error("Erro ao cadastrar: " + (xe.message || "Tente novamente."));
  setLoading(false);
}
  };

  if (loadingReferrer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (invalidReferrer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-950 border-orange-500/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Link Inválido</h2>
            <p className="text-gray-400">
              O código de indicação fornecido não foi encontrado. Verifique o link e tente novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sem link de indicação e já existem parceiros — precisa de link
  if (!isFirstUser && !referrerPartnerId && !referrerCode && referrerName === "") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-950 border-orange-500/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Link de Indicação Necessário</h2>
            <p className="text-gray-400 mb-4">
              Para se cadastrar, você precisa acessar pelo link de indicação de um parceiro ativo.
            </p>
            <p className="text-gray-500 text-sm">
              Peça o link personalizado para a pessoa que te indicou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      {/* Dialogs FORA do form — evita HTML inválido e submissão acidental */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Contrato de Prestação de Serviços</DialogTitle>
          </DialogHeader>
          <div className="text-gray-300 text-sm space-y-4">
            <p className="text-red-400 font-bold">NUNCA CAIA EM GOLPES</p>
            <p className="text-red-300"><strong>ATENÇÃO:</strong> A SOCIEDADE DE CONSUMIDORES NUNCA envia cobrança por PIX. A única forma de pagamento é por boleto gerado em nosso sistema por COMPRA DE PRODUTOS E SERVIÇOS. Os boletos podem ser pagos com PIX.</p>
            <p>Fique atento com e-mails falsos pedindo pagamento ou enviando boletos.</p>
            <p className="text-yellow-300"><strong>ATENÇÃO:</strong> NUNCA GASTE SEU DINHEIRO fazendo compras exageradas em nossa plataforma. Use nosso sistema de GERAÇÃO de BÔNUS para fazer suas compras.</p>
            <p className="text-green-400 font-bold">GARANTIA ABSOLUTA!</p>
            <p>Se não estiver satisfeito, devolvemos o seu dinheiro sem perguntas.</p>
            <p className="mt-4"><strong>Definições de nomenclaturas:</strong></p>
            <p>CLIENTE PARCEIRO, é aquele que participa de nossa SOCIEDADE DE CONSUMIDORES ficando ATIVO na plataforma.</p>
            <p className="mt-4"><strong>CLÁUSULA 1 – DO OBJETO:</strong></p>
            <p>Uma PLATAFORMA ONLINE que administra um sistema inteligente de SOCIEDADE DE CONSUMIDORES e distribuição de BÔNUS entre seus associados. Os BÔNUS são gerados pelas compras dos produtos expostos em nossa loja.</p>
            <p>Todo PARCEIRO ao se cadastrar estará ciente que não possui nenhum vínculo empregatício com a GESTORA.</p>
            <p className="mt-4"><strong>CLÁUSULA 2 – DEVERES DA GESTORA:</strong></p>
            <p>• Prestar atendimento aos clientes por telefone, chat, e-mail, whatsapp ou atendimento presencial.</p>
            <p>• Disponibilizar um ESCRITÓRIO VIRTUAL onde cada PARCEIRO poderá administrar seu PRÓPRIO NEGÓCIO.</p>
            <p>• Manter o sistema em funcionamento e realizar depósitos semanalmente.</p>
            <p>• Emitir notas fiscais a cada produto comprado.</p>
            <p className="mt-4"><strong>CLÁUSULA 3 – DEVERES DO CLIENTE ASSOCIADO:</strong></p>
            <p>• Usar o site pessoal GRATUITO para divulgação e cadastramento de novos CLIENTES.</p>
            <p>• Efetuar as compras mensais e seguir os regulamentos do REGIMENTO INTERNO.</p>
            <p>• Ser maior de 15 anos completos e ter endereço físico.</p>
            <p>• Não OSTENTAR em redes sociais.</p>
            <p className="mt-4"><strong>CLÁUSULA 4 – DO FORUM:</strong></p>
            <p>Escolhem a CÂMARA DE INTERMEDIAÇÃO da comarca de São Paulo, para dirimir quaisquer questões oriundas deste contrato.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Regimento Interno</DialogTitle>
          </DialogHeader>
          <div className="text-gray-300 text-sm space-y-4">
            <p className="text-red-400 font-bold">NUNCA CAIA EM GOLPES</p>
            <p className="text-red-300"><strong>ATENÇÃO:</strong> A SOCIEDADE DE CONSUMIDORES NUNCA envia cobrança por PIX. A única forma de pagamento é por boleto gerado em nosso sistema por COMPRA DE PRODUTOS E SERVIÇOS.</p>
            <p className="text-yellow-300"><strong>ATENÇÃO:</strong> NUNCA GASTE SEU DINHEIRO fazendo compras exageradas em nossa plataforma. FAÇA SOMENTE AS COMPRAS MÍNIMAS MENSAIS.</p>
            <p className="text-green-400 font-bold">GARANTIA ABSOLUTA!</p>
            <p>Se não estiver satisfeito, devolvemos o seu dinheiro sem perguntas.</p>
            <p className="mt-4"><strong>REGIMENTO 1 – NOMENCLATURAS</strong></p>
            <p>• BÔNUS: Saldo gerado pelas compras de seus clientes cadastrados.</p>
            <p>• CLIENTE ATIVO: Faz compras mensais e está em dia.</p>
            <p>• CLIENTE PENDENTE: Tem pendências na plataforma.</p>
            <p className="mt-4"><strong>REGIMENTO 2 – PAGAMENTO DOS BOLETOS</strong></p>
            <p>Nosso sistema permite pagar seus boletos com seus BÔNUS através de PIX ou código de barras.</p>
            <p className="mt-4"><strong>REGIMENTO 5 – STATUS</strong></p>
            <p>• ATIVO: Em dia com todos os compromissos.</p>
            <p>• PENDENTE: Falta de compra, informações ou autorização.</p>
            <p>• EXCLUÍDO: Fraudes ou descumprimento do regimento.</p>
            <p className="mt-4"><strong>REGIMENTO 10 – CONTA BANCÁRIA</strong></p>
            <p>Deverá ter uma conta bancária cadastrada no seu próprio CPF. Depósitos não podem ser feitos em conta de terceiros.</p>
            <p className="mt-4"><strong>REGIMENTO 11 – DEPÓSITOS EM CONTA</strong></p>
            <p>Valor mínimo para DEPÓSITO: R$ 30,00. Depositado AUTOMATICAMENTE toda segunda-feira.</p>
            <p className="mt-4"><strong>REGIMENTO 12 – GERAÇÃO DE BÔNUS</strong></p>
            <p>A geração de BÔNUS pode chegar a até 40% do valor da compra dos seus clientes. 50% para saque e 50% para compras.</p>
            <p className="mt-4"><strong>REGIMENTO 14 – GRADUAÇÃO</strong></p>
            <p>• LÍDER: 60 clientes ativos, até 32% de bônus.</p>
            <p>• ESTRELA: 120 clientes ativos, até 34% de bônus.</p>
            <p>• BRONZE: 240 clientes ativos, até 36% de bônus.</p>
            <p>• PRATA: 480 clientes ativos, até 38% de bônus.</p>
            <p>• OURO: 960 clientes ativos, até 40% de bônus.</p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">Sociedade de</h1>
          <h1 className="text-3xl font-bold text-white">Consumidores</h1>
          <p className="text-gray-400 mt-2">Cadastre-se e comece a gerar bônus</p>
        </div>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white">Formulário de Cadastro</CardTitle>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => base44.auth.redirectToLogin(createPageUrl("Dashboard"))}
                className="text-orange-500 hover:text-orange-400 text-sm font-medium border border-orange-500/30 rounded-lg px-4 py-2 hover:bg-orange-500/10 transition-colors"
              >
                Já tem uma conta? Faça login
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Referrer Info */}
              {isFirstUser ? (
                <div className="p-4 bg-orange-500/20 rounded-lg border border-orange-500/40">
                  <Label className="text-orange-400 text-sm">Primeiro Cadastro</Label>
                  <p className="text-white font-semibold text-lg">Cadastro Administrador (sem indicador)</p>
                </div>
              ) : referrerPartnerId ? (
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <Label className="text-gray-400 text-sm">Indicador</Label>
                  <p className="text-white font-semibold text-lg">{referrerName}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-white">Código do Indicador *</Label>
                  <Input
                    placeholder="Digite o código do seu indicador"
                    className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 uppercase"
                    onChange={(e) => handleManualReferrerCode(e.target.value)}
                  />
                  {referrerPartnerId === null && referrerName && (
                    <p className="text-green-500 text-sm">Indicador: {referrerName} ✓</p>
                  )}
                  {errors.referrer && <p className="text-red-500 text-sm">{errors.referrer}</p>}
                  <p className="text-gray-500 text-xs">Peça o código para a pessoa que te indicou</p>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-white">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
                  placeholder="Seu nome completo"
                />
                {errors.full_name && <p className="text-red-500 text-sm">{errors.full_name}</p>}
              </div>

              {/* Birth Date */}
              <div className="space-y-2">
                <Label htmlFor="birth_date" className="text-white">Data de Nascimento *</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => handleChange("birth_date", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
                />
                {errors.birth_date && <p className="text-red-500 text-sm">{errors.birth_date}</p>}
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label className="text-white">Gênero *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "masculino", label: "Masculino" },
                    { value: "feminino", label: "Feminino" },
                    { value: "outro", label: "Outro" },
                    { value: "prefiro_nao_informar", label: "Prefiro não informar" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange("gender", opt.value)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        formData.gender === opt.value
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-zinc-900 border-zinc-700 text-gray-300 hover:border-orange-500 hover:text-orange-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className="text-red-500 text-sm">{errors.gender}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
                  placeholder="seu@email.com"
                />
                {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Telefone com DDD *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500"
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
                {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 pr-10"
                    placeholder="Crie uma senha forte"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className={`text-sm ${passwordStrength.valid ? "text-green-500" : "text-yellow-500"}`}>
                  {passwordStrength.message || "Mínimo 8 caracteres, maiúscula, minúscula e número"}
                </p>
                {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
              </div>

              {/* Terms */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={formData.accepted_terms}
                    onCheckedChange={(checked) => handleChange("accepted_terms", checked)}
                    className="border-orange-500 data-[state=checked]:bg-orange-500"
                  />
                  <div className="flex-1 text-gray-300 text-sm">
                    Li e aceito o{" "}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="text-orange-500 hover:underline font-medium"
                    >
                      Contrato de Prestação de Serviços
                    </button>
                  </div>
                </div>
                {errors.accepted_terms && <p className="text-red-500 text-sm">{errors.accepted_terms}</p>}

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="rules"
                    checked={formData.accepted_rules}
                    onCheckedChange={(checked) => handleChange("accepted_rules", checked)}
                    className="border-orange-500 data-[state=checked]:bg-orange-500"
                  />
                  <div className="flex-1 text-gray-300 text-sm">
                    Li e aceito o{" "}
                    <button
                      type="button"
                      onClick={() => setRulesOpen(true)}
                      className="text-orange-500 hover:underline font-medium"
                    >
                      Regimento Interno
                    </button>
                  </div>
                </div>
                {errors.accepted_rules && <p className="text-red-500 text-sm">{errors.accepted_rules}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-6 text-lg"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                {loading ? "Cadastrando..." : "Cadastrar"}
              </Button>


            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}