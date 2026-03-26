import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Zap,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export default function RegisterCustom() {
  const navigate = useNavigate();
  const { register: authRegister, isAuthenticated } = useAuthCustom();
  const [referrerName, setReferrerName] = useState("");
  const [referrerPartnerId, setReferrerPartnerId] = useState(null);
  const [loadingReferrer, setLoadingReferrer] = useState(true);
  const [invalidReferrer, setInvalidReferrer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    valid: false,
    message: "",
  });
  const [cadastroSucesso, setCadastroSucesso] = useState(false);
  const [nomeRegistrado, setNomeRegistrado] = useState("");

  const DEFAULT_REFERRER_CODE = "WKK321P5";

  useEffect(() => {
    if (isAuthenticated()) navigate(createPageUrl("Dashboard"));
    checkReferrer();
  }, [isAuthenticated, navigate]);

  const checkReferrer = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("ref");
      loadReferrer(code || DEFAULT_REFERRER_CODE);
    } catch {
      setLoadingReferrer(false);
    }
  };

  const loadReferrer = async (code) => {
    try {
      const partners = await base44.entities.Partner.filter({
        unique_code: code.trim().toUpperCase(),
      });
      if (partners.length > 0) {
        setReferrerName(partners[0].display_name || partners[0].full_name);
        setReferrerPartnerId(partners[0].id);
        setInvalidReferrer(false);
      } else {
        setInvalidReferrer(true);
      }
    } catch {
      setInvalidReferrer(true);
    } finally {
      setLoadingReferrer(false);
    }
  };

  const validatePassword = (password) => {
    if (password.length < 8)
      return { valid: false, message: "Mínimo 8 caracteres" };
    if (!/[A-Z]/.test(password))
      return { valid: false, message: "Precisa ter letra maiúscula" };
    if (!/[a-z]/.test(password))
      return { valid: false, message: "Precisa ter letra minúscula" };
    if (!/[0-9]/.test(password))
      return { valid: false, message: "Precisa ter um número" };
    return { valid: true, message: "Senha válida ✓" };
  };

  const handleChange = (field, value) => {
    if (field === "password") setPasswordStrength(validatePassword(value));
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.full_name.trim())
      newErrors.full_name = "Nome completo é obrigatório";
    if (!formData.email) newErrors.email = "E-mail é obrigatório";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "E-mail inválido";
    if (!passwordStrength.valid)
      newErrors.password = passwordStrength.message || "Senha inválida";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "As senhas não coincidem";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Corrija os campos destacados");
      return;
    }

    setLoading(true);
    try {
      await authRegister(
        formData.full_name,
        formData.email,
        formData.password,
        referrerPartnerId,
        referrerName,
      );
      setNomeRegistrado(formData.full_name.split(" ")[0]);
      setCadastroSucesso(true);
    } catch (error) {
      const msg = error.message || "";
      if (
        msg.toLowerCase().includes("já cadastrado") ||
        msg.toLowerCase().includes("already")
      ) {
        toast.error("Este e-mail já está cadastrado");
        setErrors((p) => ({ ...p, email: "E-mail já cadastrado" }));
      } else {
        toast.error(msg || "Erro ao cadastrar");
      }
    } finally {
      setLoading(false);
    }
  };

  if (cadastroSucesso) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-1">
              Cadastro realizado!
            </h1>
            <p className="text-orange-400 font-semibold text-lg">
              Bem-vindo(a), {nomeRegistrado}! 🎉
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6 space-y-4">
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
              Próximos passos
            </p>
            {[
              ["1", "Verifique seu e-mail para confirmar sua conta"],
              ["2", "Faça login com seu e-mail e senha criados"],
              [
                "3",
                "Complete seu perfil e realize sua primeira compra para ser ativado",
              ],
            ].map(([n, t]) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {n}
                </span>
                <p className="text-gray-300 text-sm leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
          <Button
            onClick={() => navigate(createPageUrl("LoginCustom"))}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base"
          >
            Ir para o Login →
          </Button>
          <p className="text-gray-600 text-xs text-center mt-4">
            ⚠️ Não tente se cadastrar novamente — sua conta já foi criada!
          </p>
        </div>
      </div>
    );
  }

  if (loadingReferrer) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
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
          <p className="text-gray-400 text-sm">
            O código de indicação não foi encontrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex-col justify-between p-12 border-r border-zinc-800">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-black text-white text-lg">
              3
            </div>
            <div>
              <p className="text-white font-black text-lg leading-none">
                Sociedade de
              </p>
              <p className="text-orange-500 font-black text-lg leading-none">
                Consumidores
              </p>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Comece a<br />
            <span className="text-orange-500">receber bônus</span>
            <br />
            hoje mesmo.
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Crie sua conta em menos de 2 minutos e comece a acompanhar seus
            clientes.
          </p>
        </div>
        <div className="space-y-4">
          {[
            {
              icon: Zap,
              title: "Rápido e Gratuito",
              desc: "Cadastro em minutos",
            },
            {
              icon: Users,
              title: "Clientes conectados",
              desc: "Crescimento inteligente",
            },
            {
              icon: Shield,
              title: "100% Seguro",
              desc: "Seus dados protegidos",
            },
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

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-black text-white">
              3
            </div>
            <p className="text-white font-black text-lg">
              Sociedade de <span className="text-orange-500">Consumidores</span>
            </p>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Criar conta</h2>
          <p className="text-gray-400 text-sm mb-6">
            Já tem uma conta?{" "}
            <button
              type="button"
              onClick={() => navigate(createPageUrl("LoginCustom"))}
              className="text-orange-400 hover:text-orange-300 font-medium"
            >
              Faça login →
            </button>
          </p>

          {referrerPartnerId && (
            <div className="mb-5 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {referrerName[0]}
                </span>
              </div>
              <div>
                <p className="text-orange-400 text-xs">Indicado por</p>
                <p className="text-white font-semibold text-sm">
                  {referrerName}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-300 text-sm mb-1.5 block">
                Nome Completo *
              </Label>
              <Input
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11"
                placeholder="Seu nome completo"
                disabled={loading}
              />
              {errors.full_name && (
                <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>
              )}
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-1.5 block">
                E-mail *
              </Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11"
                placeholder="seu@email.com"
                disabled={loading}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-1.5 block">
                Senha *
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11 pr-10"
                  placeholder="Mín. 8 chars, maiúscula e número"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {formData.password && (
                <p
                  className={`text-xs mt-1 ${passwordStrength.valid ? "text-green-500" : "text-yellow-500"}`}
                >
                  {passwordStrength.message}
                </p>
              )}
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-1.5 block">
                Repetir Senha *
              </Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleChange("confirmPassword", e.target.value)
                  }
                  className="bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 h-11 pr-10"
                  placeholder="Digite a senha novamente"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {formData.confirmPassword &&
                formData.password === formData.confirmPassword && (
                  <p className="text-green-500 text-xs mt-1">
                    ✓ Senhas coincidem
                  </p>
                )}
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Criar Conta
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
