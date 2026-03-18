import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { ExternalLink, FileText, CheckCircle2, Clock, AlertTriangle, RefreshCw, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fmtR = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const STATUS = {
  PENDING:   { label: "Pendente",   cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", Icon: Clock },
  CONFIRMED: { label: "Confirmado", cls: "bg-green-500/10 text-green-400 border-green-500/20",   Icon: CheckCircle2 },
  RECEIVED:  { label: "Recebido",   cls: "bg-green-500/10 text-green-400 border-green-500/20",   Icon: CheckCircle2 },
  OVERDUE:   { label: "Vencido",    cls: "bg-red-500/10 text-red-400 border-red-500/20",          Icon: AlertTriangle },
  CANCELLED: { label: "Cancelado",  cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",      Icon: AlertTriangle },
  REFUNDED:  { label: "Estornado",  cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",      Icon: AlertTriangle },
};

export default function MinhasCobranças() {
  const { partner: authPartner } = useAuthCustom();
  const [cobranças, setCobranças] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    if (authPartner) { setPartner(authPartner); loadCobranças(authPartner.id); }
  }, [authPartner]);

  const loadCobranças = async (partnerId) => {
    setLoading(true);
    try {
      const data = await base44.entities.Financeiro.filter({ userId: partnerId }, "-created_date", 20);
      setCobranças(data);
    } catch { }
    finally { setLoading(false); }
  };

  const loadData = () => { if (authPartner) loadCobranças(authPartner.id); };

  const gerarBoleto = async () => {
    if (!partner) return;
    setGerandoBoleto(true);
    try {
      const vencimento = new Date(); vencimento.setDate(vencimento.getDate() + 3);
      const res = await base44.functions.invoke("gerarBoletoParaUsuario", {
        userId: partner.id, valor: 97.00,
        descricao: "Ativação de Plano - Sociedade de Consumidores",
        dataVencimento: vencimento.toISOString().split("T")[0]
      });
      if (res.data?.success) { toast.success(res.data.reutilizado ? "Usando cobrança existente!" : "Boleto gerado!"); loadData(); }
      else toast.error(res.data?.error || "Erro ao gerar boleto");
    } catch { toast.error("Erro ao gerar boleto"); }
    finally { setGerandoBoleto(false); }
  };

  if (loading) return <LoadingSpinner />;

  const temPendente = cobranças.some(c => c.status === "PENDING");

  return (
    <AnimatedPage>
      <PageHeader
        title="Minhas Cobranças"
        subtitle="Gerencie seus boletos e pagamentos"
        action={
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white rounded-xl gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
            {!temPendente && partner?.cpf && (
              <Button onClick={gerarBoleto} disabled={gerandoBoleto} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
                {gerandoBoleto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Gerar Boleto
              </Button>
            )}
          </div>
        }
      />

      {!partner?.cpf && (
        <AnimatedItem>
          <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-zinc-300 text-sm">Para gerar boletos, cadastre seu CPF no perfil primeiro.</p>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        {cobranças.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] p-4">
            <EmptyState icon={FileText} message="Nenhuma cobrança encontrada." />
            {partner?.cpf && !temPendente && (
              <div className="flex justify-center mt-4">
                <Button onClick={gerarBoleto} disabled={gerandoBoleto} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
                  {gerandoBoleto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Gerar meu primeiro boleto
                </Button>
              </div>
            )}
          </div>
        ) : (
          <motion.div variants={{ show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="space-y-3">
            {cobranças.map(c => {
              const st = STATUS[c.status] || STATUS.PENDING;
              return (
                <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}`}>
                          <st.Icon className="w-3 h-3" />{st.label}
                        </span>
                        {c.bonusLiberado && <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">🎉 Bônus Liberado</span>}
                      </div>
                      <p className="text-white text-3xl font-black">{fmtR(c.valor)}</p>
                      <p className="text-zinc-500 text-sm">{c.descricao}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
                        <span>Vencimento: <span className="text-zinc-300">{fmtDate(c.dataVencimento)}</span></span>
                        {c.dataPagamento && <span>Pago: <span className="text-green-400">{fmtDate(c.dataPagamento)}</span></span>}
                        {c.valorBonus && <span>Bônus: <span className="text-orange-400">{fmtR(c.valorBonus)}</span></span>}
                      </div>
                    </div>
                    {c.status === "PENDING" && (
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        {c.invoiceUrl && (
                          <a href={c.invoiceUrl} target="_blank" rel="noreferrer">
                            <Button className="w-full bg-orange-500 hover:bg-orange-600 rounded-xl gap-2 text-sm">
                              <ExternalLink className="w-4 h-4" /> Pagar agora
                            </Button>
                          </a>
                        )}
                        {c.bankSlipUrl && (
                          <a href={c.bankSlipUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:text-white rounded-xl gap-2 text-sm">
                              <FileText className="w-4 h-4" /> Baixar boleto
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatedItem>
    </AnimatedPage>
  );
}