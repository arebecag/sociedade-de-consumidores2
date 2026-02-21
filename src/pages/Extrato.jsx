import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, ShoppingBag, CreditCard, FileText, DollarSign, GraduationCap } from "lucide-react";

export default function Extrato() {
  const [partner, setPartner] = useState(null);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cursosLogs, setCursosLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        const p = partners[0];
        setPartner(p);
        
        // Load all transactions
        const [bonus, withdrawal, purchase, cursosCompras] = await Promise.all([
          base44.entities.BonusTransaction.filter({ partner_id: p.id }),
          base44.entities.Withdrawal.filter({ partner_id: p.id }),
          base44.entities.Purchase.filter({ partner_id: p.id }),
          base44.entities.ComprasCursosEAD.filter({ usuarioId: p.id })
        ]);
        
        setBonusTransactions(bonus.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setWithdrawals(withdrawal.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setPurchases(purchase.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setCursosLogs(cursosCompras.filter(c => c.status === 'LIBERADO').sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Extrato e Movimentações</h1>
        <p className="text-gray-400">Acompanhe todas as suas transações financeiras</p>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Bônus Total Gerado</p>
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
                <p className="text-gray-400 text-sm">Disponível para Saque</p>
                <p className="text-2xl font-bold text-green-500">{formatNumber(partner?.bonus_for_withdrawal)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Disponível para Compras</p>
                <p className="text-2xl font-bold text-purple-500">{formatNumber(partner?.bonus_for_purchases)}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-purple-500" />
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
              <CreditCard className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Tabs defaultValue="bonus" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="bonus" className="data-[state=active]:bg-orange-500">
            <TrendingUp className="w-4 h-4 mr-2" />
            Bônus ({bonusTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="data-[state=active]:bg-orange-500">
            <CreditCard className="w-4 h-4 mr-2" />
            Saques ({withdrawals.length})
          </TabsTrigger>
          <TabsTrigger value="purchases" className="data-[state=active]:bg-orange-500">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Compras ({purchases.length})
          </TabsTrigger>
          <TabsTrigger value="cursos" className="data-[state=active]:bg-orange-500">
            <GraduationCap className="w-4 h-4 mr-2" />
            Cursos EAD ({cursosLogs.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-orange-500">
            <FileText className="w-4 h-4 mr-2" />
            Todas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bonus">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Histórico de Bônus</CardTitle>
            </CardHeader>
            <CardContent>
              {bonusTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma transação de bônus ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bonusTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                      <div className="flex items-center gap-4">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-white font-medium">
                            Bônus {transaction.type === 'direct' ? 'Direto' : 'Indireto'} ({transaction.percentage}%)
                          </p>
                          <p className="text-gray-400 text-sm">
                            De: {transaction.source_partner_name}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(transaction.created_date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-500 font-bold">{formatNumber(transaction.total_amount)}</p>
                        <Badge className={
                          transaction.status === 'credited' ? 'bg-green-500/20 text-green-500' :
                          transaction.status === 'blocked' ? 'bg-red-500/20 text-red-500' :
                          'bg-yellow-500/20 text-yellow-500'
                        }>
                          {transaction.status === 'credited' ? 'Creditado' :
                           transaction.status === 'blocked' ? 'Bloqueado' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Histórico de Saques</CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum saque realizado ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                      <div className="flex items-center gap-4">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-white font-medium">Saque via PIX</p>
                          <p className="text-gray-400 text-sm">
                            Chave: {withdrawal.pix_key?.substring(0, 20)}...
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(withdrawal.created_date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-red-500 font-bold">-{formatCurrency(withdrawal.amount)}</p>
                        <Badge className={
                          withdrawal.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                          withdrawal.status === 'cancelled' ? 'bg-red-500/20 text-red-500' :
                          'bg-yellow-500/20 text-yellow-500'
                        }>
                          {withdrawal.status === 'completed' ? 'Concluído' :
                           withdrawal.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Histórico de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma compra realizada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div key={purchase.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                      <div className="flex items-center gap-4">
                        <ShoppingBag className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="text-white font-medium">{purchase.product_name}</p>
                          <p className="text-gray-400 text-sm">
                            Pagamento: {purchase.payment_method === 'bonus' ? 'Bônus' :
                                       purchase.payment_method === 'boleto' ? 'Boleto' : 'Misto'}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(purchase.created_date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-500 font-bold">{formatCurrency(purchase.amount)}</p>
                        <Badge className={
                          purchase.status === 'paid' ? 'bg-green-500/20 text-green-500' :
                          purchase.status === 'cancelled' ? 'bg-red-500/20 text-red-500' :
                          'bg-yellow-500/20 text-yellow-500'
                        }>
                          {purchase.status === 'paid' ? 'Pago' :
                           purchase.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cursos">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Cursos Adquiridos com Bônus</CardTitle>
            </CardHeader>
            <CardContent>
              {cursosLogs.length === 0 ? (
                <div className="text-center py-12">
                  <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum curso adquirido ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cursosLogs.map((compra) => (
                    <div key={compra.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                      <div className="flex items-center gap-4">
                        <GraduationCap className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-white font-medium">{compra.cursoNome}</p>
                          <p className="text-gray-400 text-xs">BONUS_USADO_CURSO — ID: {compra.id?.slice(0, 8)}...</p>
                          <p className="text-gray-500 text-xs">{new Date(compra.created_date).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-bold">-{formatNumber(compra.valorBonus)}</p>
                        <span className="text-xs text-green-400 font-medium">Liberado</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Todas as Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              {bonusTransactions.length === 0 && withdrawals.length === 0 && purchases.length === 0 && cursosLogs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma movimentação ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    ...bonusTransactions.map(t => ({ ...t, txType: 'bonus' })),
                    ...withdrawals.map(t => ({ ...t, txType: 'withdrawal' })),
                    ...purchases.map(t => ({ ...t, txType: 'purchase' })),
                    ...cursosLogs.map(t => ({ ...t, txType: 'curso' }))
                  ]
                    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                    .map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                        <div className="flex items-center gap-4">
                          {transaction.txType === 'bonus' && <TrendingUp className="w-5 h-5 text-green-500" />}
                          {transaction.txType === 'withdrawal' && <TrendingDown className="w-5 h-5 text-red-500" />}
                          {transaction.txType === 'purchase' && <ShoppingBag className="w-5 h-5 text-purple-500" />}
                          {transaction.txType === 'curso' && <GraduationCap className="w-5 h-5 text-blue-400" />}
                          <div>
                            <p className="text-white font-medium">
                              {transaction.txType === 'bonus' && `Bônus ${transaction.type === 'direct' ? 'Direto' : 'Indireto'}`}
                              {transaction.txType === 'withdrawal' && 'Saque via PIX'}
                              {transaction.txType === 'purchase' && transaction.product_name}
                              {transaction.txType === 'curso' && `Curso: ${transaction.cursoNome}`}
                            </p>
                            <p className="text-gray-500 text-xs">
                              {new Date(transaction.created_date).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            transaction.txType === 'bonus' ? 'text-green-500' :
                            transaction.txType === 'withdrawal' ? 'text-red-500' :
                            transaction.txType === 'curso' ? 'text-orange-400' :
                            'text-purple-500'
                          }`}>
                            {transaction.txType === 'bonus' && `+${formatNumber(transaction.total_amount)}`}
                            {transaction.txType === 'withdrawal' && `-${formatCurrency(transaction.amount)}`}
                            {transaction.txType === 'purchase' && formatCurrency(transaction.amount)}
                            {transaction.txType === 'curso' && `-${formatNumber(transaction.valorBonus)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}