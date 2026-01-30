import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, AlertTriangle, CheckCircle, Clock, XCircle, Banknote } from "lucide-react";
import { toast } from "sonner";

export default function Withdrawals() {
  const [partner, setPartner] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        setPartner(partners[0]);
        
        const userWithdrawals = await base44.entities.Withdrawal.filter({ partner_id: partners[0].id });
        setWithdrawals(userWithdrawals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    
    if (!withdrawAmount || withdrawAmount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    
    if (withdrawAmount > (partner?.bonus_for_withdrawal || 0)) {
      toast.error("Valor maior que o saldo disponível");
      return;
    }

    if (!partner?.pix_key) {
      toast.error("Configure sua chave PIX no perfil");
      return;
    }

    setProcessing(true);
    try {
      // Create withdrawal request
      await base44.entities.Withdrawal.create({
        partner_id: partner.id,
        partner_name: partner.full_name,
        amount: withdrawAmount,
        pix_key: partner.pix_key,
        status: "pending"
      });

      // Update partner balance
      await base44.entities.Partner.update(partner.id, {
        bonus_for_withdrawal: (partner.bonus_for_withdrawal || 0) - withdrawAmount
      });

      toast.success("Solicitação de saque enviada!");
      setWithdrawDialogOpen(false);
      setAmount("");
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao solicitar saque");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const StatusBadge = ({ status }) => {
    const config = {
      pending: { icon: Clock, color: "bg-yellow-500/20 text-yellow-500", label: "Pendente" },
      completed: { icon: CheckCircle, color: "bg-green-500/20 text-green-500", label: "Depositado" },
      cancelled: { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "Cancelado" }
    };
    
    const { icon: Icon, color, label } = config[status] || config.pending;
    
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const isBlocked = partner?.status === 'pendente';
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
  const totalPending = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
  const totalCompleted = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Saques</h1>
          <p className="text-gray-400">Solicite o saque dos seus bônus</p>
        </div>
        
        <Button
          onClick={() => setWithdrawDialogOpen(true)}
          disabled={isBlocked || !partner?.bonus_for_withdrawal}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Banknote className="w-4 h-4 mr-2" />
          Solicitar Saque
        </Button>
      </div>

      {/* Block Alert */}
      {isBlocked && (
        <Alert className="bg-red-500/10 border-red-500/30">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-200">
            <strong>Saques bloqueados.</strong> Resolva as pendências do seu cadastro para desbloquear.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Disponível para Saque</p>
                <p className="text-2xl font-bold text-orange-500">{formatCurrency(partner?.bonus_for_withdrawal)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-yellow-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Saques Pendentes</p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(totalPending)}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Sacado</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(totalCompleted)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-700">
          <CardContent className="p-6">
            <div>
              <p className="text-gray-400 text-sm">Chave PIX</p>
              <p className="text-white font-medium mt-1 truncate">
                {partner?.pix_key || "Não configurada"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {partner?.pix_key_type?.toUpperCase() || "Configure no perfil"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PIX Warning */}
      {!partner?.pix_key && (
        <Alert className="bg-yellow-500/10 border-yellow-500/30">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            Configure sua chave PIX no <strong>Perfil</strong> para poder solicitar saques.
          </AlertDescription>
        </Alert>
      )}

      {/* Withdrawals List */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white">Histórico de Saques</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Você ainda não fez nenhum saque.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="p-4 bg-zinc-900 rounded-lg">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <StatusBadge status={withdrawal.status} />
                      <p className="text-gray-500 text-sm mt-2">
                        Solicitado em: {new Date(withdrawal.created_date).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                      {withdrawal.completed_date && (
                        <p className="text-green-500 text-sm">
                          Depositado em: {new Date(withdrawal.completed_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      <p className="text-gray-400 text-xs mt-1">
                        PIX: {withdrawal.pix_key}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{formatCurrency(withdrawal.amount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20">
          <DialogHeader>
            <DialogTitle className="text-white">Solicitar Saque</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Saldo Disponível</p>
              <p className="text-2xl font-bold text-orange-500">{formatCurrency(partner?.bonus_for_withdrawal)}</p>
            </div>

            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Chave PIX</p>
              <p className="text-white font-medium">{partner?.pix_key}</p>
              <p className="text-gray-500 text-xs">{partner?.pix_key_type?.toUpperCase()}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Valor do Saque</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={partner?.bonus_for_withdrawal || 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white"
                placeholder="0,00"
              />
              <Button
                type="button"
                variant="link"
                className="text-orange-500 p-0 h-auto"
                onClick={() => setAmount(partner?.bonus_for_withdrawal?.toString() || "0")}
              >
                Sacar tudo
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={processing || !amount}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
              {processing ? "Processando..." : "Confirmar Saque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}