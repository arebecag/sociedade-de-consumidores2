import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { Loader2, TrendingUp, Users, Award, ShoppingBag, CreditCard, AlertCircle, CheckCircle, ArrowUpRight, Wallet, BarChart2, Star } from "lucide-react";
import { toast } from "sonner";

const gradConfig = {
  cliente_iniciante: { label: "Cliente Iniciante", bg: "bg-zinc-700", text: "text-zinc-200" },
  lider: { label: "Líder", bg: "bg-indigo-600", text: "text-white" },
  estrela: { label: "Estrela", bg: "bg-blue-500", text: "text-white" },
  bronze: { label: "Bronze", bg: "bg-amber-700", text: "text-white" },
  prata: { label: "Prata", bg: "bg-slate-400", text: "text-black" },
  ouro: { label: "Ouro", bg: "bg-yellow-500", text: "text-black" }
};

export default function Dashboard() {
  const { partner, loading: partnerLoading } = usePartner();
  const [myReferrer, setMyReferrer] = useState(null);
  const [networkStats, setNetworkStats] = useState({ direct: 0, indirect: 0, active: 0, pending: 0, excluded: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem("pendingPartnerData");
  }, []);

  useEffect(() => {
    if (partner) {
      loadNetworkStats(partner);
    } else if (!partnerLoading) {
      setStatsLoading(false);
    }
  }, [partner, partnerLoading]);

  const loadNetworkStats = async (p) => {
    setStatsLoading(true);
    try {
      const myReferrerRelation = await base44.entities.NetworkRelation.filter({
        referred_id: p.id,
        relation_type: "direct"
      });
      if (myReferrerRelation.length > 0) {
        const allPartners = await base44.entities.Partner.list(null, 500);
        const referrerPartner = allPartners.find(rp => rp.id === myReferrerRelation[0].referrer_id);
        if (referrerPartner) setMyReferrer(referrerPartner);
      }

      const [directRelations, indirectRelations] = await Promise.all([
        base44.entities.NetworkRelation.filter({ referrer_id: p.id, relation_type: "direct" }),
        base44.entities.NetworkRelation.filter({ referrer_id: p.id, relation_type: "indirect" })
      ]);

      const allReferredIds = [...new Set([
        ...directRelations.map(n => n.referred_id),
        ...indirectRelations.map(n => n.referred_id)
      ])];

      if (allReferredIds.length > 0) {
        const allPartners = await base44.entities.Partner.list(null, 500);
        const myReferred = allPartners.filter(rp => allReferredIds.includes(rp.id));
        setNetworkStats({
          direct: directRelations.length,
          indirect: indirectRelations.length,
          active: myReferred.filter(rp => rp.status === 'ativo').length,
          pending: myReferred.filter(rp => rp.status === 'pendente').length,
          excluded: myReferred.filter(rp => rp.status === 'excluido').length
        });
      } else {
        setNetworkStats({ direct: 0, indirect: 0, active: 0, pending: 0, excluded: 0 });
      }
    } catch (error) {
      console.error("[Dashboard] Erro ao carregar stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  if (partnerLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Complete seu cadastro</h2>
        <p className="text-gray-400">Acesse seu perfil para completar as informações necessárias.</p>
      </div>
    );
  }

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const fmtN = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
  const grad = gradConfig[partner.graduation] || gradConfig.cliente_iniciante;

  const statusColor = partner.status === 'ativo'
    ? 'bg-green-500/15 text-green-400 border-green-500/20'
    : partner.status === 'pendente'
    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20'
    : 'bg-red-500/15 text-red-400 border-red-500/20';

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-gray-500 text-sm mb-0.5">Bem-vindo(a) de volta</p>
          <h1 className="text-2xl font-bold text-white">{partner.display_name || partner.full_name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
            {partner.status?.toUpperCase()}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${grad.bg} ${grad.text}`}>
            {grad.label}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
            {partner.unique_code || "—"}
          </span>
        </div>
      </div>

      {/* ── Banners ── */}
      {!partner.email_verified && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-blue-400 font-medium text-sm">Verifique seu email — </span>
            <span className="text-gray-400 text-sm">Enviamos um link para <strong className="text-white">{partner.email}</strong></span>
          </div>
          <button
            onClick={async () => {
              try {
                const res = await base44.functions.invoke('sendVerificationEmail', {});
                if (res.data?.success) toast.success('Email reenviado!');
                else toast.error(res.data?.message || 'Erro ao reenviar');
              } catch { toast.error('Erro ao reenviar email'); }
            }}
            className="text-blue-400 hover:text-blue-300 text-xs underline flex-shrink-0"
          >
            Reenviar
          </button>
        </div>
      )}

      {partner.status === 'pendente' && partner.pending_reasons?.length > 0 && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-semibold text-sm">Conta Pendente</p>
              <ul className="mt-1 space-y-0.5">
                {partner.pending_reasons.map((r, i) => (
                  <li key={i} className="text-gray-400 text-sm">• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Bônus Cards ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Seus Bônus</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Total Gerado", value: fmtN(partner.total_bonus_generated), icon: TrendingUp, accent: "orange" },
            { label: "Disponível para Saque", value: fmtN(partner.bonus_for_withdrawal), icon: Wallet, accent: "green" },
            { label: "Total Depositado", value: fmtN(partner.total_withdrawn), icon: CreditCard, accent: "blue" },
            { label: "Bônus para Compras", value: fmtN(partner.bonus_for_purchases), icon: ShoppingBag, accent: "purple" },
            { label: "Gasto em Compras", value: fmtN(partner.total_spent_purchases), icon: BarChart2, accent: "pink" },
            { label: "Grupos Fechados", value: partner.groups_formed || 0, icon: Star, accent: "yellow" },
          ].map(({ label, value, icon: Icon, accent }) => {
            const colors = {
              orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/10" },
              green: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/10" },
              blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/10" },
              purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/10" },
              pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/10" },
              yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/10" },
            }[accent];
            return (
              <div key={label} className={`p-4 rounded-xl bg-zinc-900 border ${colors.border} flex flex-col gap-3`}>
                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${colors.text}`}>{value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Rede + Indicador ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Network */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Meus Clientes</h2>
          {networkStats.direct === 0 && networkStats.indirect === 0 ? (
            <div className="h-full min-h-[120px] rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Users className="w-8 h-8 text-zinc-600" />
              <p className="text-gray-400 text-sm">Nenhum cliente ainda.</p>
              <p className="text-gray-600 text-xs">Compartilhe seu código para crescer sua rede.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Clientes", value: networkStats.direct + networkStats.indirect, icon: Users, color: "text-orange-400" },
                { label: "Desempenho 1 (Nível 1)", value: `${networkStats.direct}/3`, icon: Users, color: "text-blue-400" },
                { label: "Desempenho 2 (Nível 2)", value: `${networkStats.indirect}/9`, icon: Users, color: "text-purple-400" },
                { label: "Ativos", value: networkStats.active, icon: CheckCircle, color: "text-green-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-gray-500 text-xs mb-1">{label}</p>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-xl font-bold ${color}`}>{value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indicador */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Meu Indicador</h2>
          {myReferrer ? (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 text-lg font-bold">
                  {(myReferrer.display_name || myReferrer.full_name)[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{myReferrer.display_name || myReferrer.full_name}</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">{myReferrer.unique_code}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                myReferrer.status === 'ativo' ? 'bg-green-500/15 text-green-400 border-green-500/20' :
                myReferrer.status === 'pendente' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' :
                'bg-red-500/15 text-red-400 border-red-500/20'
              }`}>
                {myReferrer.status?.toUpperCase()}
              </span>
            </div>
          ) : (
            <div className="min-h-[80px] rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center gap-2 p-4 text-center">
              <p className="text-gray-500 text-sm">Você é o primeiro cadastrado da rede.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Loja 3x3", icon: ShoppingBag, page: "Store" },
            { label: "Meus Clientes", icon: Users, page: "Network" },
            { label: "Sacar Bônus", icon: Wallet, page: "Withdrawals" },
            { label: "Pagar Boletos", icon: CreditCard, page: "PayBoletos" },
          ].map(({ label, icon: Icon, page }) => (
            <Link key={page} to={createPageUrl(page)}>
              <div className="group p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/20 transition-colors">
                  <Icon className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-white font-medium text-sm">{label}</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-600 group-hover:text-orange-400 transition-colors ml-auto" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}