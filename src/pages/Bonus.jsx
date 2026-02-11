import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, ArrowUpRight, ArrowDownRight, Award, Users } from "lucide-react";

export default function Bonus() {
  const [partner, setPartner] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        setPartner(partners[0]);
        
        const bonusTransactions = await base44.entities.BonusTransaction.filter({ partner_id: partners[0].id });
        setTransactions(bonusTransactions.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const GraduationInfo = () => {
    if (!partner) return null;
    
    const graduations = {
      cliente_iniciante: {
        label: "Cliente Iniciante",
        color: "bg-white text-black",
        directBonus: 15,
        indirectBonus: 30,
        groupsRequired: 5,
        timeRequired: "30 dias"
      },
      lider: {
        label: "Líder",
        color: "bg-white text-black",
        directBonus: 15,
        indirectBonus: 32,
        groupsRequired: 10,
        timeRequired: "3 meses"
      },
      estrela: {
        label: "Estrela",
        color: "bg-blue-500 text-white",
        directBonus: 15,
        indirectBonus: 34,
        groupsRequired: 20,
        timeRequired: "3 meses"
      },
      bronze: {
        label: "Bronze",
        color: "bg-amber-700 text-white",
        directBonus: 15,
        indirectBonus: 36,
        groupsRequired: 40,
        timeRequired: "3 meses"
      },
      prata: {
        label: "Prata",
        color: "bg-gray-400 text-black",
        directBonus: 15,
        indirectBonus: 38,
        groupsRequired: 80,
        timeRequired: "3 meses"
      },
      ouro: {
        label: "Ouro",
        color: "bg-yellow-500 text-black",
        directBonus: 15,
        indirectBonus: 40,
        groupsRequired: 160,
        timeRequired: "Vitalício"
      }
    };

    const current = graduations[partner.graduation] || graduations.cliente_iniciante;

    return (
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-500" />
            Sua Graduação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Badge className={`${current.color} text-lg px-4 py-2`}>
              {current.label}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Bônus Desempenho 1</p>
              <p className="text-white font-bold text-xl">{current.directBonus}%</p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Bônus Desempenho 2</p>
              <p className="text-white font-bold text-xl">{current.indirectBonus}%</p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Desempenho Necessário</p>
              <p className="text-white font-bold text-xl">{current.groupsRequired}</p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Tempo na Graduação</p>
              <p className="text-white font-bold text-xl">{current.timeRequired}</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-orange-500/10 rounded-lg">
            <p className="text-gray-400 text-sm">Seu progresso</p>
            <div className="flex items-center gap-2 mt-2">
              <Users className="w-4 h-4 text-orange-500" />
              <span className="text-white">{partner.groups_formed || 0} / {current.groupsRequired} desempenho</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((partner.groups_formed || 0) / current.groupsRequired) * 100)}%` }}
              />
            </div>
          </div>

          {/* Informações de Saque */}
          <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <p className="text-orange-500 font-semibold mb-2">Informações de Pagamento</p>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Os depósitos serão feitos automaticamente toda segunda-feira das 00:00 às 06:00</li>
              <li>• Qualquer valor disponível será depositado automaticamente</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const creditedTransactions = transactions.filter(t => t.status === "credited");
  const blockedTransactions = transactions.filter(t => t.status === "blocked");
  const pendingTransactions = transactions.filter(t => t.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Meus Bônus</h1>
        <p className="text-gray-400">Acompanhe seus ganhos e graduação</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Gerado</p>
                <p className="text-2xl font-bold text-orange-500">{formatNumber(partner?.total_bonus_generated)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Para Saque</p>
                <p className="text-2xl font-bold text-green-500">{formatNumber(partner?.bonus_for_withdrawal)}</p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Para Compras</p>
                <p className="text-2xl font-bold text-purple-500">{formatNumber(partner?.bonus_for_purchases)}</p>
              </div>
              <ArrowDownRight className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Sacado</p>
                <p className="text-2xl font-bold text-blue-500">{formatNumber(partner?.total_withdrawn)}</p>
              </div>
              <Award className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graduation Info */}
      <GraduationInfo />

      {/* Transactions */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="all" className="data-[state=active]:bg-orange-500">
            Todos ({transactions.length})
          </TabsTrigger>
          <TabsTrigger value="credited" className="data-[state=active]:bg-orange-500">
            Creditados ({creditedTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="blocked" className="data-[state=active]:bg-orange-500">
            Retidos por Status Pendente ({blockedTransactions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <TransactionList transactions={transactions} formatCurrency={formatCurrency} formatNumber={formatNumber} />
        </TabsContent>

        <TabsContent value="credited">
          <TransactionList transactions={creditedTransactions} formatCurrency={formatCurrency} formatNumber={formatNumber} />
        </TabsContent>

        <TabsContent value="blocked">
          <TransactionList transactions={blockedTransactions} formatCurrency={formatCurrency} formatNumber={formatNumber} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TransactionList({ transactions, formatCurrency, formatNumber }) {
  if (transactions.length === 0) {
    return (
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardContent className="p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma transação encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <Card key={tx.id} className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className={tx.type === 'direct' ? 'bg-blue-500/20 text-blue-500' : 'bg-purple-500/20 text-purple-500'}>
                    {tx.type === 'direct' ? 'Bônus Desempenho 1' : 'Bônus Desempenho 2'}
                  </Badge>
                  <Badge className={
                    tx.status === 'credited' ? 'bg-green-500/20 text-green-500' :
                    tx.status === 'blocked' ? 'bg-red-500/20 text-red-500' :
                    'bg-yellow-500/20 text-yellow-500'
                  }>
                    {tx.status === 'credited' ? 'Creditado' : tx.status === 'blocked' ? 'Retido' : 'Pendente'}
                  </Badge>
                </div>
                <p className="text-white mt-2">Compra de: {tx.source_partner_name}</p>
                <p className="text-gray-500 text-sm">
                  {new Date(tx.created_date).toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">{formatNumber(tx.total_amount)}</p>
                <p className="text-gray-500 text-sm">
                  Saque: {formatNumber(tx.amount_for_withdrawal)} | Compras: {formatNumber(tx.amount_for_purchases)}
                </p>
                <p className="text-gray-400 text-xs">{tx.percentage}% da compra</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}