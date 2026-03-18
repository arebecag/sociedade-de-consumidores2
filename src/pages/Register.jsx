import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuthCustom } from "@/components/AuthContextCustom";
import LoginForm from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, UserPlus, LogIn, Shield, Users, Zap, TrendingUp, Star, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

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
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
          </div>
          <p className="text-gray-500 text-sm">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  if (invalidReferrer) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Link Inválido</h2>
          <p className="text-gray-400 text-sm">O código de indicação não foi encontrado. Verifique o link e tente novamente.</p>
        </motion.div>
      </div>
    );
  }

  const features = [
    { icon: Zap, title: "Bônus Semanais", desc: "Receba toda segunda-feira automaticamente", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { icon: Users, title: "Rede 3x3", desc: "Sistema inteligente de indicações em rede", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { icon: TrendingUp, title: "Até 40% de Bônus", desc: "Sobre as compras da sua equipe", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { icon: Shield, title: "Garantia Total", desc: "Devolução sem perguntas", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col lg:flex-row overflow-hidden">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-orange-600/8 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-orange-500/3 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-14">
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-orange-500 flex-shrink-0 leading-none shadow-lg shadow-orange-500/30">
              <span className="text-white font-black text-[11px]">SC</span>
              <span className="text-white font-black text-[11px]">3X3</span>
            </div>
            <div>
              <p className="text-white font-black text-lg leading-none">Sociedade de</p>
              <p className="text-orange-500 font-black text-lg leading-none">Consumidores</p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <h1 className="text-5xl font-black text-white leading-[1.1] mb-5">
              Seu dinheiro<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">trabalhando</span><br/>
              por você.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-sm">
              Junte-se à rede e receba bônus pelas compras da sua equipe toda semana.
            </p>
          </motion.div>
        </div>

        {/* Feature cards */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="relative z-10 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, desc, color, bg }) => (
            <motion.div key={title} variants={fadeUp}
              className={`p-4 rounded-2xl border backdrop-blur-sm ${bg} hover:scale-[1.02] transition-transform duration-200 cursor-default`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-white font-semibold text-sm leading-tight">{title}</p>
              <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 py-10 overflow-y-auto relative">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 lg:bg-zinc-950" />

        <div className="relative z-10 w-full max-w-md mx-auto">

          {/* Mobile logo */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-orange-500 flex-shrink-0 leading-none shadow-lg shadow-orange-500/30">
              <span className="text-white font-black text-[9px]">SC</span>
              <span className="text-white font-black text-[9px]">3X3</span>
            </div>
            <div>
              <p className="text-white font-black text-base leading-none">Sociedade de</p>
              <p className="text-orange-500 font-black text-base leading-none">Consumidores</p>
            </div>
          </motion.div>

          {/* Tab switcher */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="relative flex bg-zinc-900/80 border border-zinc-800 rounded-2xl p-1.5 mb-8 backdrop-blur-sm">
            {/* Sliding indicator */}
            <motion.div
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-3px)] bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20"
              animate={{ x: activeTab === "login" ? 0 : "calc(100% + 6px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
            <button onClick={() => setActiveTab("login")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "login" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              <LogIn className="w-4 h-4" /> Entrar
            </button>
            <button onClick={() => setActiveTab("register")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "register" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              <UserPlus className="w-4 h-4" /> Cadastrar
            </button>
          </motion.div>

          {/* Content area */}
          <AnimatePresence mode="wait">
            {activeTab === "login" ? (
              <motion.div key="login"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}>
                <div className="mb-7">
                  <h2 className="text-2xl font-black text-white mb-1">Bem-vindo de volta 👋</h2>
                  <p className="text-zinc-400 text-sm">Acesse seu Escritório Virtual</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm">
                  <LoginForm onLoginSuccess={() => navigate(createPageUrl("Dashboard"))} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="register"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}>
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-white mb-1">Criar sua conta</h2>
                  <p className="text-zinc-400 text-sm">Preencha os dados abaixo para começar</p>
                </div>

                {/* Referrer badge */}
                {referrerName && referrerName !== "Sem indicador" && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="mb-5 p-3.5 bg-orange-500/8 border border-orange-500/20 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/20">
                      <span className="text-white text-sm font-black">{referrerName[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-orange-400/80 text-xs">Indicado por</p>
                      <p className="text-white font-bold text-sm truncate">{referrerName}</p>
                    </div>
                    <Star className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  </motion.div>
                )}

                <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm">
                  <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Full name */}
                    <div>
                      <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Nome Completo *</Label>
                      <Input value={formData.full_name} onChange={e => handleChange("full_name", e.target.value)}
                        className="bg-zinc-800/80 border-zinc-700 text-white focus:border-orange-500 focus:ring-orange-500/20 h-11 rounded-xl placeholder:text-zinc-600" placeholder="Seu nome completo" />
                      {errors.full_name && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.full_name}</p>}
                    </div>

                    {/* Birth + Phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Nascimento *</Label>
                        <Input type="date" value={formData.birth_date} onChange={e => handleChange("birth_date", e.target.value)}
                          className="bg-zinc-800/80 border-zinc-700 text-white focus:border-orange-500 h-11 rounded-xl" />
                        {errors.birth_date && <p className="text-red-400 text-xs mt-1">{errors.birth_date}</p>}
                      </div>
                      <div>
                        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Telefone *</Label>
                        <Input value={formData.phone} onChange={e => handleChange("phone", e.target.value)}
                          className="bg-zinc-800/80 border-zinc-700 text-white focus:border-orange-500 h-11 rounded-xl placeholder:text-zinc-600" placeholder="(11) 99999-9999" maxLength={15} />
                        {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Gênero *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[["masculino","Masculino"],["feminino","Feminino"],["outro","Outro"],["prefiro_nao_informar","Prefiro não informar"]].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => handleChange("gender", v)}
                            className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
                              formData.gender === v
                                ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20"
                                : "bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                            }`}>
                            {l}
                          </button>
                        ))}
                      </div>
                      {errors.gender && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.gender}</p>}
                    </div>

                    {/* Email */}
                    <div>
                      <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">E-mail *</Label>
                      <Input type="email" value={formData.email} onChange={e => handleChange("email", e.target.value)}
                        className="bg-zinc-800/80 border-zinc-700 text-white focus:border-orange-500 h-11 rounded-xl placeholder:text-zinc-600" placeholder="seu@email.com" />
                      {errors.email && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
                    </div>

                    {/* Password */}
                    <div>
                      <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Senha *</Label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => handleChange("password", e.target.value)}
                          className="bg-zinc-800/80 border-zinc-700 text-white focus:border-orange-500 h-11 rounded-xl pr-10 placeholder:text-zinc-600" placeholder="Mín. 8 chars, maiúscula e número" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formData.password && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-zinc-700 overflow-hidden">
                            <motion.div animate={{ width: passwordStrength.valid ? "100%" : "40%" }}
                              className={`h-full rounded-full ${passwordStrength.valid ? "bg-green-500" : "bg-yellow-500"}`}
                              transition={{ duration: 0.3 }} />
                          </div>
                          <p className={`text-xs whitespace-nowrap ${passwordStrength.valid ? "text-green-500" : "text-yellow-500"}`}>
                            {passwordStrength.message}
                          </p>
                        </div>
                      )}
                      {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                    </div>

                    {/* Terms */}
                    <div className="space-y-2.5 pt-1">
                      {[
                        { id: "terms", field: "accepted_terms", label: "Li e aceito o", linkLabel: "Contrato de Serviços", onClick: () => setTermsOpen(true), error: errors.accepted_terms },
                        { id: "rules", field: "accepted_rules", label: "Li e aceito o", linkLabel: "Regimento Interno", onClick: () => setRulesOpen(true), error: errors.accepted_rules },
                      ].map(({ id, field, label, linkLabel, onClick, error }) => (
                        <div key={id}>
                          <div className="flex items-start gap-2.5">
                            <Checkbox id={id} checked={formData[field]} onCheckedChange={v => handleChange(field, v)}
                              className="border-zinc-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 mt-0.5 rounded" />
                            <label htmlFor={id} className="text-zinc-400 text-sm cursor-pointer">
                              {label}{" "}
                              <button type="button" onClick={onClick} className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-2 transition-colors">
                                {linkLabel}
                              </button>
                            </label>
                          </div>
                          {error && <p className="text-red-400 text-xs pl-7 mt-1">{error}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Submit */}
                    <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
                      <Button type="submit" disabled={loading}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold h-12 text-base rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-200 group">
                        {loading ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Cadastrando...</>
                        ) : (
                          <><CheckCircle className="w-4 h-4 mr-2" />Criar Conta <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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