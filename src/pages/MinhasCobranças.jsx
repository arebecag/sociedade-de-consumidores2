import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, FileText, CheckCircle2, Clock, AlertTriangle, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const STATUS_CONFIG = {
  PENDING: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  RECEIVED: { label: "Recebido", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  OVERDUE: { label: "Vencido", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  CANCELLED: { label: "Cancelado", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: AlertTriangle },
  REFUNDED: { label: "Estornado", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: AlertTriangle }
};

export default function MinhasCobranças() {
  const [cobranças, setCobranças] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [partner, setPartner] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
        const data = await base44.entities.Financeiro.filter({ userId: partners[0].id }, "-created_date", 20);
        setCobranças(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const gerarBoleto = async () => {
    if (!partner) return;
    setGerandoBoleto(true);
    try {
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + 3);
      const dataVencimento = vencimento.toISOString().split("T")[0];

      const res = await base44.functions.invoke("gerarBoletoParaUsuario", {
        userId: partner.id,
        valor: 97.00,
        descricao: "Ativação de Plano - Sociedade de Consumidores",
        dataVencimento
      });
      if (res.data?.success) {
        toast.success(res.data.reutilizado ? "Usando cobrança existente!" : "Boleto gerado com sucesso!");
        loadData();
      } else {
        toast.error(res.data?.error || "Erro ao gerar boleto");
      }
    } catch (e) {
      toast.error("Erro ao gerar boleto");
    } finally {
      setGerandoBoleto(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  const temPendente = cobranças.some(c => c.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Minhas Cobranças</h1>
          <p className="text-gray-400">Gerencie seus boletos e pagamentos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="border-zinc-700 text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          {!temPendente && partner?.cpf && (
            <Button onClick={gerarBoleto} disabled={gerandoBoleto} className="bg-orange-500 hover:bg-orange-600">
              {gerandoBoleto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Gerar Boleto
            </Button>
          )}
        </div>
      </div>

      {!partner?.cpf && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-yellow-300 text-sm">Para gerar boletos, cadastre seu CPF no perfil primeiro.</p>
          </CardContent>
        </Card>
      )}

      {cobranças.length === 0 ? (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nenhuma cobrança encontrada.</p>
            {partner?.cpf && !temPendente && (
              <Button onClick={gerarBoleto} disabled={gerandoBoleto} className="mt-4 bg-orange-500 hover:bg-orange-600">
                {gerandoBoleto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Gerar meu primeiro boleto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cobranças.map(c => {
            const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
            const Icon = st.icon;
            return (
              <Card key={c.id} className="bg-zinc-950 border-orange-500/20">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={st.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {st.label}
                        </Badge>
                        {c.bonusLiberado && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                            🎉 Bônus Liberado
                          </Badge>
                        )}
                      </div>
                      <p className="text-white text-2xl font-bold">{formatCurrency(c.valor)}</p>
                      <p className="text-gray-400 text-sm">{c.descricao}</p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Vencimento: <span className="text-gray-300">{formatDate(c.dataVencimento)}</span></span>
                        {c.dataPagamento && <span>Pago em: <span className="text-green-400">{formatDate(c.dataPagamento)}</span></span>}
                        {c.valorBonus && <span>Bônus: <span className="text-orange-400">{formatCurrency(c.valorBonus)}</span></span>}
                      </div>
                    </div>

                    {c.status === "PENDING" && (
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        {c.invoiceUrl && (
                          <a href={c.invoiceUrl} target="_blank" rel="noreferrer">
                            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-sm">
                              <ExternalLink className="w-4 h-4 mr-2" /> Pagar agora
                            </Button>
                          </a>
                        )}
                        {c.bankSlipUrl && (
                          <a href={c.bankSlipUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="w-full border-zinc-700 text-gray-300 hover:text-white text-sm">
                              <FileText className="w-4 h-4 mr-2" /> Baixar boleto
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}