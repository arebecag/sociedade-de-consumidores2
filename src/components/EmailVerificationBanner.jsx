import React, { useState } from "react";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EmailVerificationBanner({ email }) {
  const { verifyEmail, sendVerificationCode, reloadUser } = useAuthCustom();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    const normalizedCode = code.trim();
    if (!normalizedCode || normalizedCode.length !== 6) {
      toast.error("Digite um código válido");
      return;
    }
    setVerifying(true);
    try {
      await verifyEmail(email, normalizedCode);
      setVerified(true);
      toast.success("Parabéns, seu e-mail foi verificado!");
      setTimeout(() => {
        reloadUser();
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error(error.message || "Código inválido ou expirado.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendVerificationCode(email);
      toast.success("Código reenviado para o seu e-mail!");
    } catch (error) {
      toast.error(error.message || "Erro ao reenviar");
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <span className="text-green-400 font-semibold text-sm">
          Parabéns, seu e-mail foi verificado!
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-blue-400 font-medium text-sm">
            Verifique seu e-mail
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            Enviamos um código para{" "}
            <strong className="text-white">{email}</strong>. Digite o código de
            6 dígitos abaixo para verificar.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Digite o código (6 dígitos)"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="bg-zinc-900 border-zinc-700 text-white text-sm h-10 tracking-widest font-mono text-center uppercase"
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          maxLength={6}
        />
        <Button
          onClick={handleVerify}
          disabled={verifying || code.trim().length !== 6}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 h-10 flex-shrink-0 px-4"
        >
          {verifying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span className="ml-1">Verificar</span>
        </Button>
      </div>

      <button
        onClick={handleResend}
        disabled={resending}
        className="text-blue-400 hover:text-blue-300 text-xs underline"
      >
        {resending ? "Enviando..." : "Reenviar código"}
      </button>
    </div>
  );
}
