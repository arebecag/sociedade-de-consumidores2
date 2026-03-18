import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { Users, ShoppingBag, TrendingUp, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";

const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const StatusPill = ({ status, reasons }) => {
  if (status === 'ativo') return <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-green-500/10 text-green-400 border-green-500/20">ATIVO</span>;
  if (status === 'pendente') return (
    <div>
      <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">PENDENTE</span>
      {reasons?.length > 0 && <p className="text-yellow-500/80 text-xs mt-0.5">{reasons[0]}</p>}
    </div>
  );
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20">EXCLUÍDO</span>;
};

const tableClass = "border-zinc-800/60 text-zinc-400 text-xs font-semibold uppercase tracking-wider";
const rowClass = "border-zinc-800/40 hover:bg-zinc-800/30 transition-colors";

export default function Reports() {
  const [partner, setPartner] = useState(null);
  const [clients, setClients] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        const p = partners[0]; setPartner(p);
        const allPartners = await base44.entities.Partner.list();
        const relations = await base44.entities.NetworkRelation.filter({ referrer_id: p.id });
        const clientIds = relations.map(r => r.referred_id);
        setClients(allPartners.filter(partner => clientIds.includes(partner.id)));
        const allIds = [p.id, ...clientIds];
        const allPurchases = await base44.entities.Purchase.list();
        setPurchases(allPurchases.filter(purchase => allIds.includes(purchase.partner_id)));
        const [bonus, userWithdrawals] = await Promise.all([
          base44.entities.BonusTransaction.filter({ partner_id: p.id }),
          base44.entities.Withdrawal.filter({ partner_id: p.id })
        ]);
        setBonusTransactions(bonus);
        setWithdrawals(userWithdrawals);
      }
    } catch { }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingSpinner />;

  const totalBonusGenerated = bonusTransactions.reduce((s, t) => s + (t.total_amount || 0), 0);
  const totalBonusPaid = bonusTransactions.filter(t => t.status === 'credited').reduce((s, t) => s + (t.total_amount || 0), 0);
  const totalBonusPending = bonusTransactions.filter(t => t.status !== 'credited').reduce((s, t) => s + (t.total_amount || 0), 0);
  const totalDeposits = withdrawals.filter(w => w.status === 'completed').reduce((s, w) => s + (w.amount || 0), 0);

  return (
    <AnimatedPage>
      <PageHeader title="Relatórios" subtitle="Visualize todas as suas informações" />

      <AnimatedItem>
        <Tabs defaultValue="clients">
          <div className="overflow-x-auto mb-6">
            <TabsList className="bg-zinc-900 border border-white/[0.05] w-max">
              {[
                { value: "clients", icon: Users, label: "Clientes" },
                { value: "purchases", icon: ShoppingBag, label: "Compras" },
                { value: "bonus", icon: TrendingUp, label: "Bônus" },
                { value: "deposits", icon: CreditCard, label: "Depósitos" },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger key={value} value={value} className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <Icon className="w-3 h-3" />{label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="clients">
            <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <h2 className="text-white font-bold">Clientes Cadastrados ({clients.length})</h2>
              </div>
              {clients.length === 0 ? <EmptyState icon={Users} message="Nenhum cliente cadastrado." /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800/60">
                        <TableHead className={tableClass}>Nome</TableHead>
                        <TableHead className={tableClass}>Cadastro</TableHead>
                        <TableHead className={tableClass}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map(client => (
                        <TableRow key={client.id} className={rowClass}>
                          <TableCell className="text-white text-sm font-medium">{client.full_name}</TableCell>
                          <TableCell className="text-zinc-400 text-sm">{fmtDate(client.created_date)}</TableCell>
                          <TableCell><StatusPill status={client.status} reasons={client.pending_reasons} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="purchases">
            <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <h2 className="text-white font-bold">Relatório de Compras ({purchases.length})</h2>
              </div>
              {purchases.length === 0 ? <EmptyState icon={ShoppingBag} message="Nenhuma compra encontrada." /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800/60">
                        {["Produto", "Comprador", "Valor", "Bônus", "Data"].map(h => <TableHead key={h} className={tableClass}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map(p => {
                        const bonus = bonusTransactions.find(t => t.purchase_id === p.id);
                        return (
                          <TableRow key={p.id} className={rowClass}>
                            <TableCell className="text-white text-sm">{p.product_name}</TableCell>
                            <TableCell className="text-zinc-400 text-sm">{p.partner_name}</TableCell>
                            <TableCell className="text-white text-sm font-medium">{fmtR(p.amount)}</TableCell>
                            <TableCell className="text-orange-400 text-sm">{bonus ? fmtR(bonus.total_amount) : '—'}</TableCell>
                            <TableCell className="text-zinc-400 text-sm">{fmtDate(p.created_date)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bonus">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total Gerado", value: fmtR(totalBonusGenerated), color: "text-orange-400", bg: "bg-orange-500/10" },
                { label: "Total Pago", value: fmtR(totalBonusPaid), color: "text-green-400", bg: "bg-green-500/10" },
                { label: "A Receber", value: fmtR(totalBonusPending), color: "text-yellow-400", bg: "bg-yellow-500/10" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] text-center">
                  <p className="text-zinc-500 text-xs mb-1">{label}</p>
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <h2 className="text-white font-bold">Histórico de Bônus ({bonusTransactions.length})</h2>
              </div>
              {bonusTransactions.length === 0 ? <EmptyState icon={TrendingUp} message="Nenhum bônus registrado." /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800/60">
                        {["Origem", "Tipo", "Valor", "Status", "Data"].map(h => <TableHead key={h} className={tableClass}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusTransactions.map(tx => (
                        <TableRow key={tx.id} className={rowClass}>
                          <TableCell className="text-white text-sm">{tx.source_partner_name}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${tx.type === 'direct' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                              {tx.type === 'direct' ? 'Direto' : 'Indireto'}
                            </span>
                          </TableCell>
                          <TableCell className="text-orange-400 text-sm font-medium">{fmtR(tx.total_amount)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${tx.status === 'credited' ? 'bg-green-500/10 text-green-400 border-green-500/20' : tx.status === 'blocked' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                              {tx.status === 'credited' ? 'Creditado' : tx.status === 'blocked' ? 'Bloqueado' : 'Pendente'}
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm">{fmtDate(tx.created_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="deposits">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] mb-4">
              <p className="text-zinc-500 text-xs mb-1">Total Depositado</p>
              <p className="text-green-400 font-black text-2xl">{fmtR(totalDeposits)}</p>
            </div>
            <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <h2 className="text-white font-bold">Relatório de Depósitos ({withdrawals.length})</h2>
              </div>
              {withdrawals.length === 0 ? <EmptyState icon={CreditCard} message="Nenhum depósito registrado." /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800/60">
                        {["Valor", "Status", "Solicitado", "Depositado"].map(h => <TableHead key={h} className={tableClass}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map(w => (
                        <TableRow key={w.id} className={rowClass}>
                          <TableCell className="text-white font-semibold text-sm">{fmtR(w.amount)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${w.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : w.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                              {w.status === 'completed' ? 'Depositado' : w.status === 'pending' ? 'Pendente' : 'Cancelado'}
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm">{fmtDate(w.created_date)}</TableCell>
                          <TableCell className="text-zinc-400 text-sm">{w.completed_date ? fmtDate(w.completed_date) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}