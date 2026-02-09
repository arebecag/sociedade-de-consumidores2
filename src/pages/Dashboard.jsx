import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, Award, ShoppingBag, CreditCard, AlertCircle, CheckCircle, XCircle } from "lucide-react";

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <Card className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/40 transition-colors">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {subtext && <p className="text-gray-500 text-xs mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-${color.replace('text-', '')}/10`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const GraduationBadge = ({ graduation }) => {
  const gradConfig = {
    cliente_iniciante: { label: "Cliente Iniciante", color: "bg-white text-black" },
    lider: { label: "Líder", color: "bg-white text-black" },
    estrela: { label: "Estrela", color: "bg-blue-500 text-white" },
    bronze: { label: "Bronze", color: "bg-amber-700 text-white" },
    prata: { label: "Prata", color: "bg-gray-400 text-black" },
    ouro: { label: "Ouro", color: "bg-yellow-500 text-black" }
  };

  const config = gradConfig[graduation] || gradConfig.cliente_iniciante;

  return (
    <span className={`px-4 py-2 rounded-full font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
};

export default function Dashboard() {
  const [partner, setPartner] = useState(null);
  const [myReferrer, setMyReferrer] = useState(null);
  const [networkStats, setNetworkStats] = useState({ active: 0, pending: 0, excluded: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      
      // Check for pending registration
      const pendingData = localStorage.getItem("pendingPartnerData");
      if (pendingData) {
        const partnerData = JSON.parse(pendingData);
        const newPartner = await base44.entities.Partner.create(partnerData);
        localStorage.removeItem("pendingPartnerData");
        
        // Create network relation if has referrer
        if (partnerData.referrer_id) {
          await base44.entities.NetworkRelation.create({
            referrer_id: partnerData.referrer_id,
            referrer_name: partnerData.referrer_name,
            referred_id: newPartner.id,
            referred_name: partnerData.full_name,
            relation_type: "direct",
            level: 1
          });
          
          // Also create indirect relation to referrer's referrer if exists
          const referrers = await base44.entities.Partner.filter({ id: partnerData.referrer_id });
          if (referrers.length > 0 && referrers[0].referrer_id) {
            await base44.entities.NetworkRelation.create({
              referrer_id: referrers[0].referrer_id,
              referrer_name: referrers[0].referrer_name,
              referred_id: newPartner.id,
              referred_name: partnerData.full_name,
              relation_type: "indirect",
              level: 2
            });
          }
        }
      }
      
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        setPartner(partners[0]);
        
        // Get my referrer (quem me indicou)
        const myReferrerRelation = await base44.entities.NetworkRelation.filter({ referred_id: partners[0].id, relation_type: "direct" });
        if (myReferrerRelation.length > 0) {
          const referrerPartners = await base44.entities.Partner.filter({ id: myReferrerRelation[0].referrer_id });
          if (referrerPartners.length > 0) {
            setMyReferrer(referrerPartners[0]);
          }
        }
        
        // Get network stats (quem eu indiquei)
        const network = await base44.entities.NetworkRelation.filter({ referrer_id: partners[0].id });
        const referredIds = network.map(n => n.referred_id);
        
        if (referredIds.length > 0) {
          const referredPartners = await base44.entities.Partner.list();
          const myReferred = referredPartners.filter(p => referredIds.includes(p.id));
          
          setNetworkStats({
            active: myReferred.filter(p => p.status === 'ativo').length,
            pending: myReferred.filter(p => p.status === 'pendente').length,
            excluded: myReferred.filter(p => p.status === 'excluido').length
          });
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Complete seu cadastro</h2>
        <p className="text-gray-400">Acesse seu perfil para completar as informações necessárias.</p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Bem-vindo(a), {partner.display_name || partner.full_name}!</p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right">
            <p className="text-gray-400 text-sm">Status</p>
            <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
              partner.status === 'ativo' ? 'bg-green-500/20 text-green-500' :
              partner.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
              'bg-red-500/20 text-red-500'
            }`}>
              {partner.status?.toUpperCase()}
            </span>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Código Único</p>
            <span className="px-3 py-1 rounded-full font-semibold text-sm bg-orange-500/20 text-orange-500">
              {partner.unique_code || "N/A"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Sua Graduação</p>
            <GraduationBadge graduation={partner.graduation} />
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {partner.status === 'pendente' && partner.pending_reasons?.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-500">Status: PENDENTE</h3>
                <p className="text-gray-300 text-sm mt-1">Motivos:</p>
                <ul className="list-disc list-inside text-gray-400 text-sm">
                  {partner.pending_reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Referrer */}
      {myReferrer && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Meu Indicador</h2>
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-orange-500/10">
                  <Users className="w-8 h-8 text-orange-500" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">{myReferrer.display_name || myReferrer.full_name}</p>
                  <p className="text-gray-400 text-sm">Código: {myReferrer.unique_code}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full font-semibold text-xs ${
                    myReferrer.status === 'ativo' ? 'bg-green-500/20 text-green-500' :
                    myReferrer.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {myReferrer.status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bonus Stats */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Seus Bônus</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Total de Bônus Gerado"
            value={formatNumber(partner.total_bonus_generated)}
            icon={TrendingUp}
            color="text-orange-500"
          />
          <StatCard
            title="Bônus para Saque"
            value={formatNumber(partner.bonus_for_withdrawal)}
            icon={CreditCard}
            color="text-green-500"
            subtext="50% do total"
          />
          <StatCard
            title="Total Já Depositado"
            value={formatNumber(partner.total_withdrawn)}
            icon={CreditCard}
            color="text-blue-500"
          />
          <StatCard
            title="Bônus para Compras"
            value={formatNumber(partner.bonus_for_purchases)}
            icon={ShoppingBag}
            color="text-purple-500"
            subtext="50% do total"
          />
          <StatCard
            title="Total Gasto em Compras"
            value={formatNumber(partner.total_spent_purchases)}
            icon={ShoppingBag}
            color="text-pink-500"
          />
          <StatCard
            title="Grupos Formados"
            value={partner.groups_formed || 0}
            icon={Award}
            color="text-yellow-500"
            subtext="Grupos de 12 pessoas"
          />
        </div>
      </div>

      {/* Network Stats */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Minha Rede (indicados por mim)</h2>
        {networkStats.active === 0 && networkStats.pending === 0 && networkStats.excluded === 0 ? (
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Você ainda não indicou ninguém.</p>
              <p className="text-gray-500 text-sm mt-1">Compartilhe seu código único para começar a construir sua rede!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Clientes Ativos"
              value={networkStats.active}
              icon={CheckCircle}
              color="text-green-500"
            />
            <StatCard
              title="Clientes Pendentes"
              value={networkStats.pending}
              icon={AlertCircle}
              color="text-yellow-500"
            />
            <StatCard
              title="Clientes Excluídos"
              value={networkStats.excluded}
              icon={XCircle}
              color="text-red-500"
            />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to={createPageUrl("Store")}>
            <Card className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <ShoppingBag className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-white font-medium">Ir para Loja</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl("Network")}>
            <Card className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-white font-medium">Ver Rede</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl("Withdrawals")}>
            <Card className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <CreditCard className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-white font-medium">Sacar Bônus</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl("PayBoletos")}>
            <Card className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Award className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-white font-medium">Pagar Boletos</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}