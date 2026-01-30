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
  const [loading, setLoading] = useState(false);
  const [loadingReferrer, setLoadingReferrer] = useState(true);
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
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("ref");
    if (code) {
      setReferrerCode(code);
      loadReferrer(code);
    } else {
      setLoadingReferrer(false);
    }
  }, []);

  const loadReferrer = async (code) => {
    try {
      const partners = await base44.entities.Partner.filter({ unique_code: code });
      if (partners.length > 0) {
        setReferrerName(partners[0].display_name || partners[0].full_name);
      }
    } catch (error) {
      console.error("Error loading referrer:", error);
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
      return { valid: false, message: "Precisa ter letra maiúscula" };
    }
    if (!hasLowerCase) {
      return { valid: false, message: "Precisa ter letra minúscula" };
    }
    if (!hasNumber) {
      return { valid: false, message: "Precisa ter número" };
    }
    return { valid: true, message: "Senha forte" };
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

  const generateUniqueCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "Nome completo é obrigatório";
    }
    if (!formData.birth_date) {
      newErrors.birth_date = "Data de nascimento é obrigatória";
    } else if (!validateAge(formData.birth_date)) {
      newErrors.birth_date = "Você precisa ter pelo menos 15 anos";
    }
    if (!formData.gender) {
      newErrors.gender = "Gênero é obrigatório";
    }
    if (!formData.email) {
      newErrors.email = "E-mail é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "E-mail inválido";
    }
    if (!formData.phone || formData.phone.replace(/\D/g, "").length < 11) {
      newErrors.phone = "Telefone com DDD é obrigatório";
    }
    if (!passwordStrength.valid) {
      newErrors.password = passwordStrength.message;
    }
    if (!formData.accepted_terms) {
      newErrors.accepted_terms = "Você precisa aceitar o contrato";
    }
    if (!formData.accepted_rules) {
      newErrors.accepted_rules = "Você precisa aceitar o regimento";
    }
    if (!referrerCode) {
      newErrors.referrer = "Link de indicação inválido";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Get referrer partner
      const referrers = await base44.entities.Partner.filter({ unique_code: referrerCode });
      if (referrers.length === 0) {
        toast.error("Indicador não encontrado");
        setLoading(false);
        return;
      }

      const referrer = referrers[0];

      // Create partner record
      const partnerData = {
        full_name: formData.full_name,
        birth_date: formData.birth_date,
        gender: formData.gender,
        phone: formData.phone,
        referrer_id: referrer.id,
        referrer_name: referrer.display_name || referrer.full_name,
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
        unique_code: generateUniqueCode(),
        display_name: formData.full_name.split(" ")[0]
      };

      // Redirect to login for actual account creation
      base44.auth.redirectToLogin(createPageUrl("Dashboard"));
      
      // Store partner data to be created after login
      localStorage.setItem("pendingPartnerData", JSON.stringify(partnerData));
      
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao cadastrar. Tente novamente.");
    } finally {
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

  if (!referrerCode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-950 border-orange-500/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Link Inválido</h2>
            <p className="text-gray-400">
              Para se cadastrar, você precisa de um link de indicação válido.
              Entre em contato com um parceiro da Sociedade de Consumidores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">Sociedade de</h1>
          <h1 className="text-3xl font-bold text-white">Consumidores</h1>
          <p className="text-gray-400 mt-2">Cadastre-se e comece a gerar bônus</p>
        </div>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white">Formulário de Cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Referrer Info */}
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <Label className="text-gray-400 text-sm">Indicador</Label>
                <p className="text-white font-semibold text-lg">{referrerName}</p>
              </div>

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
                <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
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
                  <div className="flex-1">
                    <Label htmlFor="terms" className="text-gray-300 text-sm cursor-pointer">
                      Li e aceito o{" "}
                      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
                        <DialogTrigger className="text-orange-500 hover:underline">
                          Contrato de Prestação de Serviços
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-orange-500/20 max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-white">Contrato de Prestação de Serviços</DialogTitle>
                          </DialogHeader>
                          <div className="text-gray-300 text-sm space-y-4">
                            <p>Este contrato estabelece os termos e condições para participação na Sociedade de Consumidores.</p>
                            <p>1. O PARCEIRO concorda em divulgar os produtos e serviços da plataforma de forma ética e transparente.</p>
                            <p>2. Os bônus serão gerados conforme as compras realizadas pelos clientes indicados.</p>
                            <p>3. O PARCEIRO se compromete a manter seus dados cadastrais atualizados.</p>
                            <p>4. A empresa reserva-se o direito de suspender ou cancelar contas que violem os termos.</p>
                            <p>5. Os bônus são divididos em 50% para saque e 50% para compras na plataforma.</p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </Label>
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
                  <div className="flex-1">
                    <Label htmlFor="rules" className="text-gray-300 text-sm cursor-pointer">
                      Li e aceito o{" "}
                      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
                        <DialogTrigger className="text-orange-500 hover:underline">
                          Regimento Interno
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-orange-500/20 max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-white">Regimento Interno</DialogTitle>
                          </DialogHeader>
                          <div className="text-gray-300 text-sm space-y-4">
                            <p><strong>Regras de Participação:</strong></p>
                            <p>1. É necessário realizar a primeira compra de R$ 125,00 para ativar sua conta.</p>
                            <p>2. O parceiro deve utilizar pelo menos 90% do saldo de bônus para compras até o dia 10 de cada mês.</p>
                            <p>3. Cada parceiro pode indicar até 3 clientes diretos.</p>
                            <p>4. Os bônus são distribuídos: 15% das indicações diretas e 30% das indiretas.</p>
                            <p>5. O sistema funciona em grupos de 12 pessoas (3 diretos + 9 indiretos).</p>
                            <p>6. A graduação evolui conforme a formação de grupos ativos.</p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </Label>
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