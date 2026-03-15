import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Loader2, 
  Search, 
  Download,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminNotasFiscais() {
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [emitting, setEmitting] = useState(false);
  const [notaData, setNotaData] = useState({
    productName: '',
    amount: ''
  });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['notas-logs'],
    queryFn: () => base44.entities.LogIntegracaoBling.filter({ tipo: 'api_call', status: 'sucesso' })
  });

  const filteredPartners = partners.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf?.includes(searchTerm)
  );

  const handleEmitirNota = async () => {
    if (!selectedPartner || !notaData.amount) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setEmitting(true);
    try {
      const res = await base44.functions.invoke('blingEmitirNota', {
        partnerId: selectedPartner.id,
        productName: notaData.productName || 'Produto Digital',
        amount: parseFloat(notaData.amount)
      });

      if (res.data?.success) {
        toast.success(`✅ Nota fiscal ${res.data.nota.numero} emitida com sucesso!`);
        setSelectedPartner(null);
        setNotaData({ productName: '', amount: '' });
      } else {
        toast.error(res.data?.error || 'Erro ao emitir nota');
      }
    } catch (error) {
      console.error('Erro ao emitir nota:', error);
      toast.error(error.message || 'Erro ao emitir nota fiscal');
    } finally {
      setEmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Notas Fiscais</h1>
          <p className="text-gray-400 text-sm">Emissão via Bling API</p>
        </div>
      </div>

      {/* Info sobre emissão automática */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="p-4">
          <p className="text-blue-200 text-sm">
            ℹ️ <strong>Emissão Automática:</strong> Quando um pagamento é confirmado pela Asaas, a nota fiscal é emitida automaticamente. 
            Use o formulário abaixo apenas para emitir notas que falharam ou para casos especiais.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Emitir Nova Nota */}
        <Card className="bg-zinc-900 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Emitir Nova Nota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPartner ? (
              <div className="space-y-3">
                <Label className="text-gray-300">Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome, email ou CPF..."
                    className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                {searchTerm && (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredPartners.map(partner => (
                      <button
                        key={partner.id}
                        onClick={() => setSelectedPartner(partner)}
                        className="w-full p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-colors border border-zinc-700"
                      >
                        <p className="text-white font-medium">{partner.full_name}</p>
                        <p className="text-gray-400 text-sm">{partner.email}</p>
                        {partner.cpf && (
                          <p className="text-gray-500 text-xs">CPF: {partner.cpf}</p>
                        )}
                      </button>
                    ))}
                    {filteredPartners.length === 0 && (
                      <p className="text-gray-500 text-center py-4">Nenhum cliente encontrado</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">{selectedPartner.full_name}</p>
                      <p className="text-gray-400 text-sm">{selectedPartner.email}</p>
                      {selectedPartner.cpf && (
                        <p className="text-gray-500 text-xs">CPF: {selectedPartner.cpf}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPartner(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      Trocar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Descrição do Produto/Serviço</Label>
                  <Input
                    value={notaData.productName}
                    onChange={(e) => setNotaData({ ...notaData, productName: e.target.value })}
                    placeholder="Ex: Curso Digital, Consulta, etc"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={notaData.amount}
                    onChange={(e) => setNotaData({ ...notaData, amount: e.target.value })}
                    placeholder="0.00"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                <Button
                  onClick={handleEmitirNota}
                  disabled={emitting || !notaData.amount}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  {emitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Emitindo...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Emitir Nota Fiscal
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Notas */}
        <Card className="bg-zinc-900 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white">Notas Emitidas Recentemente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500">Nenhuma nota emitida ainda</p>
                </div>
              ) : (
                logs.slice(0, 10).map(log => (
                  <div
                    key={log.id}
                    className="p-3 bg-zinc-800 rounded-lg border border-zinc-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">
                          NF {log.detalhes?.numeroNota || 'N/A'}
                        </p>
                        <p className="text-gray-400 text-xs">{log.mensagem}</p>
                        {log.detalhes?.valor && (
                          <p className="text-green-500 text-sm font-semibold mt-1">
                            R$ {log.detalhes.valor?.toFixed(2)}
                          </p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          {new Date(log.created_date).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      {log.detalhes?.link_pdf && (
                        <a
                          href={log.detalhes.link_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-500 hover:text-orange-400"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-sm">⚙️ Configuração Necessária</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-400">
            <p>1. Acesse o Bling: <strong className="text-white">Configurações → API → Gerar chave de acesso</strong></p>
            <p>2. Copie a chave gerada</p>
            <p>3. No dashboard Base44: <strong className="text-white">Settings → Environment Variables</strong></p>
            <p>4. Adicione: <code className="bg-zinc-800 px-2 py-1 rounded text-orange-500">BLING_API_KEY</code> com o valor da chave</p>
            <p className="text-xs text-gray-500 mt-3">⚠️ Certifique-se de ter cadastros completos (endereço, CPF) para emissão</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}