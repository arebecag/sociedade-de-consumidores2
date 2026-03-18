import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { TrendingUp, TrendingDown, ShoppingBag, CreditCard, FileText, DollarSign, GraduationCap, ExternalLink } from "lucide-react";

export default function Extrato() {
  const [partner, setPartner] = useState(null);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cursosLogs, setCursosLogs] = useState([]);
  const [financeiros, setFinanceiros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        const p = partners[0]; setPartner(p);
        const [bonus, withdrawal, purchase, cursosCompras, fins] = await Promise.all([
          base44.entities.BonusTransaction.filter({ partner_id: p.id }),
          base44.entities.Withdrawal.filter({ partner_id: p.id }),
          base44.entities.Purchase.filter({ partner_id: p.id }),
          base44.entities.ComprasCursosEAD.filter({ usuarioId: p.id }),
          base44.entities.Financeiro.filter({ userId: p.id }),
        ]);
        setBonusTransactions(bonus.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setWithdrawals(withdrawal.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setPurchases(purchase.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setCursosLogs(cursosCompras.filter(c => c.status === 'LIBERADO').sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setFinanceiros(fins.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch { }
    finally { setLoading(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  if (loading) return <LoadingSpinner />;

  const summary = [
    { label: "Bônus Total Gerado",    value: fmt(partner?.total_bonus_generated), icon: TrendingUp,  color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Disponível p/ Saque",   value: fmt(partner?.bonus_for_withdrawal),  icon: DollarSign,  color: "text-green-400",  bg: "bg-green-500/10"  },
    { label: "Disponível p/ Compras", value: fmt(partner?.bonus_for_purchases),   icon: ShoppingBag, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Total Sacado",          value: fmt(partner?.total_withdrawn),       icon: CreditCard,  color: "text-blue-400",   bg: "bg-blue-500/10"   },
  ];

  const TxRow = ({ icon: Icon, iconColor, label, sub, date, value, valueColor, statusEl, extra }) => (
    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-white/[0.04]">
      <div className={`w-8 h-8 rounded-lg ${iconColor.replace("text-", "bg-").replace("400", "500/10")} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{label}</p>
        {sub && <p className="text-zinc-500 text-xs truncate">{sub}</p>}
        <p className="text-zinc-600 text-xs">{new Date(date).toLocaleString('pt-BR')}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold text-sm ${valueColor}`}>{value}</p>
        {statusEl}
        {extra}
      </div>
    </motion.div>
  );

  const StatusBadge = ({ status, map }) => {
    const cfg = map[status] || {};
    return <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.cls || 'bg-zinc-700 text-zinc-400'}`}>{cfg.label || status}</span>;
  };

  const bonusStatus = { credited: { cls: "bg-green-500/10 text-green-400", label: "Creditado" }, blocked: { cls: "bg-red-500/10 text-red-400", label: "Retido" }, pending: { cls: "bg-yellow-500/10 text-yellow-400", label: "Pendente" } };
  const wStatus    = { completed: { cls: "bg-green-500/10 text-green-400", label: "Concluído" }, cancelled: { cls: "bg-red-500/10 text-red-400", label: "Cancelado" }, pending: { cls: "bg-yellow-500/10 text-yellow-400", label: "Pendente" } };
  const pStatus    = { paid: { cls: "bg-green-500/10 text-green-400", label: "Pago" }, cancelled: { cls: "bg-red-500/10 text-red-400", label: "Cancelado" }, pending: { cls: "bg-yellow-500/10 text-yellow-400", label: "Pendente" } };

  return (
    <AnimatedPage>
      <PageHeader title="Extrato e Movimentações" subtitle="Acompanhe todas as suas transações financeiras" />

      <AnimatedItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.map(({ label, value, icon: Icon, color, bg }) => (
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
        <Tabs defaultValue="bonus">
          <div className="overflow-x-auto">
            <TabsList className="bg-zinc-900 border border-white/[0.05] mb-4 w-max">
              <TabsTrigger value="bonus" className="data-[state=active]:bg-orange-500 text-xs"><TrendingUp className="w-3 h-3 mr-1" />Bônus ({bonusTransactions.length})</TabsTrigger>
              <TabsTrigger value="withdrawals" className="data-[state=active]:bg-orange-500 text-xs"><CreditCard className="w-3 h-3 mr-1" />Saques ({withdrawals.length})</TabsTrigger>
              <TabsTrigger value="purchases" className="data-[state=active]:bg-orange-500 text-xs"><ShoppingBag className="w-3 h-3 mr-1" />Compras ({purchases.length})</TabsTrigger>
              <TabsTrigger value="cursos" className="data-[state=active]:bg-orange-500 text-xs"><GraduationCap className="w-3 h-3 mr-1" />Cursos ({cursosLogs.length})</TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 text-xs"><FileText className="w-3 h-3 mr-1" />Todas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bonus">
            {bonusTransactions.length === 0 ? <EmptyState icon={TrendingUp} message="Nenhuma transação de bônus ainda." /> : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.04 } } }} initial="hidden" animate="show" className="space-y-2">
                {bonusTransactions.map(t => (
                  <TxRow key={t.id} icon={TrendingUp} iconColor="text-green-400"
                    label={`Bônus ${t.type === 'direct' ? 'Direto' : 'Indireto'} (${t.percentage}%)`}
                    sub={`De: ${t.source_partner_name}`} date={t.created_date}
                    value={`+${fmt(t.total_amount)}`} valueColor="text-green-400"
                    statusEl={<StatusBadge status={t.status} map={bonusStatus} />} />
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="withdrawals">
            {withdrawals.length === 0 ? <EmptyState icon={CreditCard} message="Nenhum saque realizado ainda." /> : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.04 } } }} initial="hidden" animate="show" className="space-y-2">
                {withdrawals.map(w => (
                  <TxRow key={w.id} icon={TrendingDown} iconColor="text-red-400"
                    label="Saque via PIX/TED"
                    sub={`Chave: ${w.pix_key?.substring(0, 20)}...`} date={w.created_date}
                    value={`-${fmtR(w.amount)}`} valueColor="text-red-400"
                    statusEl={<StatusBadge status={w.status} map={wStatus} />} />
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="purchases">
            {purchases.length === 0 ? <EmptyState icon={ShoppingBag} message="Nenhuma compra realizada ainda." /> : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.04 } } }} initial="hidden" animate="show" className="space-y-2">
                {purchases.map(p => {
                  const boleto = financeiros.find(f => f.status === 'PENDING' && f.descricao?.includes(p.product_name));
                  return (
                    <TxRow key={p.id} icon={ShoppingBag} iconColor="text-purple-400"
                      label={p.product_name}
                      sub={`Pagamento: ${p.payment_method === 'bonus' ? 'Bônus' : p.payment_method === 'boleto' ? 'Boleto' : 'Misto'}`}
                      date={p.created_date} value={fmtR(p.amount)} valueColor="text-purple-400"
                      statusEl={<StatusBadge status={p.status} map={pStatus} />}
                      extra={p.status === 'pending' && boleto?.invoiceUrl ? (
                        <a href={boleto.invoiceUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs h-6 px-2 mt-1 gap-1">
                            <ExternalLink className="w-3 h-3" /> Pagar
                          </Button>
                        </a>
                      ) : null} />
                  );
                })}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="cursos">
            {cursosLogs.length === 0 ? <EmptyState icon={GraduationCap} message="Nenhum curso adquirido ainda." /> : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.04 } } }} initial="hidden" animate="show" className="space-y-2">
                {cursosLogs.map(c => (
                  <TxRow key={c.id} icon={GraduationCap} iconColor="text-blue-400"
                    label={c.cursoNome} sub="BONUS_USADO_CURSO" date={c.created_date}
                    value={`-${fmt(c.valorBonus)}`} valueColor="text-orange-400"
                    statusEl={<span className="text-xs text-green-400 font-medium">Liberado</span>} />
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="all">
            {bonusTransactions.length === 0 && withdrawals.length === 0 && purchases.length === 0 && cursosLogs.length === 0 ? (
              <EmptyState icon={FileText} message="Nenhuma movimentação ainda." />
            ) : (() => {
              const all = [
                ...bonusTransactions.map(t => ({ ...t, txType: 'bonus' })),
                ...withdrawals.map(t => ({ ...t, txType: 'withdrawal' })),
                ...purchases.map(t => ({ ...t, txType: 'purchase' })),
                ...cursosLogs.map(t => ({ ...t, txType: 'curso' })),
              ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
              return (
                <motion.div variants={{ show: { transition: { staggerChildren: 0.03 } } }} initial="hidden" animate="show" className="space-y-2">
                  {all.map(t => {
                    const iconMap = { bonus: [TrendingUp, "text-green-400"], withdrawal: [TrendingDown, "text-red-400"], purchase: [ShoppingBag, "text-purple-400"], curso: [GraduationCap, "text-blue-400"] };
                    const [Icon, iconColor] = iconMap[t.txType];
                    const labelMap = { bonus: `Bônus ${t.type === 'direct' ? 'Direto' : 'Indireto'}`, withdrawal: 'Saque via PIX/TED', purchase: t.product_name, curso: `Curso: ${t.cursoNome}` };
                    const valueMap = { bonus: `+${fmt(t.total_amount)}`, withdrawal: `-${fmtR(t.amount)}`, purchase: fmtR(t.amount), curso: `-${fmt(t.valorBonus)}` };
                    const colorMap = { bonus: "text-green-400", withdrawal: "text-red-400", purchase: "text-purple-400", curso: "text-orange-400" };
                    return (
                      <TxRow key={t.id + t.txType} icon={Icon} iconColor={iconColor}
                        label={labelMap[t.txType]} date={t.created_date}
                        value={valueMap[t.txType]} valueColor={colorMap[t.txType]} />
                    );
                  })}
                </motion.div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}