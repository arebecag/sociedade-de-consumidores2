import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function AdminPagamentos() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagamentos, setPagamentos] = useState([]);
  const [filtroSemana, setFiltroSemana] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      if (u?.role !== "admin") { setLoading(false); return; }
      setUser(u);
      const pags = await base44.entities.PagamentosEquipe.list("-dataPagamento", 100);
      setPagamentos(pags);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const marcarPago = async (id) => {
    await base44.entities.PagamentosEquipe.update(id, { status: "pago" });
    toast.success("Marcado como pago!");
    loadData();
  };

  const gerarManual = async () => {
    const hoje = new Date();
    const semana = hoje.toISOString().split("T")[0];
    await base44.entities.PagamentosEquipe.create({
      valor: 350,
      dataPagamento: semana,
      semanaReferencia: semana,
      status: "pendente",
      usuarioNome: "Equipe"
    });
    toast.success("Pagamento gerado!");
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px] text-center">
      <div><XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-white font-semibold">Acesso restrito a administradores.</p></div>
    </div>
  );

  const filtrados = filtroSemana
    ? pagamentos.filter(p => p.semanaReferencia?.includes(filtroSemana))
    : pagamentos;

  const totalPago = filtrados.filter(p => p.status === "pago").reduce((acc, p) => acc + (p.valor || 0), 0);
  const totalPendente = filtrados.filter(p => p.status === "pendente").reduce((acc, p) => acc + (p.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Pagamentos da Equipe</h1>
        <p className="text-gray-400">Gestão de pagamentos semanais</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg"><CheckCircle2 className="w-6 h-6 text-green-400" /></div>
            <div><p className="text-gray-400 text-sm">Total Pago</p><p className="text-white text-xl font-bold">{formatCurrency(totalPago)}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg"><Clock className="w-6 h-6 text-yellow-400" /></div>
            <div><p className="text-gray-400 text-sm">Total Pendente</p><p className="text-white text-xl font-bold">{formatCurrency(totalPendente)}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg"><DollarSign className="w-6 h-6 text-orange-400" /></div>
            <div><p className="text-gray-400 text-sm">Total Registros</p><p className="text-white text-xl font-bold">{filtrados.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-white">Lista de Pagamentos</CardTitle>
          <div className="flex gap-3 items-center">
            <Input
              placeholder="Filtrar por semana (ex: 2026-02)"
              value={filtroSemana}
              onChange={e => setFiltroSemana(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white w-60 text-sm"
            />
            <Button onClick={gerarManual} className="bg-orange-500 hover:bg-orange-600 text-sm whitespace-nowrap">
              + Gerar Manual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum pagamento encontrado.</p>
          ) : (
            <div className="space-y-3">
              {filtrados.map(p => (
                <div key={p.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Semana: {p.semanaReferencia}</p>
                    <p className="text-gray-400 text-sm">{formatCurrency(p.valor)} — {p.dataPagamento}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={p.status === "pago"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                      {p.status === "pago" ? "PAGO" : "PENDENTE"}
                    </Badge>
                    {p.status === "pendente" && (
                      <Button size="sm" onClick={() => marcarPago(p.id)} className="bg-green-600 hover:bg-green-700 text-xs">
                        Marcar Pago
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}