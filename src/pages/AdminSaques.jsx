import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const STATUS_CONFIG = {
  PENDENTE: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  PAGO:     { label: "Pago",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
  RECUSADO: { label: "Recusado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function AdminSaques() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saques, setSaques] = useState([]);
  const [filtro, setFiltro] = useState("PENDENTE");
  const [processando, setProcessando] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      if (u?.role !== "admin") { setLoading(false); return; }
      setUser(u);
      const data = await base44.entities.Saques.list("-created_date", 200);
      setSaques(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const aprovar = async (saque) => {
    if (!window.confirm(`Confirmar pagamento de ${formatCurrency(saque.valor)} para ${saque.userName}?`)) return;
    setProcessando(saque.id);
    try {
      // Buscar parceiro para verificar e debitar saldo
      const parceiros = await base44.entities.Partner.filter({ id: saque.userId });
      if (!parceiros.length) { toast.error("Parceiro não encontrado"); return; }
      const p = parceiros[0];

      const saldoAtual = p.bonus_for_withdrawal || 0;
      if (saldoAtual < saque.valor) {
        toast.error(`Saldo insuficiente: ${formatCurrency(saldoAtual)} disponível`);
        return;
      }

      // Debitar saldo
      await base44.entities.Partner.update(saque.userId, {
        bonus_for_withdrawal: saldoAtual - saque.valor,
        total_withdrawn: (p.total_withdrawn || 0) + saque.valor
      });

      // Atualizar saque
      await base44.entities.Saques.update(saque.id, {
        status: "PAGO",
        dataPagamento: new Date().toISOString(),
        observacao: `Aprovado por ${user.email}`
      });

      // Registrar log
      await base44.entities.LogsFinanceiro.create({
        tipo: "SAQUE",
        userId: saque.userId,
        userEmail: saque.userEmail,
        userName: saque.userName,
        valor: saque.valor,
        descricao: `Saque pago via PIX: ${saque.pixKey}`,
        referenciaId: saque.id,
        adminEmail: user.email
      });

      toast.success("Saque marcado como PAGO e saldo debitado!");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar aprovação");
    } finally {
      setProcessando(null);
    }
  };

  const recusar = async (saque) => {
    const motivo = window.prompt("Motivo da recusa (opcional):");
    if (motivo === null) return; // cancelou
    setProcessando(saque.id);
    try {
      await base44.entities.Saques.update(saque.id, {
        status: "RECUSADO",
        observacao: motivo || `Recusado por ${user.email}`
      });

      await base44.entities.LogsFinanceiro.create({
        tipo: "SAQUE",
        userId: saque.userId,
        userEmail: saque.userEmail,
        userName: saque.userName,
        valor: saque.valor,
        descricao: `Saque RECUSADO. Motivo: ${motivo || "não informado"}`,
        referenciaId: saque.id,
        adminEmail: user.email
      });

      toast.success("Saque recusado.");
      loadData();
    } catch (e) {
      toast.error("Erro ao recusar saque");
    } finally {
      setProcessando(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px] text-center">
      <div><XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-white font-semibold">Acesso restrito a administradores.</p></div>
    </div>
  );

  const filtrados = filtro === "todos" ? saques : saques.filter(s => s.status === filtro);
  const totalPendente = saques.filter(s => s.status === "PENDENTE").reduce((a, s) => a + (s.valor || 0), 0);
  const totalPago = saques.filter(s => s.status === "PAGO").reduce((a, s) => a + (s.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin: Saques</h1>
          <p className="text-gray-400">Gerencie e processe solicitações de saque</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-zinc-700 text-gray-400 hover:text-white w-fit">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg"><Clock className="w-6 h-6 text-yellow-400" /></div>
            <div>
              <p className="text-gray-400 text-sm">Pendentes</p>
              <p className="text-white text-xl font-bold">{formatCurrency(totalPendente)}</p>
              <p className="text-gray-500 text-xs">{saques.filter(s => s.status === "PENDENTE").length} solicitações</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg"><CheckCircle2 className="w-6 h-6 text-green-400" /></div>
            <div>
              <p className="text-gray-400 text-sm">Total Pago</p>
              <p className="text-white text-xl font-bold">{formatCurrency(totalPago)}</p>
              <p className="text-gray-500 text-xs">{saques.filter(s => s.status === "PAGO").length} saques</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg"><ArrowDownCircle className="w-6 h-6 text-orange-400" /></div>
            <div>
              <p className="text-gray-400 text-sm">Total Solicitações</p>
              <p className="text-white text-xl font-bold">{saques.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-white">Solicitações de Saque</CardTitle>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
              <SelectItem value="RECUSADO">Recusado</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum saque encontrado.</p>
          ) : (
            <div className="space-y-3">
              {filtrados.map(s => {
                const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDENTE;
                const isProcessando = processando === s.id;
                return (
                  <div key={s.id} className="p-4 bg-zinc-900 rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={st.color}>{st.label}</Badge>
                          <span className="text-white font-semibold">{s.userName}</span>
                        </div>
                        <p className="text-gray-400 text-sm">{s.userEmail}</p>
                        <p className="text-orange-400 font-bold text-lg">{formatCurrency(s.valor)}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          <span>PIX: <span className="text-gray-300 font-mono">{s.pixKey || "—"}</span></span>
                          <span>Solicitado: <span className="text-gray-300">{formatDateTime(s.dataSolicitacao)}</span></span>
                          {s.dataPagamento && <span>Pago: <span className="text-green-400">{formatDateTime(s.dataPagamento)}</span></span>}
                        </div>
                        {s.observacao && <p className="text-gray-500 text-xs italic">{s.observacao}</p>}
                      </div>
                      {s.status === "PENDENTE" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => aprovar(s)}
                            disabled={isProcessando}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isProcessando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                            Pagar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => recusar(s)}
                            disabled={isProcessando}
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Recusar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}