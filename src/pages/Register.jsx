import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuthCustom } from "@/components/AuthContextCustom";
import LoginForm from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, UserPlus, LogIn, Shield, Users, Zap } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const { register: authRegister, isAuthenticated } = useAuthCustom();
  const [activeTab, setActiveTab] = useState("login");
  const [referrerCode, setReferrerCode] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerPartnerId, setReferrerPartnerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingReferrer, setLoadingReferrer] = useState(true);
  const [invalidReferrer, setInvalidReferrer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "", birth_date: "", gender: "", email: "",
    phone: "", password: "", accepted_terms: false, accepted_rules: false
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ valid: false, message: "" });

  const DEFAULT_REFERRER_CODE = "WKK321P5";

  useEffect(() => {
    if (isAuthenticated()) navigate(createPageUrl("Dashboard"));
    checkFirstUser();
  }, [isAuthenticated]);

  const checkFirstUser = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("ref");
      const tab = urlParams.get("tab");
      if (tab === "register") setActiveTab("register");
      if (code) { setReferrerCode(code); await loadReferrer(code); }
      else { setReferrerCode(DEFAULT_REFERRER_CODE); await loadReferrer(DEFAULT_REFERRER_CODE); }
    } catch { setLoadingReferrer(false); }
  };

  const loadReferrer = async (code) => {
    try {
      const normalizedCode = code.trim().toUpperCase();
      const partners = await base44.entities.Partner.filter({ unique_code: normalizedCode });
      if (partners.length > 0) {
        setReferrerName(partners[0].display_name || partners[0].full_name);
        setReferrerPartnerId(partners[0].id);
        setInvalidReferrer(false);
      } else {
        if (normalizedCode === DEFAULT_REFERRER_CODE) {
          setReferrerName("Sem indicador"); setReferrerPartnerId(null); setInvalidReferrer(false);
        } else { setInvalidReferrer(true); }
      }
    } catch { setInvalidReferrer(false); setReferrerName("Sem indicador"); setReferrerPartnerId(null); }
    finally { setLoadingReferrer(false); }
  };

  const validatePassword = (password) => {
    if (password.length < 8) return { valid: false, message: "Mínimo 8 caracteres" };
    if (!/[A-Z]/.test(password)) return { valid: false, message: "Precisa ter letra maiúscula" };
    if (!/[a-z]/.test(password)) return { valid: false, message: "Precisa ter letra minúscula" };
    if (!/[0-9]/.test(password)) return { valid: false, message: "Precisa ter um número" };
    return { valid: true, message: "Senha válida ✓" };
  };

  const validateAge = (birthDate) => {
    const today = new Date(); const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 15;
  };

  const formatPhone = (value) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7,11)}`;
  };

  const handleChange = (field, value) => {
    if (field === "phone") value = formatPhone(value);
    if (field === "password") setPasswordStrength(validatePassword(value));
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const generateUniqueCode = async () => {
    let code, isUnique = false;
    while (!isUnique) {
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const existing = await base44.entities.Partner.filter({ unique_code: code });
      if (existing.length === 0) isUnique = true;
    }
    return code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Nome completo é obrigatório";
    if (!formData.birth_date) newErrors.birth_date = "Data de nascimento é obrigatória";
    else if (!validateAge(formData.birth_date)) newErrors.birth_date = "Você precisa ter pelo menos 15 anos";
    if (!formData.gender) newErrors.gender = "Gênero é obrigatório";
    if (!formData.email) newErrors.email = "E-mail é obrigatório";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "E-mail inválido";
    if (!formData.phone || formData.phone.replace(/\D/g, "").length < 11) newErrors.phone = "Telefone com DDD é obrigatório";
    if (!passwordStrength.valid) newErrors.password = passwordStrength.message || "Senha inválida";
    if (!formData.accepted_terms) newErrors.accepted_terms = "Você precisa aceitar o contrato";
    if (!formData.accepted_rules) newErrors.accepted_rules = "Você precisa aceitar o regimento";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); toast.error("Corrija os campos destacados."); return; }

    setLoading(true);
    try {
      const uniqueCode = await generateUniqueCode();
      await authRegister(formData.full_name, formData.email, formData.password, referrerPartnerId, referrerName);
      const partnerData = {
        user_id: "pending", email: formData.email, full_name: formData.full_name,
        birth_date: formData.birth_date, gender: formData.gender, phone: formData.phone,
        referrer_id: referrerPartnerId || null, referrer_name: referrerName || null,
        status: "pendente", pending_reasons: ["Falta da primeira compra", "Falta de informações no cadastro"],
        graduation: "cliente_iniciante", graduation_start_date: new Date().toISOString().split("T")[0],
        first_purchase_done: false, total_bonus_generated: 0, bonus_for_withdrawal: 0,
        bonus_for_purchases: 0, total_withdrawn: 0, total_spent_purchases: 0, groups_formed: 0,
        notification_email: true, notification_sms: false, notification_whatsapp: false,
        notification_frequency: "semanalmente", email_verified: false, phone_verified: false,
        accepted_terms: true, accepted_rules: true, unique_code: uniqueCode,
        display_name: formData.full_name.split(" ")[0]
      };
      const res = await base44.functions.invoke('registerPartner', {
        partnerData: { ...partnerData, _origin: window.location.origin },
        referrerPartnerId: referrerPartnerId || null, referrerName: referrerName || null
      });
      if (!res.data?.partner?.id) throw new Error("Falha ao criar perfil: " + (res.data?.error || "Tente novamente."));
      toast.success("🎉 Cadastro realizado! Use seu e-mail e senha para entrar.", { duration: 5000 });
      setFormData({ full_name: "", birth_date: "", gender: "", email: "", phone: "", password: "", accepted_terms: false, accepted_rules: false });
      setPasswordStrength({ valid: false, message: "" });
      setTimeout(() => { setActiveTab("login"); setLoading(false); }, 1500);
    } catch (xe) {
      const msg = xe?.response?.data?.message || xe?.response?.data?.error || xe?.message || "";
      const isEmailDup = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist") || msg.toLowerCase().includes("email") || xe?.response?.status === 409;
      if (isEmailDup) { toast.error("E-mail já cadastrado. Faça login."); setErrors(p => ({ ...p, email: "E-mail já cadastrado" })); }
      else toast.error("Erro: " + (msg || "Tente novamente."));
      setLoading(false);
    }
  };

  if (loadingReferrer) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (invalidReferrer) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Link Inválido</h2>
          <p className="text-gray-400 text-sm">O código de indicação não foi encontrado. Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex-col justify-between p-12 border-r border-zinc-800">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-black text-white text-lg">3</div>
            <div>
              <p className="text-white font-black text-lg leading-none">Sociedade de</p>
              <p className="text-orange-500 font-black text-lg leading-none">Consumidores</p>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Seu dinheiro<br/><span className="text-orange-500">trabalhando</span><br/>por você.
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Junte-se à rede e receba bônus pelas compras da sua equipe toda semana.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { icon: Zap, title: "Bônus Semanais", desc: "Receba toda segunda-feira" },
            { icon: Users, title: "Rede 3x3", desc: "Sistema inteligente de indicações" },
            { icon: Shield, title: "Garantia Total", desc: "Devolução sem perguntas" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-gray-500 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-black text-white">3</div>
            <p className="text-white font-black text-lg">Sociedade de <span className="text-orange-500">Consumidores</span></p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-8">
            <button onClick={() => setActiveTab("login")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "login" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              <LogIn className="w-4 h-4" /> Entrar
            </button>
            <button onClick={() => setActiveTab("register")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "register" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              <UserPlus className="w-4 h-4" /> Cadastrar
            </button>
          </div>

          {activeTab === "login" ? (
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h2>
              <p className="text-gray-400 text-sm mb-6">Acesse seu Escritório Virtual</p>
              <LoginForm onLoginSuccess={() => navigate(createPageUrl("Dashboard"))} />
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Criar conta</h2>
              <p className="text-gray-400 text-sm mb-6">Preencha os dados abaixo para se cadastrar</p>

              {referrerName && referrerName !== "Sem indicador" && (
                <div className="mb-5 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{referrerName[0]}</span>
                  </div>
                  <div>
                    <p className="text-orange-400 text-xs">Indicado por</p>
                    <p className="text-white font-semibold text-sm">{referrerName}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm mb-1.5 block">Nome Completo *</Label>
                  <Input value={formData.full_name} onChange={e => handleChange("full_name", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11" placeholder="Seu nome completo" />
                  {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 text-sm mb-1.5 block">Nascimento *</Label>
                    <Input type="date" value={formData.birth_date} onChange={e => handleChange("birth_date", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11" />
                    {errors.birth_date && <p className="text-red-400 text-xs mt-1">{errors.birth_date}</p>}
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm mb-1.5 block">Telefone *</Label>
                    <Input value={formData.phone} onChange={e => handleChange("phone", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11" placeholder="(11) 99999-9999" maxLength={15} />
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm mb-1.5 block">Gênero *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[["masculino","Masculino"],["feminino","Feminino"],["outro","Outro"],["prefiro_nao_informar","Prefiro não informar"]].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => handleChange("gender", v)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${formData.gender === v ? "bg-orange-500 border-orange-500 text-white" : "bg-zinc-900 border-zinc-700 text-gray-400 hover:border-zinc-500"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
                </div>

                <div>
                  <Label className="text-gray-300 text-sm mb-1.5 block">E-mail *</Label>
                  <Input type="email" value={formData.email} onChange={e => handleChange("email", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11" placeholder="seu@email.com" />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label className="text-gray-300 text-sm mb-1.5 block">Senha *</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => handleChange("password", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11 pr-10" placeholder="Mín. 8 chars, maiúscula e número" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.password && (
                    <p className={`text-xs mt-1 ${passwordStrength.valid ? "text-green-500" : "text-yellow-500"}`}>{passwordStrength.message}</p>
                  )}
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="terms" checked={formData.accepted_terms} onCheckedChange={v => handleChange("accepted_terms", v)}
                      className="border-zinc-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 mt-0.5" />
                    <label htmlFor="terms" className="text-gray-400 text-sm cursor-pointer">
                      Li e aceito o{" "}
                      <button type="button" onClick={() => setTermsOpen(true)} className="text-orange-400 hover:text-orange-300 font-medium underline">Contrato de Serviços</button>
                    </label>
                  </div>
                  {errors.accepted_terms && <p className="text-red-400 text-xs pl-6">{errors.accepted_terms}</p>}
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="rules" checked={formData.accepted_rules} onCheckedChange={v => handleChange("accepted_rules", v)}
                      className="border-zinc-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 mt-0.5" />
                    <label htmlFor="rules" className="text-gray-400 text-sm cursor-pointer">
                      Li e aceito o{" "}
                      <button type="button" onClick={() => setRulesOpen(true)} className="text-orange-400 hover:text-orange-300 font-medium underline">Regimento Interno</button>
                    </label>
                  </div>
                  {errors.accepted_rules && <p className="text-red-400 text-xs pl-6">{errors.accepted_rules}</p>}
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base mt-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Cadastrando...</> : <><CheckCircle className="w-4 h-4 mr-2" />Criar Conta</>}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">Contrato de Prestação de Serviços</DialogTitle></DialogHeader>
          <div className="text-gray-300 text-sm space-y-4">
            <p className="text-red-400 font-bold">NUNCA CAIA EM GOLPES</p>
            <p className="text-red-300"><strong>ATENÇÃO:</strong> A SOCIEDADE DE CONSUMIDORES NUNCA envia cobrança por PIX. A única forma de pagamento é por boleto gerado em nosso sistema.</p>
            <p className="text-yellow-300"><strong>ATENÇÃO:</strong> NUNCA GASTE SEU DINHEIRO fazendo compras exageradas. Use nosso sistema de GERAÇÃO de BÔNUS.</p>
            <p className="text-green-400 font-bold">GARANTIA ABSOLUTA! Se não estiver satisfeito, devolvemos o seu dinheiro sem perguntas.</p>
            <p><strong>CLÁUSULA 1 – DO OBJETO:</strong> Uma PLATAFORMA ONLINE que administra um sistema inteligente de SOCIEDADE DE CONSUMIDORES e distribuição de BÔNUS entre seus associados.</p>
            <p><strong>CLÁUSULA 2 – DEVERES DA GESTORA:</strong> Prestar atendimento, disponibilizar Escritório Virtual, manter o sistema e emitir notas fiscais.</p>
            <p><strong>CLÁUSULA 3 – DEVERES DO CLIENTE:</strong> Usar o site pessoal para divulgação, efetuar compras mensais, ser maior de 15 anos e não ostentar em redes sociais.</p>
            <p><strong>CLÁUSULA 4 – DO FÓRUM:</strong> Câmara de Intermediação da comarca de São Paulo.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">Regimento Interno</DialogTitle></DialogHeader>
          <div className="text-gray-300 text-sm space-y-4">
            <p className="text-red-400 font-bold">NUNCA CAIA EM GOLPES</p>
            <p className="text-yellow-300"><strong>ATENÇÃO:</strong> NUNCA GASTE SEU DINHEIRO fazendo compras exageradas. FAÇA SOMENTE AS COMPRAS MÍNIMAS MENSAIS.</p>
            <p className="text-green-400 font-bold">GARANTIA ABSOLUTA!</p>
            <p><strong>REGIMENTO 2 – PAGAMENTOS:</strong> Nosso sistema permite pagar seus boletos com seus BÔNUS através de PIX ou código de barras.</p>
            <p><strong>REGIMENTO 5 – STATUS:</strong> ATIVO (em dia), PENDENTE (pendências), EXCLUÍDO (fraudes).</p>
            <p><strong>REGIMENTO 11 – DEPÓSITOS:</strong> Valor mínimo R$ 30,00. Depositado automaticamente toda segunda-feira.</p>
            <p><strong>REGIMENTO 12 – GERAÇÃO DE BÔNUS:</strong> Até 40% do valor da compra dos seus clientes. 50% para saque e 50% para compras.</p>
            <p><strong>REGIMENTO 14 – GRADUAÇÃO:</strong> LÍDER (60), ESTRELA (120), BRONZE (240), PRATA (480), OURO (960) clientes ativos.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}