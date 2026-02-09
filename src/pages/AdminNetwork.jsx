import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, User as UserIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminNetwork() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);

  React.useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const user = await base44.auth.me();
      setIsAdmin(user?.role === 'admin');
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const searchPartner = async () => {
    if (!searchQuery.trim()) {
      toast.error("Digite um nome, email ou código único");
      return;
    }

    setLoading(true);
    try {
      const partners = await base44.entities.Partner.list();
      const found = partners.find(p => 
        p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.unique_code?.toLowerCase() === searchQuery.toLowerCase() ||
        p.created_by?.toLowerCase() === searchQuery.toLowerCase()
      );

      if (found) {
        setSelectedPartner(found);
        await loadNetworkData(found.id);
      } else {
        toast.error("Parceiro não encontrado");
        setSelectedPartner(null);
        setNetworkData(null);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao buscar parceiro");
    } finally {
      setLoading(false);
    }
  };

  const loadNetworkData = async (partnerId) => {
    try {
      // Get referrer (who referred this partner)
      const referrerRelations = await base44.entities.NetworkRelation.filter({ 
        referred_id: partnerId, 
        relation_type: "direct" 
      });
      
      let referrer = null;
      if (referrerRelations.length > 0) {
        const referrerPartners = await base44.entities.Partner.filter({ 
          id: referrerRelations[0].referrer_id 
        });
        if (referrerPartners.length > 0) {
          referrer = referrerPartners[0];
        }
      }

      // Get network (who this partner referred)
      const networkRelations = await base44.entities.NetworkRelation.filter({ 
        referrer_id: partnerId 
      });
      
      const referredIds = networkRelations.map(n => n.referred_id);
      let network = [];
      
      if (referredIds.length > 0) {
        const allPartners = await base44.entities.Partner.list();
        network = allPartners.filter(p => referredIds.includes(p.id));
      }

      // Separate by level
      const directNetwork = network.filter(p => 
        networkRelations.find(n => n.referred_id === p.id && n.relation_type === "direct")
      );
      
      const indirectNetwork = network.filter(p => 
        networkRelations.find(n => n.referred_id === p.id && n.relation_type === "indirect")
      );

      setNetworkData({
        referrer,
        directNetwork,
        indirectNetwork,
        stats: {
          total: network.length,
          direct: directNetwork.length,
          indirect: indirectNetwork.length,
          active: network.filter(p => p.status === 'ativo').length,
          pending: network.filter(p => p.status === 'pendente').length,
          excluded: network.filter(p => p.status === 'excluido').length
        }
      });
    } catch (error) {
      console.error("Error loading network:", error);
      toast.error("Erro ao carregar rede");
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-zinc-950 border-orange-500/20 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
            <p className="text-gray-400">Você precisa ser administrador para acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Auditoria de Rede</h1>
        <p className="text-gray-400">Visualize a rede de qualquer parceiro</p>
      </div>

      {/* Search */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label className="text-white">Buscar Parceiro</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchPartner()}
                className="bg-zinc-900 border-zinc-700 text-white"
                placeholder="Nome, email ou código único..."
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={searchPartner}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Partner Info */}
      {selectedPartner && (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              Parceiro Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Nome</p>
                <p className="text-white font-semibold">{selectedPartner.full_name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white">{selectedPartner.created_by}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Código Único</p>
                <p className="text-orange-500 font-semibold">{selectedPartner.unique_code}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <Badge className={
                  selectedPartner.status === 'ativo' ? 'bg-green-500/20 text-green-500' :
                  selectedPartner.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                  'bg-red-500/20 text-red-500'
                }>
                  {selectedPartner.status?.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Graduação</p>
                <p className="text-white">{selectedPartner.graduation?.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Bônus Total</p>
                <p className="text-white">{(selectedPartner.total_bonus_generated || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Stats */}
      {networkData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{networkData.stats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400 text-sm">Diretos</p>
                <p className="text-2xl font-bold text-orange-500">{networkData.stats.direct}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400 text-sm">Indiretos</p>
                <p className="text-2xl font-bold text-purple-500">{networkData.stats.indirect}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400 text-sm">Ativos</p>
                <p className="text-2xl font-bold text-green-500">{networkData.stats.active}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400 text-sm">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-500">{networkData.stats.pending}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400 text-sm">Excluídos</p>
                <p className="text-2xl font-bold text-red-500">{networkData.stats.excluded}</p>
              </CardContent>
            </Card>
          </div>

          {/* Referrer */}
          {networkData.referrer && (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardHeader>
                <CardTitle className="text-white">Indicador (Quem indicou)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg">
                  <Users className="w-8 h-8 text-orange-500" />
                  <div className="flex-1">
                    <p className="text-white font-semibold">{networkData.referrer.display_name || networkData.referrer.full_name}</p>
                    <p className="text-gray-400 text-sm">{networkData.referrer.created_by}</p>
                  </div>
                  <Badge className={
                    networkData.referrer.status === 'ativo' ? 'bg-green-500/20 text-green-500' :
                    networkData.referrer.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                    'bg-red-500/20 text-red-500'
                  }>
                    {networkData.referrer.status?.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Network - Direct */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Rede Direta (1º Nível)</CardTitle>
            </CardHeader>
            <CardContent>
              {networkData.directNetwork.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhum cliente direto</p>
              ) : (
                <div className="space-y-2">
                  {networkData.directNetwork.map(client => (
                    <div key={client.id} className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors">
                      <UserIcon className="w-6 h-6 text-orange-500" />
                      <div className="flex-1">
                        <p className="text-white font-semibold">{client.display_name || client.full_name}</p>
                        <p className="text-gray-400 text-sm">{client.created_by}</p>
                      </div>
                      <Badge className={
                        client.status === 'ativo' ? 'bg-green-500/20 text-green-500' :
                        client.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }>
                        {client.status?.toUpperCase()}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPartner(client);
                          loadNetworkData(client.id);
                        }}
                        className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                      >
                        Ver Rede
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Network - Indirect */}
          {networkData.indirectNetwork.length > 0 && (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardHeader>
                <CardTitle className="text-white">Rede Indireta (2º Nível)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {networkData.indirectNetwork.map(client => (
                    <div key={client.id} className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors">
                      <UserIcon className="w-6 h-6 text-purple-500" />
                      <div className="flex-1">
                        <p className="text-white font-semibold">{client.display_name || client.full_name}</p>
                        <p className="text-gray-400 text-sm">{client.created_by}</p>
                      </div>
                      <Badge className={
                        client.status === 'ativo' ? 'bg-green-500/20 text-green-500' :
                        client.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }>
                        {client.status?.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}