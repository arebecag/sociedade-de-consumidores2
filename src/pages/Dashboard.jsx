import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { useAuthCustom } from "@/components/AuthContextCustom";
import {
  Loader2, TrendingUp, Users, Award, ShoppingBag, CreditCard,
  AlertCircle, CheckCircle, ArrowUpRight, Wallet, BarChart2, Star, ChevronRight
} from "lucide-react";
import EmailVerificationBanner from "@/components/EmailVerificationBanner.jsx";

const gradConfig = {
  cliente_iniciante: { label: "Cliente Iniciante", color: "text-zinc-300", bg: "bg-zinc-700/50 border-zinc-600" },
  lider:   { label: "Líder",   color: "text-indigo-300", bg: "bg-indigo-500/10 border-indigo-500/30" },
  estrela: { label: "Estrela", color: "text-blue-300",   bg: "bg-blue-500/10 border-blue-500/30"   },
  bronze:  { label: "Bronze",  color: "text-amber-300",  bg: "bg-amber-500/10 border-amber-500/30"  },
  prata:   { label: "Prata",   color: "text-slate-300",  bg: "bg-slate-500/10 border-slate-500/30"  },
  ouro:    { label: "Ouro",    color: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/30" },
};

const quickActions = [
  { label: "Loja 3x3",      icon: ShoppingBag, page: "Store",       desc: "Comprar produtos" },
  { label: "Meus Clientes", icon: Users,       page: "Network",     desc: "Ver minha rede" },
  { label: "Sacar Bônus",   icon: Wallet,      page: "Withdrawals", desc: "Solicitar saque" },
  { label: "Pagar Boletos", icon: CreditCard,  page: "PayBoletos",  desc: "Pagar com bônus" },
];

export default function Dashboard() {
  const { partner, loading: partnerLoading } = usePartner();
  const { user: authUser } = useAuthCustom();
  const [myReferrer, setMyReferrer] = useState(null);
  const [networkStats, setNetworkStats] = useState({ direct: 0, indirect: 0, active: 0, pending: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => { localStorage.removeItem("pendingPartnerData"); }, []);
  useEffect(() => {
    if (partner) loadNetworkStats(partner);
    else if (!partnerLoading) setStatsLoading(false);
  }, [partner, partnerLoading]);

  const loadNetworkStats = async (p) => {
    setStatsLoading(true);
    try {
      const myReferrerRelation = await base44.entities.NetworkRelation.filter({ referred_id: p.id, relation_type: "direct" });
      if (myReferrerRelation.length > 0) {
        const allPartners = await base44.entities.Partner.list(null, 500);
        const found = allPartners.find(rp => rp.id === myReferrerRelation[0].referrer_id);
        if (found) setMyReferrer(found);
      }
      const [directRelations, indirectRelations] = await Promise.all([
        base44.entities.NetworkRelation.filter({ referrer_id: p.id, relation_type: "direct" }),
        base44.entities.NetworkRelation.filter({ referrer_id: p.id, relation_type: "indirect" })
      ]);
      const allReferredIds = [...new Set([...directRelations.map(n => n.referred_id), ...indirectRelations.map(n => n.referred_id)])];
      if (allReferredIds.length > 0) {
        const allPartners = await base44.entities.Partner.list(null, 500);
        const myReferred = allPartners.filter(rp => allReferredIds.includes(rp.id));
        setNetworkStats({
          direct: directRelations.length, indirect: indirectRelations.length,
          active: myReferred.filter(rp => rp.status === 'ativo').length,
          pending: myReferred.filter(rp => rp.status === 'pendente').length,
        });
      } else setNetworkStats({ direct: 0, indirect: 0, active: 0, pending: 0 });
    } catch (error) { console.error("[Dashboard] Erro:", error); }
    finally { setStatsLoading(false); }
  };

  if (partnerLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-gray-500 text-sm">Carregando seu painel...</p>
        </div>
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
        <p className="text-gray-400">Acesse seu perfil para completar as informações.</p>
      </div>
    );
  }

  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const grad = gradConfig[partner.graduation] || gradConfig.cliente_iniciante;
  const statusInfo = partner.status === 'ativo'
    ? { label: 'ATIVO', cls: 'text-green-400 bg-green-500/10 border-green-500/20' }
    : partner.status === 'pendente'
    ? { label: 'PENDENTE', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
    : { label: 'EXCLUÍDO', cls: 'text-red-400 bg-red-500/10 border-red-500/20' };

  const bonusItems = [
    { label: "Total Gerado",          value: fmtR(partner.total_bonus_generated), icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Para Saque",            value: fmtR(partner.bonus_for_withdrawal),  icon: Wallet,     color: "text-green-400",  bg: "bg-green-500/10"  },
    { label: "Para Compras",          value: fmtR(partner.bonus_for_purchases),   icon: ShoppingBag,color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Total Depositado",      value: fmtR(partner.total_withdrawn),       icon: CreditCard, color: "text-blue-400",   bg: "bg-blue-500/10"   },
    { label: "Gasto em Compras",      value: fmtR(partner.total_spent_purchases), icon: BarChart2,  color: "text-pink-400",   bg: "bg-pink-500/10"   },
    { label: "Grupos Fechados",       value: partner.groups_formed || 0,          icon: Star,       color: "text-yellow-400", bg: "bg-yellow-500/10" },
  ];

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-gray-500 text-sm mb-1">Bem-vindo(a) de volta 👋</p>
          <h1 className="text-3xl font-black text-white">{partner.display_name || partner.full_name}</h1>
          <p className="text-gray-500 text-sm mt-1">{partner.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusInfo.cls}`}>{statusInfo.label}</span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${grad.bg} ${grad.color}`}>{grad.label}</span>
          {partner.unique_code && (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              #{partner.unique_code}
            </span>
          )}
        </div>
      </div>

      {/* Banners */}
      {!authUser?.is_email_verified && <EmailVerificationBanner email={partner.email} />}

      {partner.status === 'pendente' && partner.pending_reasons?.length > 0 && (
        <div className="p-4 rounded-2xl bg-yellow-500/8 border border-yellow-500/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-yellow-300 font-semibold text-sm mb-1">Conta Pendente — ação necessária</p>
            <ul className="space-y-0.5">
              {partner.pending_reasons.map((r, i) => (
                <li key={i} className="text-gray-400 text-sm flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-yellow-500 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Bônus Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Seus Bônus</h2>
          <Link to={createPageUrl("Bonus")} className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1">
            Ver extrato <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {bonusItems.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-gray-500 text-xs mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rede + Indicador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">Minha Rede</h2>
            <Link to={createPageUrl("Network")} className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {networkStats.direct === 0 && networkStats.indirect === 0 ? (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 text-center">
              <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">Nenhum cliente ainda</p>
              <p className="text-gray-600 text-xs mt-1">Compartilhe seu código para crescer</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total", value: networkStats.direct + networkStats.indirect, color: "text-orange-400" },
                { label: "Ativos", value: networkStats.active, color: "text-green-400" },
                { label: `Nível 1 (${networkStats.direct % 3}/3)`, value: networkStats.direct, color: "text-blue-400" },
                { label: `Nível 2 (${networkStats.indirect % 9}/9)`, value: networkStats.indirect, color: "text-purple-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <p className="text-gray-500 text-xs mb-2">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-white font-bold text-lg mb-4">Meu Indicador</h2>
          {myReferrer ? (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 text-xl font-bold">
                  {(myReferrer.display_name || myReferrer.full_name || "?")[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{myReferrer.display_name || myReferrer.full_name}</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">#{myReferrer.unique_code}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                myReferrer.status === 'ativo' ? 'bg-green-500/10 text-green-400' :
                myReferrer.status === 'pendente' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {myReferrer.status?.toUpperCase()}
              </span>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center min-h-[80px]">
              <p className="text-gray-500 text-sm">Você é o primeiro da rede.</p>
            </div>
          )}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-white font-bold text-lg mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ label, icon: Icon, page, desc }) => (
            <Link key={page} to={createPageUrl(page)}>
              <div className="group p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-800/80 transition-all cursor-pointer h-full">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3 group-hover:bg-orange-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-orange-400" />
                </div>
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}