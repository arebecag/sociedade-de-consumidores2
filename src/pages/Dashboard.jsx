import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import {
  Loader2, TrendingUp, Users, Award, ShoppingBag, CreditCard,
  AlertCircle, CheckCircle, ArrowUpRight, Wallet, BarChart2, Star
} from "lucide-react";
import { toast } from "sonner";
import EmailVerificationBanner from "@/components/EmailVerificationBanner.jsx";

const gradConfig = {
  cliente_iniciante: { label: "Cliente Iniciante", className: "bg-zinc-700 text-zinc-100" },
  lider:  { label: "Líder",   className: "bg-indigo-600 text-white" },
  estrela: { label: "Estrela", className: "bg-blue-500 text-white" },
  bronze: { label: "Bronze",  className: "bg-amber-700 text-white" },
  prata:  { label: "Prata",   className: "bg-slate-400 text-black" },
  ouro:   { label: "Ouro",    className: "bg-yellow-400 text-black" }
};

const bonusCards = [
  { key: "total_bonus_generated", label: "Total Gerado",            icon: TrendingUp, iconClass: "text-orange-400", bgClass: "bg-orange-500/10" },
  { key: "bonus_for_withdrawal",  label: "Disponível para Saque",   icon: Wallet,     iconClass: "text-green-400",  bgClass: "bg-green-500/10"  },
  { key: "total_withdrawn",       label: "Total Depositado",        icon: CreditCard, iconClass: "text-blue-400",   bgClass: "bg-blue-500/10"   },
  { key: "bonus_for_purchases",   label: "Bônus para Compras",      icon: ShoppingBag,iconClass: "text-purple-400", bgClass: "bg-purple-500/10" },
  { key: "total_spent_purchases", label: "Gasto em Compras",        icon: BarChart2,  iconClass: "text-pink-400",   bgClass: "bg-pink-500/10"   },
  { key: "groups_formed",         label: "Grupos Fechados",         icon: Star,       iconClass: "text-yellow-400", bgClass: "bg-yellow-500/10" },
];

const networkCards = [
  { key: "total",   label: "Total Clientes",          icon: Users,       iconClass: "text-orange-400" },
  { key: "direct",  label: "Nível 1 (Diretos)",        icon: Users,       iconClass: "text-blue-400"  },
  { key: "indirect",label: "Nível 2 (Indiretos)",      icon: Users,       iconClass: "text-purple-400"},
  { key: "active",  label: "Ativos",                   icon: CheckCircle, iconClass: "text-green-400" },
];

const quickActions = [
  { label: "Loja 3x3",       icon: ShoppingBag, page: "Store"       },
  { label: "Meus Clientes",  icon: Users,       page: "Network"     },
  { label: "Sacar Bônus",    icon: Wallet,      page: "Withdrawals" },
  { label: "Pagar Boletos",  icon: CreditCard,  page: "PayBoletos"  },
];

export default function Dashboard() {
  const { partner, loading: partnerLoading } = usePartner();
  const [myReferrer, setMyReferrer] = useState(null);
  const [networkStats, setNetworkStats] = useState({ direct: 0, indirect: 0, active: 0, pending: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem("pendingPartnerData");
  }, []);

  useEffect(() => {
    if (partner) loadNetworkStats(partner);
    else if (!partnerLoading) setStatsLoading(false);
  }, [partner, partnerLoading]);

  const loadNetworkStats = async (p) => {
    setStatsLoading(true);
    try {
      const myReferrerRelation = await base44.entities.NetworkRelation.filter({
        referred_id: p.id, relation_type: "direct"
      });
      if (myReferrerRelation.length > 0) {
        const allPartners = await base44.entities.Partner.list(null, 500);
        const found = allPartners.find(rp => rp.id === myReferrerRelation[0].referrer_id);
        if (found) setMyReferrer(found);
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
        });
      } else {
        setNetworkStats({ direct: 0, indirect: 0, active: 0, pending: 0 });
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

  const fmtN = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
  const grad = gradConfig[partner.graduation] || gradConfig.cliente_iniciante;

  const statusCls = partner.status === 'ativo'
    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
    : partner.status === 'pendente'
    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border border-red-500/30';

  const referrerStatusCls = (s) => s === 'ativo'
    ? 'bg-green-500/20 text-green-400'
    : s === 'pendente'
    ? 'bg-yellow-500/20 text-yellow-400'
    : 'bg-red-500/20 text-red-400';

  const networkValues = {
    total: networkStats.direct + networkStats.indirect,
    direct: `${networkStats.direct % 3}/3`,
    indirect: `${networkStats.indirect % 9}/9`,
    active: networkStats.active,
  };

  const bonusValue = (key, p) => {
    if (key === "groups_formed") return p.groups_formed || 0;
    return fmtN(p[key]);
  };

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm">Bem-vindo(a) de volta</p>
          <h1 className="text-2xl font-bold text-white">{partner.display_name || partner.full_name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusCls}`}>
            {partner.status?.toUpperCase()}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${grad.className}`}>
            {grad.label}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
            {partner.unique_code || "—"}
          </span>
        </div>
      </div>

      {/* Banners */}
      {!partner.email_verified && (
        <EmailVerificationBanner email={partner.email} />
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

      {/* Bônus */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Seus Bônus</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {bonusCards.map(({ key, label, icon: Icon, iconClass, bgClass }) => (
            <div key={key} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg ${bgClass} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${iconClass}`} />
              </div>
              <div>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${iconClass}`}>{bonusValue(key, partner)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rede + Indicador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Meus Clientes</p>
          {networkStats.direct === 0 && networkStats.indirect === 0 ? (
            <div className="min-h-[120px] rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Users className="w-8 h-8 text-zinc-600" />
              <p className="text-gray-400 text-sm">Nenhum cliente ainda.</p>
              <p className="text-gray-600 text-xs">Compartilhe seu código para crescer sua rede.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {networkCards.map(({ key, label, icon: Icon, iconClass }) => (
                <div key={key} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-gray-500 text-xs mb-2">{label}</p>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${iconClass}`} />
                    <span className={`text-xl font-bold ${iconClass}`}>{networkValues[key]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Meu Indicador</p>
          {myReferrer ? (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 text-lg font-bold">
                  {(myReferrer.display_name || myReferrer.full_name || "?")[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{myReferrer.display_name || myReferrer.full_name}</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">{myReferrer.unique_code}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${referrerStatusCls(myReferrer.status)}`}>
                {myReferrer.status?.toUpperCase()}
              </span>
            </div>
          ) : (
            <div className="min-h-[80px] rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-4">
              <p className="text-gray-500 text-sm text-center">Você é o primeiro cadastrado da rede.</p>
            </div>
          )}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ações Rápidas</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ label, icon: Icon, page }) => (
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