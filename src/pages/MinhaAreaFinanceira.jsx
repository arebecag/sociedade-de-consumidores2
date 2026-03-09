import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, ExternalLink, FileText, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, TrendingUp, DollarSign, Calendar, Gift, ArrowDownCircle
} from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const formatDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const STATUS_CONFIG = {
  PENDING:   { label: "Pendente",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "bg-green-500/20 text-green-400 border-green-500/30",   icon: CheckCircle2 },
  RECEIVED:  { label: "Recebido",   color: "bg-green-500/20 text-green-400 border-green-500/30",   icon: CheckCircle2 },
  OVERDUE:   { label: "Vencido",    color: "bg-red-500/20 text-red-400 border-red-500/30",         icon: AlertTriangle },
  CANCELLED: { label: "Cancelado",  color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",      icon: AlertTriangle },
  REFUNDED:  { label: "Estornado",  color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",      icon: AlertTriangle },
};

const STATUS_SAQUE = {
  PENDENTE:  { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400" },
  PAGO:      { label: "Pago",     color: "bg-green-500/20 text-green-400" },
  RECUSADO:  { label: "Recusado", color: "bg-red-500/20 text-red-400" },
};

export default function MinhaAreaFinanceira() {
  const [cobranças, setCobranças] = useState([]);
  const [saques, setSaques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [solicitandoSaque, setSolicitandoSaque] = useState(false);
  const [valorSaque, setValorSaque] = useState("");
  const [pixKeySaque, setPixKeySaque] = useState("");
  const [aba, setAba] = useState("plano"); // plano | historico | saques

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
        setPixKeySaque(partners[0].pix_key || "");
        const [fins, sqs] = await Promise.all([
          base44.entities.Financeiro.filter({ userId: partners[0].id }, "-created_date", 50),
          base44.entities.Saques.filter({ userId: partners[0].id }, "-created_date", 20)
        ]);
        setCobranças(fins);
        setSaques(sqs);
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

  const solicitarSaque = async () => {
    if (!partner) return;
    const saldo = partner.bonus_for_withdrawal || 0;
    const valor = parseFloat(valorSaque);
    const pixKey = pixKeySaque.trim();

    // Validações
    if (!pixKey) { toast.error("Informe a chave PIX para recebimento."); return; }
    if (!valor || valor <= 0) { toast.error("Informe um valor válido para saque."); return; }
    if (valor > saldo) { toast.error(`Valor excede o saldo disponível (${formatCurrency(saldo)})`); return; }

    // Verificar acesso liberado
    const temAcessoAtivo = cobranças.some(c => ["CONFIRMED", "RECEIVED"].includes(c.status));
    if (!temAcessoAtivo) { toast.error("Necessário ter pelo menos um pagamento confirmado para sacar."); return; }

    // Verificar se já tem saque pendente
    const temPendente = saques.some(s => s.status === "PENDENTE");
    if (temPendente) { toast.error("Você já possui uma solicitação de saque pendente."); return; }

    setSolicitandoSaque(true);
    try {
      await base44.entities.Saques.create({
        userId: partner.id,
        userEmail: partner.created_by,
        userName: partner.full_name,
        valor,
        status: "PENDENTE",
        dataSolicitacao: new Date().toISOString(),
        pixKey
      });

      // Log da solicitação
      await base44.entities.LogsFinanceiro.create({
        tipo: "SAQUE",
        userId: partner.id,
        userEmail: partner.created_by,
        userName: partner.full_name,
        valor,
        descricao: `Saque solicitado. PIX: ${pixKey}`,
        referenciaId: partner.id
      });

      toast.success("Saque solicitado! Admin irá processar em breve.");
      setValorSaque("");
      loadData();
    } catch (e) {
      toast.error("Erro ao solicitar saque");
    } finally {
      setSolicitandoSaque(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );

  const cobrancaAtiva = cobranças.find(c => ["PENDING", "CONFIRMED", "RECEIVED"].includes(c.status));
  const proximaCobranca = cobranças.find(c => c.status === "PENDING");
  const totalPago = cobranças.filter(c => ["CONFIRMED", "RECEIVED"].includes(c.status)).reduce((s, c) => s + (c.valor || 0), 0);
  const totalBonus = cobranças.filter(c => c.bonusLiberado).reduce((s, c) => s + (c.valorBonus || 0), 0);
  const statusAtual = cobrancaAtiva ? STATUS_CONFIG[cobrancaAtiva.status] : null;
  const temPendente = cobranças.some(c => c.status === "PENDING");
  const saldoSaque = partner?.bonus_for_withdrawal || 0;
  const temSaquePendente = saques.some(s => s.status === "PENDENTE");
  const podeSacar = saldoSaque > 0 && !temSaquePendente && cobranças.some(c => ["CONFIRMED","RECEIVED"].includes(c.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Minha Área Financeira</h1>
          <p className="text-gray-400">Gerencie seu plano, pagamentos e bônus</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-zinc-700 text-gray-400 hover:text-white w-fit">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400 text-xs">Total Pago</span>
            </div>
            <p className="text-white text-xl font-bold">{formatCurrency(totalPago)}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400 text-xs">Bônus Recebido</span>
            </div>
            <p className="text-white text-xl font-bold">{formatCurrency(totalBonus)}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-400 text-xs">Saldo p/ Saque</span>
            </div>
            <p className="text-white text-xl font-bold">{formatCurrency(saldoSaque)}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400 text-xs">Próx. Vencimento</span>
            </div>
            <p className="text-white text-xl font-bold">{proximaCobranca ? formatDate(proximaCobranca.dataVencimento) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        {[
          { id: "plano", label: "Plano Atual" },
          { id: "historico", label: "Histórico" },
          { id: "saques", label: "Saques" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              aba === t.id ? "border-orange-500 text-orange-500" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Plano Atual */}
      {aba === "plano" && (
        <div className="space-y-4">
          {!partner?.cpf && (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-yellow-300 text-sm">Para gerar boletos, cadastre seu CPF no perfil primeiro.</p>
              </CardContent>
            </Card>
          )}

          {cobrancaAtiva ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" /> Status do Plano
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-3 items-center">
                  {statusAtual && (
                    <Badge className={statusAtual.color}>
                      <statusAtual.icon className="w-3 h-3 mr-1" /> {statusAtual.label}
                    </Badge>
                  )}
                  {cobrancaAtiva.bonusLiberado && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">🎉 Bônus Liberado</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Valor</p>
                    <p className="text-white font-bold text-lg">{formatCurrency(cobrancaAtiva.valor)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Vencimento</p>
                    <p className="text-white font-medium">{formatDate(cobrancaAtiva.dataVencimento)}</p>
                  </div>
                  {cobrancaAtiva.dataPagamento && (
                    <div>
                      <p className="text-gray-500">Pago em</p>
                      <p className="text-green-400 font-medium">{formatDate(cobrancaAtiva.dataPagamento)}</p>
                    </div>
                  )}
                  {cobrancaAtiva.valorBonus > 0 && (
                    <div>
                      <p className="text-gray-500">Bônus Gerado</p>
                      <p className="text-orange-400 font-medium">{formatCurrency(cobrancaAtiva.valorBonus)}</p>
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-xs">{cobrancaAtiva.descricao}</p>
                {cobrancaAtiva.status === "PENDING" && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {cobrancaAtiva.invoiceUrl && (
                      <a href={cobrancaAtiva.invoiceUrl} target="_blank" rel="noreferrer">
                        <Button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600">
                          <ExternalLink className="w-4 h-4 mr-2" /> Pagar agora
                        </Button>
                      </a>
                    )}
                    {cobrancaAtiva.bankSlipUrl && (
                      <a href={cobrancaAtiva.bankSlipUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="w-full sm:w-auto border-zinc-700 text-gray-300">
                          <FileText className="w-4 h-4 mr-2" /> Baixar boleto
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">Nenhum plano ativo. Gere um boleto para ativar seu acesso.</p>
                {partner?.cpf && !temPendente && (
                  <Button onClick={gerarBoleto} disabled={gerandoBoleto} className="bg-orange-500 hover:bg-orange-600">
                    {gerandoBoleto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Gerar Boleto de Ativação
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Histórico */}
      {aba === "historico" && (
        <div className="space-y-3">
          {cobranças.length === 0 ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <p className="text-gray-400">Nenhum histórico encontrado.</p>
              </CardContent>
            </Card>
          ) : cobranças.map(c => {
            const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
            return (
              <Card key={c.id} className="bg-zinc-950 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={st.color}>
                          <st.icon className="w-3 h-3 mr-1" /> {st.label}
                        </Badge>
                        {c.bonusLiberado && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">🎉 Bônus</Badge>}
                      </div>
                      <p className="text-white font-bold">{formatCurrency(c.valor)}</p>
                      <p className="text-gray-500 text-xs">{c.descricao}</p>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>Venc: <span className="text-gray-400">{formatDate(c.dataVencimento)}</span></span>
                        {c.dataPagamento && <span>Pago: <span className="text-green-400">{formatDate(c.dataPagamento)}</span></span>}
                        {c.valorBonus > 0 && <span>Bônus: <span className="text-orange-400">{formatCurrency(c.valorBonus)}</span></span>}
                      </div>
                    </div>
                    {c.status === "PENDING" && (
                      <div className="flex gap-2">
                        {c.invoiceUrl && (
                          <a href={c.invoiceUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" /> Pagar
                            </Button>
                          </a>
                        )}
                        {c.bankSlipUrl && (
                          <a href={c.bankSlipUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="border-zinc-700 text-gray-400 text-xs">
                              <FileText className="w-3 h-3 mr-1" /> PDF
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

      {/* Saques */}
      {aba === "saques" && (
        <div className="space-y-4">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-green-400" /> Solicitar Saque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Saldo disponível para saque</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(saldoSaque)}</p>
              </div>

              {temSaquePendente ? (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-300 text-sm">Você já tem um saque pendente aguardando processamento pelo admin.</p>
                </div>
              ) : saldoSaque > 0 ? (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="space-y-1">
                    <label className="text-gray-300 text-sm">Valor a sacar (R$)</label>
                    <Input
                      type="number"
                      value={valorSaque}
                      onChange={(e) => setValorSaque(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder={`Máx: ${formatCurrency(saldoSaque)}`}
                      max={saldoSaque}
                      min={0.01}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-300 text-sm">Chave PIX para recebimento</label>
                    <Input
                      value={pixKeySaque}
                      onChange={(e) => setPixKeySaque(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="CPF, email, telefone ou chave aleatória"
                    />
                  </div>
                  <Button
                    onClick={solicitarSaque}
                    disabled={solicitandoSaque || !valorSaque || !pixKeySaque}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {solicitandoSaque ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
                    Solicitar Saque
                  </Button>
                  <p className="text-gray-500 text-xs text-center">O admin irá processar sua solicitação em breve.</p>
                </div>
              ) : (
                <div className="p-3 bg-zinc-900 rounded-lg text-center">
                  <p className="text-gray-500 text-sm">Nenhum saldo disponível para saque no momento.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {saques.length === 0 ? (
            <Card className="bg-zinc-950 border-zinc-800">
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">Nenhuma solicitação de saque ainda.</p>
              </CardContent>
            </Card>
          ) : saques.map(s => {
            const st = STATUS_SAQUE[s.status] || STATUS_SAQUE.PENDENTE;
            return (
              <Card key={s.id} className="bg-zinc-950 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Badge className={st.color}>{st.label}</Badge>
                      <p className="text-white font-bold">{formatCurrency(s.valor)}</p>
                      <p className="text-gray-500 text-xs">Solicitado em: {formatDateTime(s.dataSolicitacao)}</p>
                      {s.dataPagamento && <p className="text-green-400 text-xs">Pago em: {formatDateTime(s.dataPagamento)}</p>}
                      {s.observacao && <p className="text-gray-400 text-xs">{s.observacao}</p>}
                    </div>
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