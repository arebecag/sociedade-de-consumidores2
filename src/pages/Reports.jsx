import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Users, ShoppingBag, TrendingUp, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Reports() {
  const [partner, setPartner] = useState(null);
  const [clients, setClients] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
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
        
        // Get all partners for network lookup
        const allPartners = await base44.entities.Partner.list();
        
        // Get network relations
        const relations = await base44.entities.NetworkRelation.filter({ referrer_id: p.id });
        const clientIds = relations.map(r => r.referred_id);
        const myClients = allPartners.filter(partner => clientIds.includes(partner.id));
        setClients(myClients);
        
        // Get purchases (mine and my clients)
        const allIds = [p.id, ...clientIds];
        const allPurchases = await base44.entities.Purchase.list();
        const relevantPurchases = allPurchases.filter(purchase => allIds.includes(purchase.partner_id));
        setPurchases(relevantPurchases);
        
        // Get bonus transactions
        const bonus = await base44.entities.BonusTransaction.filter({ partner_id: p.id });
        setBonusTransactions(bonus);
        
        // Get withdrawals
        const userWithdrawals = await base44.entities.Withdrawal.filter({ partner_id: p.id });
        setWithdrawals(userWithdrawals);
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

  const downloadPDF = (reportType) => {
    // In a real implementation, this would generate and download a PDF
    toast.info("Funcionalidade de download em desenvolvimento");
  };

  const StatusBadge = ({ status, reasons }) => {
    if (status === 'ativo') {
      return <Badge className="bg-green-500/20 text-green-500">ATIVO</Badge>;
    }
    if (status === 'pendente') {
      return (
        <div>
          <Badge className="bg-yellow-500/20 text-yellow-500">PENDENTE</Badge>
          {reasons && reasons.length > 0 && (
            <p className="text-yellow-500 text-xs mt-1">{reasons[0]}</p>
          )}
        </div>
      );
    }
    return <Badge className="bg-red-500/20 text-red-500">EXCLUÍDO</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const totalBonusGenerated = bonusTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalBonusPaid = bonusTransactions.filter(t => t.status === 'credited').reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalBonusPending = bonusTransactions.filter(t => t.status !== 'credited').reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalDeposits = withdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + (w.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Relatórios</h1>
          <p className="text-gray-400">Visualize e baixe seus relatórios</p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-orange-500/20 flex-wrap h-auto p-1">
          <TabsTrigger value="clients" className="data-[state=active]:bg-orange-500">
            <Users className="w-4 h-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="purchases" className="data-[state=active]:bg-orange-500">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Compras
          </TabsTrigger>
          <TabsTrigger value="bonus" className="data-[state=active]:bg-orange-500">
            <TrendingUp className="w-4 h-4 mr-2" />
            Bônus
          </TabsTrigger>
          <TabsTrigger value="deposits" className="data-[state=active]:bg-orange-500">
            <CreditCard className="w-4 h-4 mr-2" />
            Depósitos
          </TabsTrigger>
        </TabsList>

        {/* Clients Report */}
        <TabsContent value="clients">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Relatório de Clientes Cadastrados</CardTitle>
              <Button onClick={() => downloadPDF('clients')} variant="outline" className="border-orange-500 text-orange-500">
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum cliente cadastrado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-gray-400">Nome</TableHead>
                        <TableHead className="text-gray-400">Data de Cadastro</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id} className="border-zinc-800">
                          <TableCell className="text-white">{client.full_name}</TableCell>
                          <TableCell className="text-gray-400">
                            {new Date(client.created_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={client.status} reasons={client.pending_reasons} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchases Report */}
        <TabsContent value="purchases">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Relatório de Compras</CardTitle>
              <Button onClick={() => downloadPDF('purchases')} variant="outline" className="border-orange-500 text-orange-500">
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma compra encontrada.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-gray-400">Produto</TableHead>
                        <TableHead className="text-gray-400">Comprador</TableHead>
                        <TableHead className="text-gray-400">Valor</TableHead>
                        <TableHead className="text-gray-400">Bônus Recebido</TableHead>
                        <TableHead className="text-gray-400">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => {
                        const bonusForPurchase = bonusTransactions.find(t => t.purchase_id === purchase.id);
                        return (
                          <TableRow key={purchase.id} className="border-zinc-800">
                            <TableCell className="text-white">{purchase.product_name}</TableCell>
                            <TableCell className="text-gray-400">{purchase.partner_name}</TableCell>
                            <TableCell className="text-white">{formatCurrency(purchase.amount)}</TableCell>
                            <TableCell className="text-orange-500">
                              {bonusForPurchase ? formatCurrency(bonusForPurchase.total_amount) : '-'}
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {new Date(purchase.created_date).toLocaleDateString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonus Report */}
        <TabsContent value="bonus">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-zinc-950 border-orange-500/20">
                <CardContent className="p-6">
                  <p className="text-gray-400 text-sm">Total Gerado</p>
                  <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalBonusGenerated)}</p>
                </CardContent>
              </Card>
              <Card className="bg-zinc-950 border-green-500/20">
                <CardContent className="p-6">
                  <p className="text-gray-400 text-sm">Total Pago</p>
                  <p className="text-2xl font-bold text-green-500">{formatCurrency(totalBonusPaid)}</p>
                </CardContent>
              </Card>
              <Card className="bg-zinc-950 border-yellow-500/20">
                <CardContent className="p-6">
                  <p className="text-gray-400 text-sm">A Receber</p>
                  <p className="text-2xl font-bold text-yellow-500">{formatCurrency(totalBonusPending)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-zinc-950 border-orange-500/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Relatório de Bônus</CardTitle>
                <Button onClick={() => downloadPDF('bonus')} variant="outline" className="border-orange-500 text-orange-500">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
              </CardHeader>
              <CardContent>
                {bonusTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Nenhum bônus registrado.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-gray-400">Origem</TableHead>
                          <TableHead className="text-gray-400">Tipo</TableHead>
                          <TableHead className="text-gray-400">Valor</TableHead>
                          <TableHead className="text-gray-400">Status</TableHead>
                          <TableHead className="text-gray-400">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bonusTransactions.map((tx) => (
                          <TableRow key={tx.id} className="border-zinc-800">
                            <TableCell className="text-white">{tx.source_partner_name}</TableCell>
                            <TableCell>
                              <Badge className={tx.type === 'direct' ? 'bg-blue-500/20 text-blue-500' : 'bg-purple-500/20 text-purple-500'}>
                                {tx.type === 'direct' ? 'Direto' : 'Indireto'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-orange-500">{formatCurrency(tx.total_amount)}</TableCell>
                            <TableCell>
                              <Badge className={
                                tx.status === 'credited' ? 'bg-green-500/20 text-green-500' :
                                tx.status === 'blocked' ? 'bg-red-500/20 text-red-500' :
                                'bg-yellow-500/20 text-yellow-500'
                              }>
                                {tx.status === 'credited' ? 'Creditado' : tx.status === 'blocked' ? 'Bloqueado' : 'Pendente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {new Date(tx.created_date).toLocaleDateString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deposits Report */}
        <TabsContent value="deposits">
          <div className="space-y-6">
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-6">
                <p className="text-gray-400 text-sm">Total Depositado</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(totalDeposits)}</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-orange-500/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Relatório de Depósitos</CardTitle>
                <Button onClick={() => downloadPDF('deposits')} variant="outline" className="border-orange-500 text-orange-500">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Nenhum depósito registrado.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-gray-400">Valor</TableHead>
                          <TableHead className="text-gray-400">Status</TableHead>
                          <TableHead className="text-gray-400">Data Solicitação</TableHead>
                          <TableHead className="text-gray-400">Data Pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((withdrawal) => (
                          <TableRow key={withdrawal.id} className="border-zinc-800">
                            <TableCell className="text-white font-semibold">{formatCurrency(withdrawal.amount)}</TableCell>
                            <TableCell>
                              <Badge className={
                                withdrawal.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                withdrawal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                'bg-red-500/20 text-red-500'
                              }>
                                {withdrawal.status === 'completed' ? 'Depositado' : withdrawal.status === 'pending' ? 'Pendente' : 'Cancelado'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {new Date(withdrawal.created_date).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {withdrawal.completed_date ? new Date(withdrawal.completed_date).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}