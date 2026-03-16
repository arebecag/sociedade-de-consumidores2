import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Upload, CheckCircle2, Banknote, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PagamentoTed() {
  const { partner } = useAuthCustom();
  const [step, setStep] = useState("valor"); // valor | aguardando | enviado
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [pagamento, setPagamento] = useState(null);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [comprovanteEnviado, setComprovanteEnviado] = useState(false);
  const [meusPagamentos, setMeusPagamentos] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  useEffect(() => { 
    if (partner) loadHistorico(); 
  }, [partner]);

  const loadHistorico = async () => {
    try {
      const pags = await base44.entities.PagamentosTED.filter({ usuarioId: partner.id }, "-created_date", 10);
      setMeusPagamentos(pags);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const iniciarPagamento = async () => {
    if (!valor || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("processarPagamentoTed", { valor: parseFloat(valor) });
      setPagamento(res.data);
      setStep("aguardando");
    } catch (e) {
      toast.error("Erro ao gerar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const uploadComprovante = async (file) => {
    if (!pagamento?.pagamentoId) return;
    setUploadingComprovante(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.PagamentosTED.update(pagamento.pagamentoId, { comprovanteUrl: file_url });
      setComprovanteEnviado(true);
      toast.success("Comprovante enviado com sucesso!");
    } catch (e) {
      toast.error("Erro ao enviar comprovante");
    } finally {
      setUploadingComprovante(false);
    }
  };

  const confirmarTed = async () => {
    setStep("enviado");
    toast.success("Notificação enviada! Aguarde a confirmação do administrador.");
    loadHistorico();
  };

  const STATUS_INFO = {
    aguardando_ted: { label: "Aguardando TED", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    confirmado: { label: "Confirmado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Pagamento via TED</h1>
        <p className="text-gray-400">Realize uma transferência bancária e aguarde a confirmação</p>
      </div>

      {/* Step 1: Inserir valor */}
      {step === "valor" && (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Banknote className="w-5 h-5 text-orange-500" /> Iniciar Pagamento TED
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-gray-300">Valor do TED (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 350.00"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white text-lg"
              />
            </div>
            <Button onClick={iniciarPagamento} disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Gerar Dados para TED
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Dados bancários + upload comprovante */}
      {step === "aguardando" && pagamento && (
        <div className="space-y-4">
          {/* Identificador */}
          <Card className="bg-orange-500/10 border-orange-500/40">
            <CardContent className="p-5">
              <p className="text-orange-300 text-sm font-medium mb-1">Identificador do Pagamento</p>
              <div className="flex items-center gap-3">
                <p className="text-white text-2xl font-bold font-mono tracking-wider">{pagamento.identificadorPagamento}</p>
                <Button size="icon" variant="ghost" onClick={() => copiar(pagamento.identificadorPagamento)} className="text-orange-400 hover:text-orange-300">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-orange-400/80 text-xs mt-2">⚠️ Use este identificador na descrição/mensagem do TED</p>
            </CardContent>
          </Card>

          {/* Valor */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Valor a transferir</p>
              <p className="text-white text-3xl font-bold mt-1">{formatCurrency(pagamento.valor)}</p>
            </CardContent>
          </Card>

          {/* Dados bancários */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader><CardTitle className="text-white text-base">Dados Bancários para TED</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pagamento.dadosBancarios && Object.entries(pagamento.dadosBancarios).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-gray-500 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                    <p className="text-white font-medium">{val}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => copiar(String(val))} className="text-gray-400 hover:text-orange-400">
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upload comprovante */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader><CardTitle className="text-white text-base">Comprovante de TED</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="block w-full cursor-pointer">
                <input type="file" className="hidden" accept="image/*,application/pdf"
                  onChange={e => e.target.files[0] && uploadComprovante(e.target.files[0])} />
                <div className={`flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors ${comprovanteEnviado ? "border-green-500/40 bg-green-500/5" : "border-zinc-700 hover:border-orange-500/50 bg-zinc-900"}`}>
                  {comprovanteEnviado ? (
                    <><CheckCircle2 className="w-8 h-8 text-green-400" /><p className="text-green-400 font-medium">Comprovante enviado!</p></>
                  ) : uploadingComprovante ? (
                    <><Loader2 className="w-8 h-8 animate-spin text-orange-400" /><p className="text-gray-400">Enviando...</p></>
                  ) : (
                    <><Upload className="w-8 h-8 text-gray-500" /><p className="text-gray-400">Clique para enviar o comprovante</p><p className="text-gray-600 text-xs">PNG, JPG ou PDF</p></>
                  )}
                </div>
              </label>

              <Button onClick={confirmarTed} disabled={!comprovanteEnviado} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Já fiz o TED
              </Button>
              {!comprovanteEnviado && (
                <p className="text-gray-500 text-xs text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Envie o comprovante antes de confirmar
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Aguardando confirmação */}
      {step === "enviado" && (
        <Card className="bg-zinc-950 border-green-500/20">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
            <h2 className="text-white text-xl font-bold">TED registrado com sucesso!</h2>
            <p className="text-gray-400">Seu comprovante foi enviado. O administrador irá confirmar o pagamento em breve.</p>
            <Button onClick={() => { setStep("valor"); setValor(""); setPagamento(null); setComprovanteEnviado(false); loadHistorico(); }}
              variant="outline" className="border-zinc-700 text-gray-300">
              Fazer novo TED
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {!loadingHistorico && meusPagamentos.length > 0 && (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardHeader><CardTitle className="text-white text-base">Meus Pagamentos TED</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {meusPagamentos.map(p => {
              const st = STATUS_INFO[p.status] || STATUS_INFO.aguardando_ted;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-mono">{p.identificadorPagamento}</p>
                    <p className="text-gray-500 text-xs">{formatCurrency(p.valor)}</p>
                  </div>
                  <Badge className={st.color}>{st.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}