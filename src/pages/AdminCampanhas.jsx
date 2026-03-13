import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, Play, RotateCcw, Download, Search,
  Loader2, Users, DollarSign, CheckCircle, Calendar,
  AlertCircle, Activity, TrendingUp, FileText
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCampanhas() {
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDryRun, setShowDryRun] = useState(false);

  const { data: campanhas = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-campanhas'],
    queryFn: () => base44.entities.CampanhasIncentivo.list()
  });

  const { data: participantes = [] } = useQuery({
    queryKey: ['admin-participantes'],
    queryFn: () => base44.entities.CampanhaParticipantes.list(null, 500)
  });

  const { data: recompensas = [] } = useQuery({
    queryKey: ['admin-recompensas'],
    queryFn: () => base44.entities.CampanhaRecompensas.list(null, 500)
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['admin-logs-campanha'],
    queryFn: () => base44.entities.LogIntegracaoCampanha.list('-dataProcessamento', 50)
  });

  const handleProcessar = async (dryRun = false) => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('processarCampanha12x12', { dryRun });
      
      if (res.data?.success) {
        toast.success(
          dryRun 
            ? `✅ Simulação: ${res.data.recompensasGeradas} recompensas seriam geradas`
            : `✅ Processamento concluído: ${res.data.recompensasGeradas} recompensas geradas`
        );
        if (!dryRun) {
          refetch();
        }
      } else {
        toast.error(res.data?.error || 'Erro ao processar');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao processar campanha');
    } finally {
      setProcessing(false);
    }
  };

  const campanhaAtiva = campanhas.find(c => c.ativa);
  const totalParticipantes = participantes.length;
  const totalClientesAtivos = participantes.reduce((sum, p) => sum + (p.totalClientesAtivos || 0), 0);
  const totalRecompensas = recompensas.length;
  const valorTotalPremiado = recompensas.reduce((sum, r) => sum + (r.valorPremio || 0), 0);

  const filteredParticipantes = participantes.filter(p =>
    p.nomeParceiro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.emailParceiro?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Admin: Campanha 12+12+12</h1>
            <p className="text-gray-400 text-sm">Gestão e monitoramento da campanha</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleProcessar(true)}
            disabled={processing}
            variant="outline"
            className="gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Simular (Dry-run)
          </Button>
          <Button
            onClick={() => handleProcessar(false)}
            disabled={processing}
            className="bg-orange-500 hover:bg-orange-600 gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Processar Agora
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-gray-400 text-sm">Participantes</p>
                <p className="text-3xl font-bold text-white">{totalParticipantes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-gray-400 text-sm">Clientes Ativos</p>
                <p className="text-3xl font-bold text-white">{totalClientesAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-gray-400 text-sm">Recompensas</p>
                <p className="text-3xl font-bold text-white">{totalRecompensas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-gray-400 text-sm">Total Premiado</p>
                <p className="text-2xl font-bold text-white">R$ {valorTotalPremiado.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status da Campanha */}
      {campanhaAtiva && (
        <Card className="bg-zinc-900 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              Campanha Ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">{campanhaAtiva.nomeCampanha}</p>
                <p className="text-gray-400 text-sm">{campanhaAtiva.descricao}</p>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Ativa
              </Badge>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-xs">Início</p>
                <p className="text-white">{new Date(campanhaAtiva.dataInicio).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Término</p>
                <p className="text-white">{new Date(campanhaAtiva.dataFim).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Prêmio por Bloco</p>
                <p className="text-green-500 font-bold">R$ {campanhaAtiva.valorPremio.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Participantes */}
      <Card className="bg-zinc-900 border-orange-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Participantes</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar parceiro..."
                className="pl-10 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-4 text-gray-400 text-sm">Parceiro</th>
                  <th className="text-center py-3 px-4 text-gray-400 text-sm">Clientes Ativos</th>
                  <th className="text-center py-3 px-4 text-gray-400 text-sm">Blocos Fechados</th>
                  <th className="text-center py-3 px-4 text-gray-400 text-sm">Valor Premiado</th>
                  <th className="text-center py-3 px-4 text-gray-400 text-sm">Faltam</th>
                  <th className="text-center py-3 px-4 text-gray-400 text-sm">Última Atualização</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipantes.map((p) => {
                  const faltam = 12 - (p.totalClientesAtivos % 12);
                  return (
                    <tr key={p.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{p.nomeParceiro}</p>
                          <p className="text-gray-500 text-xs">{p.emailParceiro}</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-white font-semibold">{p.totalClientesAtivos}</td>
                      <td className="text-center py-3 px-4 text-green-500 font-semibold">{p.totalBlocosFechados}</td>
                      <td className="text-center py-3 px-4 text-yellow-500 font-bold">
                        R$ {p.valorTotalPremiado?.toFixed(2)}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-orange-500 font-semibold">{faltam}</span>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-400 text-xs">
                        {p.dataUltimaAtualizacao ? new Date(p.dataUltimaAtualizacao).toLocaleString('pt-BR') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Logs de Processamento */}
      <Card className="bg-zinc-900 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Logs de Processamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {log.status === 'sucesso' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : log.status === 'erro' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="text-white font-medium text-sm">{log.mensagem}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.tipoProcessamento}
                    </Badge>
                  </div>
                  <p className="text-gray-400 text-xs">
                    {new Date(log.dataProcessamento).toLocaleString('pt-BR')} • 
                    {log.parceirosProcessados} parceiros • 
                    {log.recompensasGeradas} recompensas
                  </p>
                  {log.erros?.length > 0 && (
                    <p className="text-red-400 text-xs mt-1">⚠️ {log.erros.length} erros</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}