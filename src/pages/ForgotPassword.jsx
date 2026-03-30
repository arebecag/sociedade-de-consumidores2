import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  Mail,
  ArrowLeft,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { requestPasswordReset, resetPassword } = useAuthCustom();
  const [step, setStep] = useState("email"); // "email" | "token" | "success"
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error("Digite seu e-mail");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email.toLowerCase().trim());
      toast.success(
        "Se o e-mail estiver cadastrado, o código será enviado em instantes.",
      );
      setStep("token");
    } catch (error) {
      toast.error(error.message || "Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!token || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(
        email.toLowerCase().trim(),
        token.trim().toLowerCase(),
        newPassword,
      );
      toast.success("Senha redefinida com sucesso!");
      setStep("success");
    } catch (error) {
      toast.error(error.message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-950 border-orange-500/20">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-4">
            <h1 className="text-3xl font-bold text-orange-500">Sociedade de</h1>
            <h1 className="text-3xl font-bold text-white">Consumidores</h1>
          </div>
          <CardTitle className="text-2xl text-white">
            {step === "email" && "Recuperar Senha"}
            {step === "token" && "Redefinir Senha"}
            {step === "success" && "Sucesso!"}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {step === "email" &&
              "Digite seu e-mail para receber o código de acesso"}
            {step === "token" &&
              "Digite o código recebido por e-mail e defina sua nova senha"}
            {step === "success" && "Sua senha foi redefinida"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  E-mail cadastrado
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    className="bg-zinc-900 border-zinc-700 text-white pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar código"
                )}
              </Button>

              <Link
                to={createPageUrl("LoginCustom")}
                className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-orange-500 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Ir para o login
              </Link>
            </form>
          )}

          {step === "token" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-sm text-orange-100">
                Caso o e-mail demore, verifique também a caixa de spam e
                promoções.
              </div>

              <div className="space-y-2">
                <Label htmlFor="token" className="text-white">
                  Código de verificação
                </Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Digite o código"
                  value={token}
                  onChange={(e) =>
                    setToken(
                      e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .slice(0, 8)
                        .toLowerCase(),
                    )
                  }
                  className="bg-zinc-900 border-zinc-700 text-white text-center text-xl tracking-widest font-mono uppercase"
                  maxLength={8}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white pl-10 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-400"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white"
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir Senha"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setToken("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setStep("email");
                }}
                className="flex items-center justify-center gap-2 w-full text-sm text-gray-400 hover:text-orange-500 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>

              <p className="text-center text-gray-400">
                Sua senha foi redefinida com sucesso. Você já pode fazer login
                com a nova senha.
              </p>

              <Link to={createPageUrl("LoginCustom")}>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                  Ir para o login
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
