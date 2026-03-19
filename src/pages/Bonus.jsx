import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Award, Users, Wallet, ShoppingBag, CreditCard } from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Bonus() {
  const { partner: authPartner } = useAuthCustom();
  const [partner, setPartner] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (authPartner) loadData(); }, [authPartner]);

  const loadData = async () => {
    try {
      const partners = await base44.entities.Partner.filter({ user_id: authPartner.user_id });
      const currentPartner = partners.length > 0 ? partners[0] : authPartner;
      setPartner(currentPartner);
      const bonusTransactions = await base44.entities.BonusTransaction.filter({ partner_id: currentPartner.id });
      setTransactions(bonusTransactions.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) { console.error("[Bonus] Erro:", error); }
    finally { setLoading(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  if (loading) return <LoadingSpinner />;

  const graduations = {
    cliente_iniciante: { label: "Cliente Iniciante", directBonus: 15, indirectBonus: 30, groupsRequired: 5 },
    lider:   { label: "Líder",   directBonus: 15, indirectBonus: 32, groupsRequired: 10 },
    estrela: { label: "Estrela", directBonus: 15, indirectBonus: 34, groupsRequired: 20 },
    bronze:  { label: "Bronze",  directBonus: 15, indirectBonus: 36, groupsRequired: 40 },
    prata:   { label: "Prata",   directBonus: 15, indirectBonus: 38, groupsRequired: 80 },
    ouro:    { label: "Ouro",    directBonus: 15, indirectBonus: 40, groupsRequired: 160 },
  };
  const current = graduations[partner?.graduation] || graduations.cliente_iniciante;
  const progress = Math.min(100, ((partner?.groups_formed || 0) / current.groupsRequired) * 100);

  const creditedTransactions = transactions.filter(t => t.status === "credited");
  const blockedTransactions = transactions.filter(t => t.status === "blocked");

  const summaryCards = [
    { label: "Total Gerado",     value: fmt(partner?.total_bonus_generated), icon: TrendingUp,    color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Para Saque",       value: fmt(partner?.bonus_for_withdrawal),  icon: Wallet,        color: "text-green-400",  bg: "bg-green-500/10"  },
    { label: "Para Compras",     value: fmt(partner?.bonus_for_purchases),   icon: ShoppingBag,   color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Total Sacado",     value: fmt(partner?.total_withdrawn),       icon: CreditCard,    color: "text-blue-400",   bg: "bg-blue-500/10"   },
  ];

  return (
    <AnimatedPage>
      <PageHeader title="Minhas Comissões e Bônus" subtitle="Comissões (saque) e Bônus (trocas)" />

      {/* Info banner */}
      <AnimatedItem>
        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20">
          <p className="text-orange-400 font-semibold text-sm mb-1">📅 Informações de Pagamento</p>
          <p className="text-zinc-400 text-sm">Os depósitos são feitos automaticamente toda <strong className="text-white">segunda-feira</strong> das 00:00 às 06:00</p>
        </div>
      </AnimatedItem>

      {/* Summary */}
      <AnimatedItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-zinc-500 text-xs mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </AnimatedItem>

      {/* Graduation */}
      <AnimatedItem>
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-orange-400" />
            <h2 className="text-white font-bold">Sua Graduação</h2>
          </div>
          <div className="flex items-center gap-3 mb-5">
            <span className="px-4 py-2 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-bold text-sm">{current.label}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Comissão Direta", value: `${current.directBonus}%` },
              { label: "Comissão Indireta", value: `${current.indirectBonus}%` },
              { label: "Desempenho Req.", value: current.groupsRequired },
              { label: "Seu Desempenho", value: partner?.groups_formed || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-zinc-800/60 text-center">
                <p className="text-zinc-500 text-xs mb-1">{label}</p>
                <p className="text-white font-bold text-lg">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1"><Users className="w-3 h-3" /> Progresso</span>
              <span className="text-orange-400 font-medium">{partner?.groups_formed || 0} / {current.groupsRequired}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full" />
            </div>
          </div>
        </div>
      </AnimatedItem>

      {/* Transactions */}
      <AnimatedItem>
        <Tabs defaultValue="all">
          <TabsList className="bg-zinc-900 border border-white/[0.05] w-full sm:w-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none text-xs">Todos ({transactions.length})</TabsTrigger>
            <TabsTrigger value="credited" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none text-xs">Creditados ({creditedTransactions.length})</TabsTrigger>
            <TabsTrigger value="blocked" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none text-xs">Retidos ({blockedTransactions.length})</TabsTrigger>
          </TabsList>
          {[["all", transactions], ["credited", creditedTransactions], ["blocked", blockedTransactions]].map(([val, list]) => (
            <TabsContent key={val} value={val} className="mt-4">
              <TransactionList transactions={list} fmt={fmt} />
            </TabsContent>
          ))}
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}

function TransactionList({ transactions, fmt }) {
  if (transactions.length === 0) {
    return <EmptyState icon={TrendingUp} message="Nenhuma transação encontrada." />;
  }
  return (
    <motion.div variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
      {transactions.map((tx) => (
        <motion.div key={tx.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${tx.type === 'direct' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                  {tx.type === 'direct' ? 'Comissão Direta 15%' : 'Comissão Indireta 30%'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  tx.status === 'credited' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  tx.status === 'blocked' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                }`}>
                  {tx.status === 'credited' ? 'Creditado' : tx.status === 'blocked' ? 'Retido' : 'Pendente'}
                </span>
              </div>
              <p className="text-white text-sm">Troca/Compra de: <span className="font-medium">{tx.source_partner_name}</span></p>
              <p className="text-zinc-600 text-xs mt-0.5">{new Date(tx.created_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-white font-bold text-lg">{fmt(tx.total_amount)}</p>
              <p className="text-zinc-500 text-xs">Saque: {fmt(tx.amount_for_withdrawal)} | Compras: {fmt(tx.amount_for_purchases)}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}