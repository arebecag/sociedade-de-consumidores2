import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Upload, XCircle, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS_LABELS = {
  aguardando_pagamento: { label: "Aguardando", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  pago: { label: "Pago", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" }
};

export default function AdminCora() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cobranças, setCobranças] = useState([]);
  const [showNova, setShowNova] = useState(false);
  const [novaCobranca, setNovaCobranca] = useState({ valor: "", descricao: "", dataVencimento: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      if (u?.role !== "admin") { setLoading(false); return; }
      setUser(u);
      const data = await base44.entities.PagamentosCora.list("-created_date", 100);
      setCobranças(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const criarCobranca = async () => {
    if (!novaCobranca.valor || !novaCobranca.descricao) {
      toast.error("Preencha valor e descrição");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.PagamentosCora.create({
        valor: parseFloat(novaCobranca.valor),
        descricao: novaCobranca.descricao,
        dataVencimento: novaCobranca.dataVencimento,
        status: "aguardando_pagamento",
        criadoPor: user.email,
        logTentativa: `Criado manualmente em ${new Date().toLocaleString("pt-BR")}`
      });
      toast.success("Cobrança criada!");
      setShowNova(false);
      setNovaCobranca({ valor: "", descricao: "", dataVencimento: "" });
      loadData();
    } catch (e) {
      toast.error("Erro ao criar cobrança");
    } finally {
      setSaving(false);
    }
  };

  const alterarStatus = async (id, status) => {
    await base44.entities.PagamentosCora.update(id, { status, ...(status === "pago" ? { dataPagamento: new Date().toISOString() } : {}) });
    toast.success("Status atualizado!");
    loadData();
  };

  const uploadComprovante = async (id, file) => {
    setUploadingId(id);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.PagamentosCora.update(id, { comprovanteUrl: file_url });
      toast.success("Comprovante anexado!");
      loadData();
    } catch (e) {
      toast.error("Erro ao fazer upload");
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px] text-center">
      <div><XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-white font-semibold">Acesso restrito a administradores.</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Cobranças Cora</h1>
          <p className="text-gray-400">Gestão de cobranças manuais</p>
        </div>
        <Button onClick={() => setShowNova(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" /> Nova Cobrança
        </Button>
      </div>

      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader><CardTitle className="text-white">Lista de Cobranças</CardTitle></CardHeader>
        <CardContent>
          {cobranças.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma cobrança registrada.</p>
          ) : (
            <div className="space-y-3">
              {cobranças.map(c => {
                const st = STATUS_LABELS[c.status] || STATUS_LABELS.aguardando_pagamento;
                return (
                  <div key={c.id} className="p-4 bg-zinc-900 rounded-lg space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold">{c.descricao}</p>
                        <p className="text-orange-400 font-bold">{formatCurrency(c.valor)}</p>
                        {c.dataVencimento && <p className="text-gray-500 text-xs">Vencimento: {c.dataVencimento}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={st.color}>{st.label}</Badge>

                        {c.status !== "pago" && (
                          <Button size="sm" onClick={() => alterarStatus(c.id, "pago")} className="bg-green-600 hover:bg-green-700 text-xs">
                            Marcar Pago
                          </Button>
                        )}
                        {c.status === "aguardando_pagamento" && (
                          <Button size="sm" variant="outline" onClick={() => alterarStatus(c.id, "cancelado")} className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs">
                            Cancelar
                          </Button>
                        )}

                        {/* Upload comprovante */}
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept="image/*,application/pdf"
                            onChange={e => e.target.files[0] && uploadComprovante(c.id, e.target.files[0])} />
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-600 text-gray-400 hover:text-orange-400 hover:border-orange-500/50 text-xs transition-colors">
                            {uploadingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            Comprovante
                          </span>
                        </label>

                        {c.comprovanteUrl && (
                          <a href={c.comprovanteUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs transition-colors">
                            <FileText className="w-3 h-3" /> Ver
                          </a>
                        )}
                      </div>
                    </div>
                    {c.logTentativa && (
                      <p className="text-gray-600 text-xs font-mono border-t border-zinc-800 pt-2">{c.logTentativa}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog nova cobrança */}
      <Dialog open={showNova} onOpenChange={setShowNova}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 text-white">
          <DialogHeader>
            <DialogTitle>Nova Cobrança Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={novaCobranca.descricao} onChange={e => setNovaCobranca(p => ({ ...p, descricao: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Pagamento semanal #01" />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" value={novaCobranca.valor} onChange={e => setNovaCobranca(p => ({ ...p, valor: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" placeholder="350.00" />
            </div>
            <div className="space-y-1">
              <Label>Data de Vencimento</Label>
              <Input type="date" value={novaCobranca.dataVencimento} onChange={e => setNovaCobranca(p => ({ ...p, dataVencimento: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowNova(false)} className="border-zinc-700 text-gray-400">Cancelar</Button>
              <Button onClick={criarCobranca} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar Cobrança
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}