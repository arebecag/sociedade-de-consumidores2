import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { ExternalLink, FileText, CheckCircle2, Clock, AlertTriangle, RefreshCw, TrendingUp, DollarSign, Calendar, Gift, ArrowDownCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthCustom } from "@/components/AuthContextCustom";

const fmtR = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDT = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const STATUS = {
  PENDING:   { label: "Pendente",   cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", Icon: Clock },
  CONFIRMED: { label: "Confirmado", cls: "bg-green-500/10 text-green-400 border-green-500/20",   Icon: CheckCircle2 },
  RECEIVED:  { label: "Recebido",   cls: "bg-green-500/10 text-green-400 border-green-500/20",   Icon: CheckCircle2 },
  OVERDUE:   { label: "Vencido",    cls: "bg-red-500/10 text-red-400 border-red-500/20",          Icon: AlertTriangle },
  CANCELLED: { label: "Cancelado",  cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",      Icon: AlertTriangle },
  REFUNDED:  { label: "Estornado",  cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",      Icon: AlertTriangle },
};
const STATUS_SAQUE = {
  PENDENTE: { label: "Pendente", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  PAGO:     { label: "Pago",     cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  RECUSADO: { label: "Recusado", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function MinhaAreaFinanceira() {
  const [cobranças, setCobranças] = useState([]);
  const [saques, setSaques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [solicitandoSaque, setSolicitandoSaque] = useState(false);
  const [valorSaque, setValorSaque] = useState("");
  const [pixKeySaque, setPixKeySaque] = useState("");
  const [aba, setAba] = useState("plano");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        setPartner(partners[0]); setPixKeySaque(partners[0].pix_key || "");
        const [fins, sqs] = await Promise.all([
          base44.entities.Financeiro.filter({ userId: partners[0].id }, "-created_date", 50),
          base44.entities.Saques.filter({ userId: partners[0].id }, "-created_date", 20)
        ]);
        setCobranças(fins); setSaques(sqs);
      }
    } catch { }
    finally { setLoading(false); }
  };

  const gerarBoleto = async () => {
    if (!partner) return; setGerandoBoleto(true);
    try {
      const v = new Date(); v.setDate(v.getDate() + 3);
      const res = await base44.functions.invoke("gerarBoletoParaUsuario", {
        userId: partner.id, valor: 97.00,
        descricao: "Ativação de Plano - Sociedade de Consumidores",
        dataVencimento: v.toISOString().split("T")[0]
      });
      if (res.data?.success) { toast.success(res.data.reutilizado ? "Usando cobrança existente!" : "Boleto gerado!"); loadData(); }
      else toast.error(res.data?.error || "Erro ao gerar boleto");
    } catch { toast.error("Erro ao gerar boleto"); }
    finally { setGerandoBoleto(false); }
  };

  const solicitarSaque = async () => {
    if (!partner) return;
    const saldo = partner.bonus_for_withdrawal || 0;
    const valor = parseFloat(valorSaque);
    const pixKey = pixKeySaque.trim();
    if (!pixKey) { toast.error("Informe a chave PIX."); return; }
    if (!valor || valor <= 0) { toast.error("Informe um valor válido."); return; }
    if (valor > saldo) { toast.error(`Valor excede o saldo (${fmtR(saldo)})`); return; }
    if (!cobranças.some(c => ["CONFIRMED","RECEIVED"].includes(c.status))) { toast.error("Necessário ter um pagamento confirmado."); return; }
    if (saques.some(s => s.status === "PENDENTE")) { toast.error("Você já tem um saque pendente."); return; }
    setSolicitandoSaque(true);
    try {
      await base44.entities.Saques.create({ userId: partner.id, userEmail: partner.created_by, userName: partner.full_name, valor, status: "PENDENTE", dataSolicitacao: new Date().toISOString(), pixKey });
      await base44.entities.LogsFinanceiro.create({ tipo: "SAQUE", userId: partner.id, userEmail: partner.created_by, userName: partner.full_name, valor, descricao: `Saque solicitado. PIX: ${pixKey}`, referenciaId: partner.id });
      toast.success("Saque solicitado! Admin irá processar em breve.");
      setValorSaque(""); loadData();
    } catch { toast.error("Erro ao solicitar saque"); }
    finally { setSolicitandoSaque(false); }
  };

  if (loading) return <LoadingSpinner />;

  const cobrancaAtiva = cobranças.find(c => ["PENDING","CONFIRMED","RECEIVED"].includes(c.status));
  const proximaCobranca = cobranças.find(c => c.status === "PENDING");
  const totalPago = cobranças.filter(c => ["CONFIRMED","RECEIVED"].includes(c.status)).reduce((s, c) => s + (c.valor || 0), 0);
  const totalBonus = cobranças.filter(c => c.bonusLiberado).reduce((s, c) => s + (c.valorBonus || 0), 0);
  const temPendente = cobranças.some(c => c.status === "PENDING");
  const saldoSaque = partner?.bonus_for_withdrawal || 0;
  const temSaquePendente = saques.some(s => s.status === "PENDENTE");

  const tabs = [{ id: "plano", label: "Plano Atual" }, { id: "historico", label: "Histórico" }, { id: "saques", label: "Saques" }];
  const summaryCards = [
    { label: "Total Pago", value: fmtR(totalPago), icon: DollarSign, color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Bônus Recebido", value: fmtR(totalBonus), icon: Gift, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Saldo p/ Saque", value: fmtR(saldoSaque), icon: ArrowDownCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Próx. Vencimento", value: proximaCobranca ? fmtDate(proximaCobranca.dataVencimento) : "—", icon: Calendar, color: "text-blue-400", bg: "bg-blue-500/10" },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Minha Área Financeira"
        subtitle="Gerencie seu plano, pagamentos e bônus"
        action={<Button onClick={loadData} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white rounded-xl gap-2"><RefreshCw className="w-4 h-4" />Atualizar</Button>}
      />

      <AnimatedItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-zinc-500 text-xs mb-1">{label}</p>
              <p className={`text-base font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <div className="flex gap-1 bg-zinc-900 border border-white/[0.05] rounded-2xl p-1 w-fit mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setAba(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${aba === t.id ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={aba} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {aba === "plano" && (
              <div className="space-y-4">
                {!partner?.cpf && (
                  <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <p className="text-zinc-300 text-sm">Para gerar boletos, cadastre seu CPF no perfil primeiro.</p>
                  </div>
                )}
                {cobrancaAtiva ? (
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-orange-400" />
                      <h2 className="text-white font-bold">Status do Plano</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(() => { const st = STATUS[cobrancaAtiva.status]; return st ? <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}`}><st.Icon className="w-3 h-3" />{st.label}</span> : null; })()}
                      {cobrancaAtiva.bonusLiberado && <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">🎉 Bônus Liberado</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { l: "Valor", v: fmtR(cobrancaAtiva.valor), c: "text-white" },
                        { l: "Vencimento", v: fmtDate(cobrancaAtiva.dataVencimento), c: "text-zinc-200" },
                        cobrancaAtiva.dataPagamento && { l: "Pago em", v: fmtDate(cobrancaAtiva.dataPagamento), c: "text-green-400" },
                        cobrancaAtiva.valorBonus > 0 && { l: "Bônus Gerado", v: fmtR(cobrancaAtiva.valorBonus), c: "text-orange-400" },
                      ].filter(Boolean).map(({ l, v, c }) => (
                        <div key={l} className="p-3 rounded-xl bg-zinc-800/60">
                          <p className="text-zinc-500 text-xs">{l}</p>
                          <p className={`font-bold ${c}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                    {cobrancaAtiva.status === "PENDING" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        {cobrancaAtiva.invoiceUrl && <a href={cobrancaAtiva.invoiceUrl} target="_blank" rel="noreferrer"><Button className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2"><ExternalLink className="w-4 h-4" />Pagar agora</Button></a>}
                        {cobrancaAtiva.bankSlipUrl && <a href={cobrancaAtiva.bankSlipUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="border-zinc-700 text-zinc-300 rounded-xl gap-2"><FileText className="w-4 h-4" />Baixar boleto</Button></a>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] p-4">
                    <EmptyState icon={FileText} message="Nenhum plano ativo." sub="Gere um boleto para ativar seu acesso." />
                    {partner?.cpf && !temPendente && (
                      <div className="flex justify-center mt-4">
                        <Button onClick={gerarBoleto} disabled={gerandoBoleto} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
                          {gerandoBoleto && <Loader2 className="w-4 h-4 animate-spin" />} Gerar Boleto
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {aba === "historico" && (
              <div className="space-y-3">
                {cobranças.length === 0 ? <EmptyState icon={FileText} message="Nenhum histórico encontrado." /> : cobranças.map(c => {
                  const st = STATUS[c.status] || STATUS.PENDING;
                  return (
                    <div key={c.id} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-2">
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}`}><st.Icon className="w-3 h-3" />{st.label}</span>
                          {c.bonusLiberado && <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">🎉 Bônus</span>}
                        </div>
                        <p className="text-white font-bold text-lg">{fmtR(c.valor)}</p>
                        <p className="text-zinc-500 text-xs">{c.descricao}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
                          <span>Venc: <span className="text-zinc-400">{fmtDate(c.dataVencimento)}</span></span>
                          {c.dataPagamento && <span>Pago: <span className="text-green-400">{fmtDate(c.dataPagamento)}</span></span>}
                          {c.valorBonus > 0 && <span>Bônus: <span className="text-orange-400">{fmtR(c.valorBonus)}</span></span>}
                        </div>
                      </div>
                      {c.status === "PENDING" && (
                        <div className="flex gap-2 shrink-0">
                          {c.invoiceUrl && <a href={c.invoiceUrl} target="_blank" rel="noreferrer"><Button size="sm" className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-1 text-xs"><ExternalLink className="w-3 h-3" />Pagar</Button></a>}
                          {c.bankSlipUrl && <a href={c.bankSlipUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400 rounded-xl gap-1 text-xs"><FileText className="w-3 h-3" />PDF</Button></a>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {aba === "saques" && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-5 h-5 text-green-400" />
                    <h2 className="text-white font-bold">Solicitar Saque</h2>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs mb-1">Saldo disponível</p>
                    <p className="text-3xl font-black text-white">{fmtR(saldoSaque)}</p>
                  </div>
                  {temSaquePendente ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                      <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <p className="text-zinc-300 text-sm">Você já tem um saque pendente aguardando processamento.</p>
                    </div>
                  ) : saldoSaque > 0 ? (
                    <div className="space-y-3 pt-3 border-t border-white/[0.05]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Valor a sacar (R$)</label>
                          <Input type="number" value={valorSaque} onChange={e => setValorSaque(e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-white rounded-xl" placeholder={`Máx: ${fmtR(saldoSaque)}`} max={saldoSaque} min={0.01} />
                        </div>
                        <div>
                          <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Chave PIX</label>
                          <Input value={pixKeySaque} onChange={e => setPixKeySaque(e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-white rounded-xl" placeholder="CPF, email, telefone..." />
                        </div>
                      </div>
                      <Button onClick={solicitarSaque} disabled={solicitandoSaque || !valorSaque || !pixKeySaque}
                        className="bg-green-600 hover:bg-green-700 rounded-xl gap-2">
                        {solicitandoSaque ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownCircle className="w-4 h-4" />}
                        Solicitar Saque
                      </Button>
                      <p className="text-zinc-600 text-xs">O admin irá processar sua solicitação em breve.</p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-zinc-800/60 text-center">
                      <p className="text-zinc-500 text-sm">Nenhum saldo disponível para saque.</p>
                    </div>
                  )}
                </div>

                {saques.length === 0 ? <EmptyState icon={ArrowDownCircle} message="Nenhuma solicitação de saque ainda." /> : saques.map(s => {
                  const st = STATUS_SAQUE[s.status] || STATUS_SAQUE.PENDENTE;
                  return (
                    <div key={s.id} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] flex items-center justify-between">
                      <div className="space-y-1">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}`}>{st.label}</span>
                        <p className="text-white font-bold text-lg">{fmtR(s.valor)}</p>
                        <p className="text-zinc-500 text-xs">Solicitado: {fmtDT(s.dataSolicitacao)}</p>
                        {s.dataPagamento && <p className="text-green-400 text-xs">Pago: {fmtDT(s.dataPagamento)}</p>}
                        {s.observacao && <p className="text-zinc-400 text-xs">{s.observacao}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedItem>
    </AnimatedPage>
  );
}