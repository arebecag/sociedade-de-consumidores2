import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function VerifyEmail() {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Link de verificação inválido ou incompleto.");
      return;
    }

    base44.functions.invoke("verifyEmail", { token })
      .then(res => {
        if (res.data?.success) {
          setStatus("success");
          setMessage(res.data.message || "Email verificado com sucesso!");
        } else {
          setStatus("error");
          setMessage(res.data?.error || "Erro ao verificar email.");
        }
      })
      .catch(err => {
        setStatus("error");
        setMessage(err?.response?.data?.error || "Erro ao verificar email.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-orange-500/20 rounded-2xl p-10 max-w-md w-full text-center">
        <div className="mb-6">
          <img
            src="https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=80&h=80&fit=crop&crop=center"
            alt="Logo"
            className="w-16 h-16 rounded-full mx-auto mb-4 object-cover hidden"
          />
          <h1 className="text-2xl font-bold text-orange-500 mb-1">Sociedade de Consumidores</h1>
          <p className="text-gray-400 text-sm">Verificação de email</p>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <p className="text-gray-300">Verificando seu email...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-bold text-white">Email verificado!</h2>
            <p className="text-gray-300">{message}</p>
            <Button
              onClick={() => window.location.href = createPageUrl("Dashboard")}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-8"
            >
              Acessar minha conta
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <XCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-xl font-bold text-white">Ops!</h2>
            <p className="text-gray-300">{message}</p>
            <Button
              onClick={() => window.location.href = createPageUrl("Dashboard")}
              variant="outline"
              className="mt-4 border-orange-500 text-orange-500 hover:bg-orange-500/10 px-8"
            >
              Ir para o Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}