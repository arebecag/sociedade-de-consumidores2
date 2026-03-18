import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { CreditCard, AlertTriangle, CheckCircle, Clock, XCircle, Banknote, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function Withdrawals() {
  const [partner, setPartner] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
        const userWithdrawals = await base44.entities.Withdrawal.filter({ partner_id: partners[0].id });
        setWithdrawals(userWithdrawals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const StatusPill = ({ status }) => {
    const cfg = {
      pending:   { icon: Clock,         cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pendente" },
      completed: { icon: CheckCircle,   cls: "bg-green-500/10 text-green-400 border-green-500/20",   label: "Depositado" },
      cancelled: { icon: XCircle,       cls: "bg-red-500/10 text-red-400 border-red-500/20",          label: "Cancelado" },
    };
    const { icon: Icon, cls, label } = cfg[status] || cfg.pending;
    return (
      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
        <Icon className="w-3 h-3" />{label}
      </span>
    );
  };

  if (loading) return <LoadingSpinner />;

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
  const totalPending = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
  const totalCompleted = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

  const stats = [
    { label: "Disponível para Saque", value: fmtR(partner?.bonus_for_withdrawal), icon: CreditCard, color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Saques Pendentes",      value: fmtR(totalPending),                  icon: Clock,      color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Total Depositado",      value: fmtR(totalCompleted),                icon: CheckCircle,color: "text-green-400",  bg: "bg-green-500/10"  },
    { label: "Forma de Recebimento",  value: partner?.pix_key_type === 'pix' ? 'PIX' : partner?.pix_key_type === 'ted' ? 'TED' : 'Não configurada',
      icon: Banknote, color: "text-blue-400", bg: "bg-blue-500/10" },
  ];

  return (
    <AnimatedPage>
      <PageHeader title="Pagamentos Automáticos" subtitle="Histórico de depósitos semanais" />

      <AnimatedItem>
        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-300 font-semibold text-sm">Pagamentos Automáticos</p>
            <p className="text-zinc-400 text-sm mt-0.5">Depósitos toda <strong className="text-white">segunda-feira</strong> das 00:00 às 06:00. Configure sua forma de recebimento no Perfil.</p>
          </div>
        </div>
      </AnimatedItem>

      {!partner?.pix_key_type && (
        <AnimatedItem>
          <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-zinc-300 text-sm">Configure sua forma de recebimento (PIX ou TED) no <strong>Perfil</strong> para receber seus pagamentos.</p>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-zinc-500 text-xs mb-1">{label}</p>
              <p className={`text-base font-bold ${color} break-all`}>{value}</p>
              {label === "Forma de Recebimento" && partner?.pix_key_type === 'pix' && partner?.pix_key && (
                <p className="text-zinc-600 text-xs mt-1 truncate">{partner.pix_key}</p>
              )}
            </div>
          ))}
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h2 className="text-white font-bold">Histórico de Pagamentos</h2>
          </div>
          <div className="p-4">
            {withdrawals.length === 0 ? (
              <EmptyState icon={CreditCard} message="Nenhum pagamento realizado ainda." sub="Os pagamentos começarão automaticamente na próxima segunda-feira." />
            ) : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
                {withdrawals.map((w) => (
                  <motion.div key={w.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-zinc-800/50 border border-white/[0.04]">
                    <div className="space-y-1">
                      <StatusPill status={w.status} />
                      <p className="text-zinc-500 text-xs">Processado: {new Date(w.created_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      {w.completed_date && <p className="text-green-400 text-xs">Depositado: {new Date(w.completed_date).toLocaleDateString('pt-BR')}</p>}
                      {w.pix_key && <p className="text-zinc-500 text-xs">Destino: {w.pix_key}</p>}
                    </div>
                    <p className="text-2xl font-bold text-white">{fmtR(w.amount)}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </AnimatedItem>
    </AnimatedPage>
  );
}