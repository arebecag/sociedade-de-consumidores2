import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuthCustom } from "@/components/AuthContextCustom";
import LoginForm from "@/components/LoginForm";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, UserPlus, LogIn, Shield, Users, Zap, TrendingUp, Star, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
  const [step, setStep] = useState(1); // multi-step form

  const [formData, setFormData] = useState({
    full_name: "", birth_date: "", gender: "", email: "",
    phone: "", password: "", accepted_terms: false, accepted_rules: false
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, valid: false, message: "" });

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
      const c = code || DEFAULT_REFERRER_CODE;
      setReferrerCode(c);
      await loadReferrer(c);
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
        } else setInvalidReferrer(true);
      }
    } catch { setInvalidReferrer(false); setReferrerName("Sem indicador"); setReferrerPartnerId(null); }
    finally { setLoadingReferrer(false); }
  };

  const getPasswordScore = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const msgs = ["", "Muito fraca", "Fraca", "Boa", "Forte", "Muito forte"];
    return { score, valid: score >= 4, message: msgs[score] || "" };
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
    if (field === "password") setPasswordStrength(getPasswordScore(value));
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
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

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Obrigatório";
    if (!formData.birth_date) newErrors.birth_date = "Obrigatória";
    else if (!validateAge(formData.birth_date)) newErrors.birth_date = "Mínimo 15 anos";
    if (!formData.gender) newErrors.gender = "Selecione";
    if (!formData.phone || formData.phone.replace(/\D/g, "").length < 11) newErrors.phone = "DDD + número";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = "Obrigatório";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "E-mail inválido";
    if (!passwordStrength.valid) newErrors.password = "Senha fraca";
    if (!formData.accepted_terms) newErrors.accepted_terms = "Necessário";
    if (!formData.accepted_rules) newErrors.accepted_rules = "Necessário";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) { toast.error("Corrija os campos destacados."); return; }

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
      toast.success("🎉 Cadastro realizado! Agora faça login.", { duration: 5000 });
      setFormData({ full_name: "", birth_date: "", gender: "", email: "", phone: "", password: "", accepted_terms: false, accepted_rules: false });
      setPasswordStrength({ score: 0, valid: false, message: "" });
      setStep(1);
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
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-zinc-500 text-sm">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  if (invalidReferrer) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Link Inválido</h2>
          <p className="text-zinc-400 text-sm">O código de indicação não foi encontrado. Verifique o link e tente novamente.</p>
        </motion.div>
      </div>
    );
  }

  const strengthColors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-400"];
  const strengthTextColors = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-green-400", "text-emerald-400"];

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─── LEFT: Branding ─── */}
      <div className="hidden lg:flex lg:w-[44%] relative flex-col overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/80 via-card to-background" />
        {/* Glow orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-orange-500/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-orange-600/6 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-orange-400/4 rounded-full blur-[60px]" />

        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-3">
            <img src="https://media.base44.com/images/public/697d0116fccbb3128aabd5bf/84fd68149_AZz8L_P0CuwhojYm0yGlnQ-AZz8L_P0axgZJ703tpUGAQ1.png" alt="SC 3X3" className="w-12 h-12 object-contain flex-shrink-0" />
            <div>
              <p className="text-white font-black text-lg leading-none">Sociedade de</p>
              <p className="text-orange-500 font-black text-lg leading-none">Consumidores</p>
            </div>
          </motion.div>

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-orange-400 text-xs font-semibold">Plataforma ativa</span>
            </div>
            <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] mb-5">
              Seu dinheiro<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400">trabalhando</span><br />
              por você.
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed max-w-xs">
              Receba bônus semanais pelas compras da sua rede. Pague boletos, contas e muito mais com seus bônus.
            </p>
          </motion.div>

          {/* Feature grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="grid grid-cols-2 gap-3">
            {[
              { icon: Zap, label: "Bônus Semanais", sub: "Toda segunda-feira", color: "text-yellow-400", bg: "bg-yellow-500/8 border-yellow-500/15" },
              { icon: Users, label: "Rede 3×3", sub: "Sistema inteligente", color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/15" },
              { icon: TrendingUp, label: "Até 40% Bônus", sub: "Por compra da rede", color: "text-green-400", bg: "bg-green-500/8 border-green-500/15" },
              { icon: Shield, label: "Garantia Total", sub: "Devolução garantida", color: "text-orange-400", bg: "bg-orange-500/8 border-orange-500/15" },
            ].map(({ icon: Icon, label, sub, color, bg }) => (
              <div key={label} className={`p-4 rounded-2xl border ${bg} backdrop-blur-sm`}>
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <p className="text-white font-semibold text-sm leading-tight">{label}</p>
                <p className="text-zinc-600 text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── RIGHT: Form ─── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto relative">
        <div className="absolute inset-0 bg-background" />

        <div className="relative z-10 flex flex-col justify-center min-h-screen px-4 sm:px-8 py-10">
          <div className="w-full max-w-[440px] mx-auto">

            {/* Mobile logo */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="lg:hidden flex items-center gap-3 mb-10 justify-center">
              <img src="https://media.base44.com/images/public/697d0116fccbb3128aabd5bf/84fd68149_AZz8L_P0CuwhojYm0yGlnQ-AZz8L_P0axgZJ703tpUGAQ1.png" alt="SC 3X3" className="w-11 h-11 object-contain flex-shrink-0" />
              <div>
                <p className="text-white font-black text-base leading-none">Sociedade de</p>
                <p className="text-orange-500 font-black text-base leading-none">Consumidores</p>
              </div>
            </motion.div>

            {/* Tab switcher */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="relative flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1 mb-8">
              <motion.div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20"
                animate={{ x: activeTab === "login" ? 0 : "calc(100% + 8px)" }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
              {[["login", LogIn, "Entrar"], ["register", UserPlus, "Cadastrar"]].map(([tab, Icon, label]) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setStep(1); }}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </motion.div>

            <AnimatePresence mode="wait">
              {activeTab === "login" ? (
                <motion.div key="login"
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.2 }}>
                  <div className="mb-6">
                    <h2 className="text-3xl font-black text-white">Bem-vindo de volta</h2>
                    <p className="text-zinc-500 text-sm mt-1">Acesse seu Escritório Virtual</p>
                  </div>
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
                    <LoginForm onLoginSuccess={() => navigate(createPageUrl("Dashboard"))} />
                  </div>
                </motion.div>

              ) : (
                <motion.div key="register"
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}>

                  <div className="mb-6">
                    <h2 className="text-3xl font-black text-white">Criar sua conta</h2>
                    <p className="text-zinc-500 text-sm mt-1">
                      {step === 1 ? "Passo 1 de 2 — Seus dados" : "Passo 2 de 2 — Acesso e termos"}
                    </p>
                  </div>

                  {/* Step indicator */}
                  <div className="flex items-center gap-2 mb-6">
                    {[1, 2].map((s) => (
                      <React.Fragment key={s}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          step > s ? "bg-green-500 text-white" :
                          step === s ? "bg-orange-500 text-white shadow-md shadow-orange-500/30" :
                          "bg-zinc-800 text-zinc-500"
                        }`}>
                          {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                        {s < 2 && <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${step > s ? "bg-green-500" : "bg-zinc-800"}`} />}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Referrer badge */}
                  {referrerName && referrerName !== "Sem indicador" && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="mb-5 p-3 bg-orange-500/6 border border-orange-500/15 rounded-2xl flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-black">{referrerName[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-500 text-xs">Indicado por</p>
                        <p className="text-white font-bold text-sm truncate">{referrerName}</p>
                      </div>
                      <Star className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    </motion.div>
                  )}

                  {/* Form card */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
                    <AnimatePresence mode="wait">
                      {step === 1 ? (
                        <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
                          className="space-y-4">

                          {/* Name */}
                          <div>
                            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Nome Completo *</label>
                            <Input value={formData.full_name} onChange={e => handleChange("full_name", e.target.value)}
                              className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 rounded-xl h-12 placeholder:text-zinc-600" placeholder="Seu nome completo" />
                            {errors.full_name && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.full_name}</p>}
                          </div>

                          {/* Birth + Phone */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Nascimento *</label>
                              <Input type="date" value={formData.birth_date} onChange={e => handleChange("birth_date", e.target.value)}
                                className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 rounded-xl h-12" />
                              {errors.birth_date && <p className="text-red-400 text-xs mt-1">{errors.birth_date}</p>}
                            </div>
                            <div>
                              <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Telefone *</label>
                              <Input value={formData.phone} onChange={e => handleChange("phone", e.target.value)}
                                className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 rounded-xl h-12 placeholder:text-zinc-600" placeholder="(11) 99999-9999" maxLength={15} />
                              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                            </div>
                          </div>

                          {/* Gender */}
                          <div>
                            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Gênero *</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[["masculino","Masculino"],["feminino","Feminino"],["outro","Outro"],["prefiro_nao_informar","Prefiro não informar"]].map(([v, l]) => (
                                <button key={v} type="button" onClick={() => handleChange("gender", v)}
                                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-all duration-150 leading-snug ${
                                    v === "prefiro_nao_informar" ? "col-span-2" : ""
                                  } ${
                                    formData.gender === v
                                      ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20"
                                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                                  }`}>
                                  {l}
                                </button>
                              ))}
                            </div>
                            {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
                          </div>

                          <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={handleNextStep}
                            className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-orange-500/20">
                            Próximo passo <ArrowRight className="w-4 h-4" />
                          </motion.button>
                        </motion.div>

                      ) : (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                          className="space-y-4">

                          {/* Email */}
                          <div>
                            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">E-mail *</label>
                            <Input type="email" value={formData.email} onChange={e => handleChange("email", e.target.value)}
                              className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 rounded-xl h-12 placeholder:text-zinc-600" placeholder="seu@email.com" />
                            {errors.email && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
                          </div>

                          {/* Password */}
                          <div>
                            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Senha *</label>
                            <div className="relative">
                              <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => handleChange("password", e.target.value)}
                                className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 rounded-xl h-12 pr-12 placeholder:text-zinc-600" placeholder="Mín. 8 chars, maiúscula e número" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {formData.password && (
                              <div className="mt-2 space-y-1">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map(i => (
                                    <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.05 }}
                                      className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i <= passwordStrength.score ? strengthColors[passwordStrength.score] : "bg-zinc-700"}`} />
                                  ))}
                                </div>
                                {passwordStrength.message && <p className={`text-xs ${strengthTextColors[passwordStrength.score]}`}>{passwordStrength.message}</p>}
                              </div>
                            )}
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                          </div>

                          {/* Terms */}
                          <div className="space-y-3 pt-1">
                            {[
                              { id: "terms", field: "accepted_terms", label: "Li e aceito o", linkLabel: "Contrato de Serviços", onClick: () => setTermsOpen(true), error: errors.accepted_terms },
                              { id: "rules", field: "accepted_rules", label: "Li e aceito o", linkLabel: "Regimento Interno", onClick: () => setRulesOpen(true), error: errors.accepted_rules },
                            ].map(({ id, field, label, linkLabel, onClick, error }) => (
                              <div key={id}>
                                <div className="flex items-start gap-3">
                                  <Checkbox id={id} checked={formData[field]} onCheckedChange={v => handleChange(field, v)}
                                    className="border-zinc-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 rounded mt-0.5" />
                                  <label htmlFor={id} className="text-zinc-400 text-sm cursor-pointer leading-snug">
                                    {label}{" "}
                                    <button type="button" onClick={onClick} className="text-orange-400 hover:text-orange-300 font-semibold transition-colors underline underline-offset-2">{linkLabel}</button>
                                  </label>
                                </div>
                                {error && <p className="text-red-400 text-xs pl-7 mt-1">{error}</p>}
                              </div>
                            ))}
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setStep(1)}
                              className="h-12 px-5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all font-semibold text-sm">
                              Voltar
                            </button>
                            <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={handleSubmit} disabled={loading}
                              className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
                              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Cadastrando...</> : <><CheckCircle className="w-4 h-4" />Criar Conta</>}
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">Contrato de Prestação de Serviços</DialogTitle></DialogHeader>
          <div className="text-zinc-300 text-sm space-y-4">
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
          <div className="text-zinc-300 text-sm space-y-4">
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