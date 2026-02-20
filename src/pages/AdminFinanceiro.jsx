import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Clock, AlertTriangle, RefreshCw, XCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const STATUS_CONFIG = {
  PENDING: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  CONFIRMED: { label: "Confirmado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  RECEIVED: { label: "Recebido", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  OVERDUE: { label: "Vencido", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  CANCELLED: { label: "Cancelado", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  REFUNDED: { label: "Estornado", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" }
};

export default function AdminFinanceiro() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cobranças, setCobranças] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [rodandoPolling, setRodandoPolling] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      if (u?.role !== "admin") { setLoading(false); return; }
      setUser(u);
      const data = await base44.entities.Financeiro.list("-created_date", 200);
      setCobranças(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const rodarPolling = async () => {
    setRodandoPolling(true);
    try {
      const res = await base44.functions.invoke("asaasPollingPendentes", {});
      toast.success(`Verificadas: ${res.data?.verificadas || 0} | Confirmadas: ${res.data?.confirmadas || 0}`);
      loadData();
    } catch (e) {
      toast.error("Erro ao executar polling");
    } finally {
      setRodandoPolling(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px] text-center">
      <div><XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-white font-semibold">Acesso restrito a administradores.</p></div>
    </div>
  );

  const filtradas = filtroStatus === "todos" ? cobranças : cobranças.filter(c => c.status === filtroStatus);
  const totalConfirmado = cobranças.filter(c => ["CONFIRMED","RECEIVED"].includes(c.status)).reduce((a, c) => a + (c.valor || 0), 0);
  const totalPendente = cobranças.filter(c => c.status === "PENDING").reduce((a, c) => a + (c.valor || 0), 0);
  const totalBonus = cobranças.filter(c => c.bonusLiberado).reduce((a, c) => a + (c.valorBonus || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Financeiro (Asaas)</h1>
          <p className="text-gray-400">Cobranças integradas com a Asaas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="border-zinc-700 text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Button onClick={rodarPolling} disabled={rodandoPolling} className="bg-orange-500 hover:bg-orange-600">
            {rodandoPolling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Verificar Pendentes
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Cobranças", value: cobranças.length, icon: DollarSign, color: "orange" },
          { label: "Confirmado", value: formatCurrency(totalConfirmado), icon: CheckCircle2, color: "green" },
          { label: "Pendente", value: formatCurrency(totalPendente), icon: Clock, color: "yellow" },
          { label: "Bônus Liberado", value: formatCurrency(totalBonus), icon: AlertTriangle, color: "orange" }
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-zinc-950 border-orange-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 bg-${color}-500/10 rounded-lg`}><Icon className={`w-6 h-6 text-${color}-400`} /></div>
              <div><p className="text-gray-400 text-sm">{label}</p><p className="text-white text-xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-white">Lista de Cobranças</CardTitle>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="CONFIRMED">Confirmado</SelectItem>
              <SelectItem value="OVERDUE">Vencido</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {filtradas.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma cobrança encontrada.</p>
          ) : (
            <div className="space-y-3">
              {filtradas.map(c => {
                const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={c.id} className="p-4 bg-zinc-900 rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={st.color}>{st.label}</Badge>
                          {c.bonusLiberado && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Bônus OK</Badge>}
                        </div>
                        <p className="text-white font-semibold">{c.userName}</p>
                        <p className="text-gray-400 text-sm">{c.userEmail}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                          <span>Valor: <span className="text-orange-400 font-semibold">{formatCurrency(c.valor)}</span></span>
                          <span>Venc: <span className="text-gray-300">{c.dataVencimento}</span></span>
                          {c.dataPagamento && <span>Pago: <span className="text-green-400">{formatDate(c.dataPagamento)}</span></span>}
                          {c.valorBonus && <span>Bônus: <span className="text-orange-400">{formatCurrency(c.valorBonus)}</span></span>}
                          <span className="font-mono text-gray-600">{c.asaasPaymentId}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {c.invoiceUrl && (
                          <a href={c.invoiceUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="border-zinc-700 text-gray-400 text-xs">Ver Fatura</Button>
                          </a>
                        )}
                      </div>
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