import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Loader2, Lock, AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Páginas sempre liberadas (sem verificação financeira)
const PAGINAS_LIBERADAS = [
  "MinhasCobranças",
  "MinhaAreaFinanceira",
  "AdminSaques",
  "LandingPage",
  "Register",
  "PartnerSite",
  "LojaCursos",
  "Profile",
  "MySite",
  "Dashboard",
  "FAQ"
];

export default function FinanceiroGuard({ children, currentPageName }) {
  const [status, setStatus] = useState("checking");
  const [cobranca, setCobranca] = useState(null);


  useEffect(() => {
    if (PAGINAS_LIBERADAS.includes(currentPageName)) {
      setStatus("liberado");
      return;
    }
    verificarAcesso();
  }, [currentPageName]);

  const verificarAcesso = async () => {
    try {
      const user = await base44.auth.me();
      // Sem usuário autenticado → libera (auth cuida do redirect)
      if (!user) { setStatus("liberado"); return; }

      const partners = await base44.entities.Partner.filter({ created_by: user.email });

      // ✅ Nova regra: Partner não existe ainda → acesso liberado (onboarding em andamento)
      if (!partners.length) { setStatus("liberado"); return; }

      const partner = partners[0];

      // Buscar cobranças do usuário, mais recente primeiro
      const cobranças = await base44.entities.Financeiro.filter({ userId: partner.id }, "-created_date", 5);

      // ✅ Nova regra: Sem nenhuma cobrança → acesso liberado (só não gera bônus)
      if (!cobranças.length) {
        setStatus("liberado");
        return;
      }

      // Verificar cobrança mais recente
      const maisRecente = cobranças[0];

      if (["CONFIRMED", "RECEIVED"].includes(maisRecente.status)) {
        setStatus("liberado");
      } else if (maisRecente.status === "OVERDUE") {
        setStatus("bloqueado_overdue");
        setCobranca(maisRecente);
      } else {
        // PENDING ou qualquer outro
        setStatus("bloqueado_pending");
        setCobranca(maisRecente);
      }
    } catch (e) {
      // ✅ Fail-safe: nunca quebrar a aplicação
      console.error("FinanceiroGuard error:", e);
      setStatus("liberado");
    }
  };



  if (status === "checking") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (status === "liberado") return <>{children}</>;

  // Telas de bloqueio (apenas quando há cobrança com status problemático)
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="bg-zinc-950 border-orange-500/20 max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          {status === "bloqueado_overdue" ? (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Acesso Suspenso</h2>
                <p className="text-gray-400 text-sm">
                  Seu boleto está <span className="text-red-400 font-semibold">vencido</span>. Regularize o pagamento para reativar o acesso.
                </p>
              </div>
              {cobranca?.invoiceUrl && (
                <a href={cobranca.invoiceUrl} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    <ExternalLink className="w-4 h-4 mr-2" /> Pagar agora
                  </Button>
                </a>
              )}
              {cobranca?.bankSlipUrl && (
                <a href={cobranca.bankSlipUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full border-zinc-700 text-gray-300 hover:text-white">
                    <FileText className="w-4 h-4 mr-2" /> Baixar boleto
                  </Button>
                </a>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Pagamento Pendente</h2>
                <p className="text-gray-400 text-sm">
                  Seu acesso será liberado assim que o pagamento for confirmado.
                </p>
              </div>
              {cobranca?.invoiceUrl && (
                <a href={cobranca.invoiceUrl} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    <ExternalLink className="w-4 h-4 mr-2" /> Pagar agora
                  </Button>
                </a>
              )}
              {cobranca?.bankSlipUrl && (
                <a href={cobranca.bankSlipUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full border-zinc-700 text-gray-300 hover:text-white mt-2">
                    <FileText className="w-4 h-4 mr-2" /> Baixar boleto PDF
                  </Button>
                </a>
              )}
              <p className="text-xs text-gray-600">Após o pagamento, aguarde alguns minutos e recarregue a página.</p>
            </>
          )}

          <a href={createPageUrl("MinhasCobranças")} className="block">
            <Button variant="ghost" className="w-full text-gray-500 hover:text-white text-sm">
              Ver Minhas Cobranças
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}