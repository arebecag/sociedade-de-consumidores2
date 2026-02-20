import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Calendar, DollarSign, Clock, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const CONTRATO = {
  valorSemanal: 350.00,
  pagamento: "Toda segunda-feira",
  inicio: new Date("2026-02-23"),
  prazoInicial: 60,
  observacao: "Após 60 dias será renegociado valor."
};

export default function AdminContrato() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagamentos, setPagamentos] = useState([]);
  const [statusContrato, setStatusContrato] = useState("ativo");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      if (u?.role !== "admin") {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(u);
      const pags = await base44.entities.PagamentosEquipe.list("-dataPagamento", 50);
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

  const gerarPagamentoManual = async () => {
    const hoje = new Date();
    const semana = format(hoje, "yyyy-MM-dd");
    await base44.entities.PagamentosEquipe.create({
      valor: CONTRATO.valorSemanal,
      dataPagamento: semana,
      semanaReferencia: semana,
      status: "pendente",
      usuarioNome: "Equipe"
    });
    toast.success("Pagamento semanal gerado!");
    loadData();
  };

  const renovacaoDate = addDays(CONTRATO.inicio, CONTRATO.prazoInicial);
  const hoje = new Date();
  const contratoAtivo = hoje < renovacaoDate;

  const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-white text-lg font-semibold">Acesso restrito</p>
        <p className="text-gray-400">Apenas administradores podem acessar esta página.</p>
      </div>
    </div>
  );

  const pendentes = pagamentos.filter(p => p.status === "pendente");
  const pagos = pagamentos.filter(p => p.status === "pago");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Contrato de Prestação</h1>
        <p className="text-gray-400">Gestão do contrato de serviços</p>
      </div>

      {/* Status geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Valor Semanal</p>
              <p className="text-white text-xl font-bold">{formatCurrency(CONTRATO.valorSemanal)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Próxima Renovação</p>
              <p className="text-white text-xl font-bold">
                {format(renovacaoDate, "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${contratoAtivo ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {contratoAtivo ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : <XCircle className="w-6 h-6 text-red-400" />}
            </div>
            <div>
              <p className="text-gray-400 text-sm">Status do Contrato</p>
              <Badge className={contratoAtivo ? "bg-green-500/20 text-green-400 border-green-500/30 mt-1" : "bg-red-500/20 text-red-400 border-red-500/30 mt-1"}>
                {contratoAtivo ? "ATIVO" : "ENCERRADO"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes do Contrato */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Detalhes do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Valor Semanal</p>
              <p className="text-white font-semibold text-lg mt-1">{formatCurrency(CONTRATO.valorSemanal)}</p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Dia de Pagamento</p>
              <p className="text-white font-semibold text-lg mt-1">{CONTRATO.pagamento}</p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Início do Contrato</p>
              <p className="text-white font-semibold text-lg mt-1">
                {format(CONTRATO.inicio, "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="p-4 bg-zinc-900 rounded-lg">
              <p className="text-gray-400 text-sm">Prazo Inicial</p>
              <p className="text-white font-semibold text-lg mt-1">{CONTRATO.prazoInicial} dias</p>
            </div>
          </div>

          <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-orange-300 text-sm">{CONTRATO.observacao}</p>
          </div>
        </CardContent>
      </Card>

      {/* Pagamentos Semanais */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Pagamentos Semanais
          </CardTitle>
          <Button onClick={gerarPagamentoManual} className="bg-orange-500 hover:bg-orange-600 text-sm">
            + Gerar Pagamento
          </Button>
        </CardHeader>
        <CardContent>
          {pagamentos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum pagamento registrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagamentos.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Semana: {p.semanaReferencia}</p>
                    <p className="text-gray-400 text-sm">{formatCurrency(p.valor)}</p>
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