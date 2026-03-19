import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { Users, ChevronRight, CheckCircle, AlertCircle, XCircle, Share2, Copy, User } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Network() {
  const { partner: authPartner } = useAuthCustom();
  const [partner, setPartner] = useState(null);
  const [directClients, setDirectClients] = useState([]);
  const [indirectClients, setIndirectClients] = useState([]);
  const [allPartners, setAllPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spilloverDialogOpen, setSpilloverDialogOpen] = useState(false);
  const [selectedDirectClient, setSelectedDirectClient] = useState("");
  const [spilloverEmail, setSpilloverEmail] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => { if (authPartner) loadData(); }, [authPartner]);

  const loadData = async () => {
    try {
      const partners = await base44.entities.Partner.filter({ user_id: authPartner.user_id });
      if (partners.length > 0) {
        const p = partners[0];
        setPartner(p);
        const relations = await base44.entities.NetworkRelation.filter({ referrer_id: p.id });
        const directRelations = relations.filter(r => r.relation_type === "direct");
        const indirectRelations = relations.filter(r => r.relation_type === "indirect");
        const directIds = directRelations.map(r => r.referred_id);
        const indirectIds = indirectRelations.map(r => r.referred_id);
        const all = await base44.entities.Partner.list(null, 500);
        setAllPartners(all);
        setDirectClients(all.filter(partner => directIds.includes(partner.id)));
        setIndirectClients(all.filter(partner => indirectIds.includes(partner.id)));
      }
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const copySiteLink = () => {
    if (!partner) return;
    const link = `${window.location.origin}/PartnerSite?p=${partner.unique_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleSpillover = async () => {
    if (!selectedDirectClient || !spilloverEmail) { toast.error("Preencha todos os campos"); return; }
    setProcessing(true);
    try {
      const clientToSpill = allPartners.find(p => p.email === spilloverEmail || p.created_by === spilloverEmail);
      if (!clientToSpill) { toast.error("Cliente não encontrado"); setProcessing(false); return; }
      const targetRelations = await base44.entities.NetworkRelation.filter({ referrer_id: selectedDirectClient });
      if (targetRelations.filter(r => r.relation_type === "direct").length >= 3) {
        toast.error("Este cliente já possui 3 indicados diretos"); setProcessing(false); return;
      }
      await base44.entities.NetworkRelation.create({
        referrer_id: selectedDirectClient,
        referrer_name: allPartners.find(p => p.id === selectedDirectClient)?.full_name,
        referred_id: clientToSpill.id,
        referred_name: clientToSpill.full_name,
        relation_type: "indirect", is_spillover: true, level: 2
      });
      toast.success("Derramamento realizado com sucesso!");
      setSpilloverDialogOpen(false); setSelectedDirectClient(""); setSpilloverEmail("");
      loadData();
    } catch (error) { toast.error("Erro ao realizar derramamento"); }
    finally { setProcessing(false); }
  };

  const StatusPill = ({ status }) => {
    const cfg = {
      ativo:    { icon: CheckCircle, cls: "bg-green-500/10 text-green-400 border-green-500/20", label: "ATIVO" },
      pendente: { icon: AlertCircle, cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "PENDENTE" },
      excluido: { icon: XCircle,     cls: "bg-red-500/10 text-red-400 border-red-500/20", label: "EXCLUÍDO" },
    };
    const { icon: Icon, cls, label } = cfg[status] || cfg.pendente;
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
        <Icon className="w-3 h-3" />{label}
      </span>
    );
  };

  const ClientRow = ({ client, type }) => (
    <motion.div variants={fadeUp}
      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/[0.04] hover:border-white/10 transition-all">
      <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
        <span className="text-orange-400 text-sm font-bold">{(client.display_name || client.full_name || "?")[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{client.display_name || client.full_name}</p>
        <p className="text-zinc-600 text-xs">{new Date(client.created_date).toLocaleDateString('pt-BR')} · {type === "direct" ? "Bônus: 15%" : "Bônus: 30%+"}</p>
        {client.status === 'pendente' && client.pending_reasons?.length > 0 && (
          <p className="text-yellow-500/80 text-xs truncate">• {client.pending_reasons[0]}</p>
        )}
      </div>
      <StatusPill status={client.status} />
    </motion.div>
  );

  const ClientGroup = ({ clients, type, emptyMsg }) => {
    const active = clients.filter(c => c.status === 'ativo');
    const pending = clients.filter(c => c.status === 'pendente');
    const deleted = clients.filter(c => c.status === 'excluido');
    return (
      <Tabs defaultValue="pendentes">
        <TabsList className="bg-zinc-900 border border-white/[0.05] mb-4">
          <TabsTrigger value="ativos" className="data-[state=active]:bg-orange-500 text-xs">Ativos ({active.length})</TabsTrigger>
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-orange-500 text-xs">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="excluidos" className="data-[state=active]:bg-orange-500 text-xs">Excluídos ({deleted.length})</TabsTrigger>
        </TabsList>
        {[["ativos", active], ["pendentes", pending], ["excluidos", deleted]].map(([val, list]) => (
          <TabsContent key={val} value={val}>
            {list.length === 0 ? (
              <EmptyState icon={Users} message={`Nenhum cliente ${val === 'ativos' ? 'ativo' : val === 'pendentes' ? 'pendente' : 'excluído'}.`} />
            ) : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-2">
                {list.map(c => <ClientRow key={c.id} client={c} type={type} />)}
              </motion.div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  if (loading) return <LoadingSpinner />;

  const statsData = [
    { label: "Total", value: directClients.length + indirectClients.length, color: "text-orange-400" },
    { label: "Ativos", value: [...directClients, ...indirectClients].filter(c => c.status === 'ativo').length, color: "text-green-400" },
    { label: `Nível 1 (${directClients.length % 3}/3)`, value: directClients.length, color: "text-blue-400" },
    { label: `Nível 2 (${indirectClients.length % 9}/9)`, value: indirectClients.length, color: "text-purple-400" },
    { label: "Desempenho", value: partner?.groups_formed || 0, color: "text-yellow-400" },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Meus Clientes"
        subtitle="Acompanhe seus clientes indicados"
        action={
          <Button onClick={copySiteLink} className="bg-orange-500 hover:bg-orange-600 gap-2">
            <Share2 className="w-4 h-4" /> Copiar Link do Site
          </Button>
        }
      />

      {partner?.referrer_name && (
        <AnimatedItem>
          <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Meu Indicador</p>
              <p className="text-white font-semibold">{partner.referrer_name}</p>
            </div>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statsData.map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] text-center">
              <p className="text-zinc-500 text-xs mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <Tabs defaultValue="direct">
          <TabsList className="bg-zinc-900 border border-white/[0.05] mb-6 w-full sm:w-auto">
            <TabsTrigger value="direct" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none">
              <Users className="w-4 h-4 mr-2" />Desempenho 1 ({directClients.length})
            </TabsTrigger>
            <TabsTrigger value="indirect" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none">
              <ChevronRight className="w-4 h-4 mr-2" />Desempenho 2 ({indirectClients.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="direct">
            <ClientGroup clients={directClients} type="direct" />
          </TabsContent>
          <TabsContent value="indirect">
            <ClientGroup clients={indirectClients} type="indirect" />
          </TabsContent>
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}