import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EmailVerificationBanner({ email }) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      const res = await base44.functions.invoke('verifyEmail', { token: code.trim() });
      if (res.data?.success) {
        toast.success("Email verificado com sucesso!");
        window.location.reload();
      } else {
        toast.error(res.data?.message || "Código inválido ou expirado.");
      }
    } catch {
      toast.error("Erro ao verificar código.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await base44.functions.invoke('sendVerificationEmail', {});
      if (res.data?.success) toast.success("Email reenviado!");
      else toast.error(res.data?.message || "Erro ao reenviar");
    } catch {
      toast.error("Erro ao reenviar email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-blue-400 font-medium text-sm">Verifique seu email — </span>
          <span className="text-gray-400 text-sm">Enviamos um link para <strong className="text-white">{email}</strong></span>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowInput(!showInput)}
            className="text-blue-400 hover:text-blue-300 text-xs underline"
          >
            Tenho um código
          </button>
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-blue-400 hover:text-blue-300 text-xs underline"
          >
            {resending ? "Enviando..." : "Reenviar"}
          </button>
        </div>
      </div>

      {showInput && (
        <div className="flex gap-2">
          <Input
            placeholder="Cole o código ou token recebido por email"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white text-sm h-9"
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
          <Button
            onClick={handleVerify}
            disabled={verifying || !code.trim()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 h-9 flex-shrink-0"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            <span className="ml-1">Verificar</span>
          </Button>
        </div>
      )}
    </div>
  );
}