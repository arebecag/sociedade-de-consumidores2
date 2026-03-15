import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, CheckCircle, XCircle, AlertCircle, 
  RefreshCw, Loader2, Link2, Link2Off, Play,
  Calendar, Clock, FileText, Key
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminBling() {
  const [conectando, setConectando] = useState(false);
  const [testando, setTestando] = useState(false);
  const queryClient = useQueryClient();

  const { data: integracao, isLoading } = useQuery({
    queryKey: ['integracao-bling'],
    queryFn: async () => {
      const integracoes = await base44.entities.IntegracaoBling.list();
      return integracoes[0] || null;
    },
    refetchInterval: 30000 // Atualiza a cada 30s
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs-bling'],
    queryFn: () => base44.entities.LogIntegracaoBling.list('-created_date', 50)
  });

  const handleConectar = async () => {
    setConectando(true);
    try {
      const res = await base44.functions.invoke('blingGerarAuthUrl', {});
      
      if (res.data?.success && res.data?.authUrl) {
        // Abrir popup para autorização
        const width = 600;
        const height = 700;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        
        window.open(
          res.data.authUrl,
          'Conectar Bling',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        
        toast.success('Janela de autorização aberta. Faça login no Bling.');
        
        // Recarregar dados após alguns segundos
        setTimeout(() => {
          queryClient.invalidateQueries(['integracao-bling']);
          queryClient.invalidateQueries(['logs-bling']);
        }, 5000);
      } else {
        toast.error(res.data?.error || 'Erro ao gerar URL de autorização');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao conectar');
    } finally {
      setConectando(false);
    }
  };

  const handleRenovar = async () => {
    try {
      const res = await base44.functions.invoke('blingRenovarToken', {});
      
      if (res.data?.success) {
        toast.success('Token renovado com sucesso');
        queryClient.invalidateQueries(['integracao-bling']);
        queryClient.invalidateQueries(['logs-bling']);
      } else {
        toast.error(res.data?.error || 'Erro ao renovar token');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao renovar');
    }
  };

  const handleDesconectar = async () => {
    if (!confirm('Tem certeza que deseja desconectar a integração com Bling?')) {
      return;
    }

    try {
      const res = await base44.functions.invoke('blingDesconectar', {});
      
      if (res.data?.success) {
        toast.success('Desconectado com sucesso');
        queryClient.invalidateQueries(['integracao-bling']);
        queryClient.invalidateQueries(['logs-bling']);
      } else {
        toast.error(res.data?.error || 'Erro ao desconectar');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao desconectar');
    }
  };

  const handleTestar = async () => {
    setTestando(true);
    try {
      const res = await base44.functions.invoke('blingTestarConexao', {});
      
      if (res.data?.success) {
        toast.success('✅ Conexão OK! API do Bling está respondendo.');
        queryClient.invalidateQueries(['logs-bling']);
      } else {
        toast.error('❌ Falha no teste: ' + (res.data?.mensagem || 'Erro desconhecido'));
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao testar');
    } finally {
      setTestando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const conectado = integracao?.status_integracao === 'conectado';
  const expiraEm = integracao?.expira_em ? new Date(integracao.expira_em) : null;
  const expirado = expiraEm && expiraEm < new Date();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Integração Bling</h1>
          <p className="text-gray-400 text-sm">Gerenciar conexão OAuth 2.0 com Bling</p>
        </div>
      </div>

      {/* Status da Integração */}
      <Card className="bg-zinc-900 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              {conectado ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              Status da Conexão
            </span>
            <Badge className={conectado ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
              {conectado ? 'Conectado' : 'Desconectado'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integracao ? (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Data de Autenticação</p>
                  <p className="text-white">
                    {integracao.data_autenticacao 
                      ? new Date(integracao.data_autenticacao).toLocaleString('pt-BR')
                      : 'Nunca conectado'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Token Expira em</p>
                  <p className={`font-semibold ${expirado ? 'text-red-500' : 'text-white'}`}>
                    {expiraEm 
                      ? expiraEm.toLocaleString('pt-BR')
                      : '-'}
                  </p>
                </div>
              </div>

              {integracao.ultimo_erro && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {integracao.ultimo_erro}
                  </p>
                </div>
              )}

              {integracao.scope && (
                <div>
                  <p className="text-gray-500 text-xs mb-1">Escopos Autorizados</p>
                  <p className="text-gray-400 text-sm">{integracao.scope || 'Padrão'}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {conectado ? (
                  <>
                    <Button
                      onClick={handleTestar}
                      disabled={testando}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Testar Conexão
                    </Button>
                    <Button
                      onClick={handleRenovar}
                      variant="outline"
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Renovar Token
                    </Button>
                    <Button
                      onClick={handleDesconectar}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Link2Off className="w-4 h-4" />
                      Desconectar
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleConectar}
                    disabled={conectando}
                    className="gap-2 bg-orange-500 hover:bg-orange-600"
                  >
                    {conectando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Conectar com Bling
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">Integração ainda não configurada</p>
              <Button
                onClick={handleConectar}
                disabled={conectando}
                className="gap-2 bg-orange-500 hover:bg-orange-600"
              >
                {conectando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Conectar com Bling
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="w-5 h-5" />
            Configuração OAuth 2.0
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-gray-400 mb-1">1. No painel do Bling, configure:</p>
            <div className="bg-zinc-800 p-3 rounded font-mono text-xs text-gray-300">
              <p>Client ID: (preencher no ambiente)</p>
              <p>Client Secret: (preencher no ambiente)</p>
              <p>Redirect URI: https://[seu-dominio]/integracoes/bling/callback</p>
            </div>
          </div>
          <div>
            <p className="text-gray-400 mb-1">2. Configure as variáveis de ambiente:</p>
            <ul className="list-disc list-inside text-gray-500 space-y-1">
              <li>BLING_CLIENT_ID</li>
              <li>BLING_CLIENT_SECRET</li>
              <li>BLING_REDIRECT_URI</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-400 mb-1">3. Clique em "Conectar com Bling" acima</p>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Logs de Integração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum log registrado</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 flex items-start gap-3"
                >
                  {log.status === 'sucesso' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.tipo}
                      </Badge>
                      {log.codigo_http && (
                        <span className="text-gray-500 text-xs">HTTP {log.codigo_http}</span>
                      )}
                    </div>
                    <p className="text-white text-sm">{log.mensagem}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(log.created_date).toLocaleString('pt-BR')}
                    </p>
                    {log.erro && (
                      <p className="text-red-400 text-xs mt-1">⚠️ {log.erro}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}