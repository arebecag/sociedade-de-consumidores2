import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Users,
  DollarSign,
  Calendar,
  Gift,
  TrendingUp,
  Loader2,
  Award,
  CheckCircle,
} from "lucide-react";

export default function CampanhaDesafio() {
  const dataFinalCampanha = "30/04/2026";
  const { partner, loading: partnerLoading } = usePartner();
  const [timeLeft, setTimeLeft] = useState(null);

  const { data: campanha, isLoading: campanhaLoading } = useQuery({
    queryKey: ["campanha-desafio"],
    queryFn: async () => {
      const campanhas = await base44.entities.CampanhasIncentivo.filter({
        nomeCampanha: "Desafio 12+12+12",
        ativa: true,
      });
      return campanhas[0] || null;
    },
  });

  const { data: participante } = useQuery({
    queryKey: ["participante-campanha", partner?.id, campanha?.id],
    queryFn: async () => {
      if (!partner?.id || !campanha?.id) return null;
      // Conta apenas clientes DIRETOS (onde o parceiro é o indicador) com status ativo
      const relacoesDiretas = await base44.entities.NetworkRelation.filter({
        referrer_id: partner.id,
        relation_type: "direct",
      });
      const idsDirectos = relacoesDiretas.map((r) => r.referred_id);
      let clientesDiretosAtivos = 0;
      if (idsDirectos.length > 0) {
        const allPartners = await base44.entities.Partner.list(null, 500);
        clientesDiretosAtivos = allPartners.filter(
          (p) => idsDirectos.includes(p.id) && p.status === "ativo",
        ).length;
      }
      const participantes = await base44.entities.CampanhaParticipantes.filter({
        campanhaId: campanha.id,
        parceiroId: partner.id,
      });
      const p = participantes[0];
      // Usar contagem ao vivo de diretos ativos
      return p
        ? { ...p, totalClientesAtivos: clientesDiretosAtivos }
        : {
            totalClientesAtivos: clientesDiretosAtivos,
            totalBlocosFechados: 0,
            valorTotalPremiado: 0,
          };
    },
    enabled: !!partner?.id && !!campanha?.id,
  });

  const { data: recompensas = [] } = useQuery({
    queryKey: ["recompensas-campanha", partner?.id, campanha?.id],
    queryFn: async () => {
      if (!partner?.id || !campanha?.id) return [];
      return await base44.entities.CampanhaRecompensas.filter({
        campanhaId: campanha.id,
        parceiroId: partner.id,
      });
    },
    enabled: !!partner?.id && !!campanha?.id,
  });

  useEffect(() => {
    if (!campanha?.dataFim) return;

    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(campanha.dataFim);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
      } else {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [campanha]);

  if (partnerLoading || campanhaLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="text-center py-16">
        <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          Nenhuma campanha ativa
        </h2>
        <p className="text-gray-400">Aguarde novas campanhas de incentivo!</p>
      </div>
    );
  }

  const clientesAtivos = participante?.totalClientesAtivos || 0;
  const blocosFechados = participante?.totalBlocosFechados || 0;
  const valorTotal = participante?.valorTotalPremiado || 0;
  const faltamClientes =
    campanha.quantidadeNecessaria -
    (clientesAtivos % campanha.quantidadeNecessaria);
  const progressoAtual =
    ((clientesAtivos % campanha.quantidadeNecessaria) /
      campanha.quantidadeNecessaria) *
    100;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Banner da Campanha */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 p-8 text-white">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Imagem da campanha */}
          {campanha.imagemUrl && (
            <div className="flex-shrink-0">
              <img
                src={campanha.imagemUrl}
                alt="Desafio 12+12+12"
                className="w-auto h-auto max-w-md rounded-xl shadow-2xl border-4 border-white/30"
              />
            </div>
          )}

          {/* Conteúdo */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-12 h-12 text-yellow-400" />
              <div>
                <h1 className="text-4xl font-bold">Desafio 12+12+12</h1>
                <p className="text-xl">
                  A cada 12 clientes ativos, ganha na hora PIX de R$ 800,00
                </p>
              </div>
            </div>

            {timeLeft && (
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[
                  { label: "Dias", value: timeLeft.days },
                  { label: "Horas", value: timeLeft.hours },
                  { label: "Minutos", value: timeLeft.minutes },
                  { label: "Segundos", value: timeLeft.seconds },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-black/60 rounded-lg p-3 text-center"
                  >
                    <div className="text-3xl font-bold text-yellow-400">
                      {String(item.value).padStart(2, "0")}
                    </div>
                    <div className="text-sm text-gray-300">{item.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-yellow-200">
              <Calendar className="w-5 h-5" />
              <span className="font-semibold">
                Esta campanha termina no dia 30/04/2026
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de participação */}
      <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trophy className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <p className="text-orange-300 font-bold text-base">
            🎉 Você já está participando deste desafio!
          </p>
          <p className="text-orange-200/80 text-sm mt-1">
            Faça sua primeira compra. Fique <strong>ATIVO</strong> para receber
            seus prêmios, bônus e comissões.
          </p>
        </div>
      </div>

      {/* Cards de Status */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900 to-blue-800 border-blue-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Clientes Diretos Ativos</p>
                <p className="text-3xl font-bold text-white">
                  {clientesAtivos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900 to-green-800 border-green-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Blocos Fechados</p>
                <p className="text-3xl font-bold text-white">
                  {blocosFechados}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900 to-yellow-800 border-yellow-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Valor Conquistado</p>
                <p className="text-2xl font-bold text-white">
                  R$ {valorTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900 to-purple-800 border-purple-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Faltam</p>
                <p className="text-3xl font-bold text-white">
                  {faltamClientes}
                </p>
                <p className="text-xs text-gray-400">para R$ 800,00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress do Próximo Prêmio */}
      <Card className="bg-zinc-900 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-orange-500" />
            Progresso para o Próximo Prêmio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">
                {clientesAtivos % campanha.quantidadeNecessaria} de{" "}
                {campanha.quantidadeNecessaria} clientes diretos ativos
              </span>
              <span className="text-orange-500 font-bold">
                {progressoAtual.toFixed(0)}%
              </span>
            </div>
            <Progress value={progressoAtual} className="h-4" />
          </div>
          <p className="text-center text-gray-300">
            Faltam{" "}
            <span className="text-orange-500 font-bold text-2xl">
              {faltamClientes}
            </span>{" "}
            clientes para ganhar{" "}
            <span className="text-green-500 font-bold text-2xl">R$ 800,00</span>
          </p>
        </CardContent>
      </Card>

      {/* Histórico de Recompensas */}
      <Card className="bg-zinc-900 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white">Histórico de Recompensas</CardTitle>
        </CardHeader>
        <CardContent>
          {recompensas.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">
                Nenhuma recompensa conquistada ainda
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Continue trazendo clientes ativos!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recompensas.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        Bloco {rec.blocoNumero}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {new Date(rec.dataGeracao).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-500 font-bold text-xl">
                      R$ {rec.valorPremio.toFixed(2)}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        rec.statusPagamento === "pago"
                          ? "bg-green-500/20 text-green-400"
                          : rec.statusPagamento === "processado"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {rec.statusPagamento}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regras da Campanha */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-sm">
            📋 Regras da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-400">
          <p>
            ✅ <strong className="text-white">Item 1:</strong> a cada{" "}
            <strong className="text-white">12 clientes ativos diretos</strong>{" "}
            que você cadastrou diretamente, com status{" "}
            <strong className="text-green-400">ATIVO</strong> na{" "}
            <strong className="text-white">Sociedade de Consumidores</strong>,
            você ganha <strong className="text-white">R$ 800,00 via PIX</strong>
          </p>
          <p>
            ✅ Somente contam os clientes que{" "}
            <strong className="text-white">você cadastrou diretamente</strong> —
            clientes indiretos (dos clientes dos seus clientes){" "}
            <strong className="text-red-400">não contam</strong>
          </p>
          <p>
            ✅ Você pode acumular múltiplos prêmios: 24 clientes = R$ 1.600 · 36
            clientes = R$ 2.400...
          </p>
          <p>
            ✅ Apenas clientes com status{" "}
            <strong className="text-green-400">ATIVO</strong> na{" "}
            <strong className="text-white">Sociedade de Consumidores</strong>{" "}
            são contabilizados — pendentes não contam
          </p>
          <p>
            ✅ Fique ATIVO! Sem sua primeira compra, você não recebe prêmios,
            bônus nem comissões
          </p>
          <p>
            ⏰ Campanha válida até{" "}
            <strong className="text-orange-500">{dataFinalCampanha}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
