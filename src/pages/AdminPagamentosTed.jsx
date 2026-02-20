import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS_INFO = {
  aguardando_ted: { label: "Aguardando TED", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  confirmado: { label: "Confirmado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" }
};

export default function AdminPagamentosTed() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagamentos, setPagamentos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      if (u?.role !== "admin") { setLoading(false); return; }
      setUser(u);
      const data = await base44.entities.PagamentosTED.list("-created_date", 200);
      setPagamentos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const confirmar = async (id) => {
    setConfirmandoId(id);
    try {
      await base44.entities.PagamentosTED.update(id, {
        status: "confirmado",
        dataConfirmacao: new Date().toISOString()
      });
      toast.success("Pagamento confirmado!");
      loadData();
    } catch (e) {
      toast.error("Erro ao confirmar");
    } finally {
      setConfirmandoId(null);
    }
  };

  const cancelar = async (id) => {
    await base44.entities.PagamentosTED.update(id, { status: "cancelado" });
    toast.success("Pagamento cancelado");
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px] text-center">
      <div><XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-white font-semibold">Acesso restrito a administradores.</p></div>
    </div>
  );

  const filtrados = filtroStatus === "todos"
    ? pagamentos
    : pagamentos.filter(p => p.status === filtroStatus);

  const totalConfirmado = pagamentos.filter(p => p.status === "confirmado").reduce((a, p) => a + (p.valor || 0), 0);
  const totalAguardando = pagamentos.filter(p => p.status === "aguardando_ted").reduce((a, p) => a + (p.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Pagamentos via TED</h1>
        <p className="text-gray-400">Confirmação e gestão de TEDs recebidos</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg"><Loader2 className="w-6 h-6 text-yellow-400" /></div>
            <div><p className="text-gray-400 text-sm">Aguardando</p><p className="text-white text-xl font-bold">{formatCurrency(totalAguardando)}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg"><CheckCircle2 className="w-6 h-6 text-green-400" /></div>
            <div><p className="text-gray-400 text-sm">Confirmado</p><p className="text-white text-xl font-bold">{formatCurrency(totalConfirmado)}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg"><FileText className="w-6 h-6 text-orange-400" /></div>
            <div><p className="text-gray-400 text-sm">Total Registros</p><p className="text-white text-xl font-bold">{pagamentos.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-white">Lista de Pagamentos TED</CardTitle>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aguardando_ted">Aguardando TED</SelectItem>
              <SelectItem value="confirmado">Confirmados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum pagamento encontrado.</p>
          ) : (
            <div className="space-y-3">
              {filtrados.map(p => {
                const st = STATUS_INFO[p.status] || STATUS_INFO.aguardando_ted;
                return (
                  <div key={p.id} className="p-4 bg-zinc-900 rounded-lg space-y-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-mono font-semibold">{p.identificadorPagamento}</p>
                          <Badge className={st.color}>{st.label}</Badge>
                        </div>
                        <p className="text-orange-400 font-bold text-lg">{formatCurrency(p.valor)}</p>
                        <p className="text-gray-500 text-xs">{p.usuarioNome} — {p.usuarioEmail}</p>
                        {p.dataConfirmacao && (
                          <p className="text-green-400 text-xs">Confirmado em: {new Date(p.dataConfirmacao).toLocaleString("pt-BR")}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {p.comprovanteUrl && (
                          <Button size="sm" variant="outline" onClick={() => setPreviewUrl(p.comprovanteUrl)}
                            className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs">
                            <Eye className="w-3 h-3 mr-1" /> Ver Comprovante
                          </Button>
                        )}
                        {p.status === "aguardando_ted" && (
                          <>
                            <Button size="sm" onClick={() => confirmar(p.id)} disabled={confirmandoId === p.id}
                              className="bg-green-600 hover:bg-green-700 text-xs">
                              {confirmandoId === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                              Confirmar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => cancelar(p.id)}
                              className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs">
                              Cancelar
                            </Button>
                          </>
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

      {/* Preview comprovante */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Comprovante de TED</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="mt-2">
              {previewUrl.endsWith(".pdf") ? (
                <iframe src={previewUrl} className="w-full h-[500px] rounded" title="Comprovante PDF" />
              ) : (
                <img src={previewUrl} alt="Comprovante" className="w-full rounded object-contain max-h-[500px]" />
              )}
              <a href={previewUrl} target="_blank" rel="noreferrer"
                className="mt-3 flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm justify-center">
                <Eye className="w-4 h-4" /> Abrir em nova aba
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}