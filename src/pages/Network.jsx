import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, UserPlus, ChevronRight, CheckCircle, AlertCircle, XCircle, Share2, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Network() {
  const [partner, setPartner] = useState(null);
  const [directClients, setDirectClients] = useState([]);
  const [indirectClients, setIndirectClients] = useState([]);
  const [allPartners, setAllPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spilloverDialogOpen, setSpilloverDialogOpen] = useState(false);
  const [selectedDirectClient, setSelectedDirectClient] = useState("");
  const [spilloverEmail, setSpilloverEmail] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        const p = partners[0];
        setPartner(p);
        
        // Get all partners for lookups
        const all = await base44.entities.Partner.list();
        setAllPartners(all);
        
        // Get network relations
        const relations = await base44.entities.NetworkRelation.filter({ referrer_id: p.id });
        
        const directIds = relations.filter(r => r.relation_type === "direct").map(r => r.referred_id);
        const indirectIds = relations.filter(r => r.relation_type === "indirect").map(r => r.referred_id);
        
        const direct = all.filter(partner => directIds.includes(partner.id));
        const indirect = all.filter(partner => indirectIds.includes(partner.id));
        
        setDirectClients(direct);
        setIndirectClients(indirect);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!partner) return;
    const link = `${window.location.origin}/Register?ref=${partner.unique_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const copySiteLink = () => {
    if (!partner) return;
    const link = `${window.location.origin}/PartnerSite?p=${partner.unique_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link do site copiado!");
  };

  const handleSpillover = async () => {
    if (!selectedDirectClient || !spilloverEmail) {
      toast.error("Preencha todos os campos");
      return;
    }

    setProcessing(true);
    try {
      // Find the client to spillover
      const clientToSpill = allPartners.find(p => p.email === spilloverEmail || p.created_by === spilloverEmail);
      
      if (!clientToSpill) {
        toast.error("Cliente não encontrado");
        setProcessing(false);
        return;
      }

      // Check if target direct client has less than 3 clients
      const targetRelations = await base44.entities.NetworkRelation.filter({ referrer_id: selectedDirectClient });
      const targetDirectCount = targetRelations.filter(r => r.relation_type === "direct").length;

      if (targetDirectCount >= 3) {
        toast.error("Este cliente já possui 3 indicados diretos");
        setProcessing(false);
        return;
      }

      // Update the network relation
      await base44.entities.NetworkRelation.create({
        referrer_id: selectedDirectClient,
        referrer_name: allPartners.find(p => p.id === selectedDirectClient)?.full_name,
        referred_id: clientToSpill.id,
        referred_name: clientToSpill.full_name,
        relation_type: "direct",
        level: 1
      });

      toast.success("Derramamento realizado com sucesso!");
      setSpilloverDialogOpen(false);
      setSelectedDirectClient("");
      setSpilloverEmail("");
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao realizar derramamento");
    } finally {
      setProcessing(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const config = {
      ativo: { icon: CheckCircle, color: "bg-green-500/20 text-green-500", label: "ATIVO" },
      pendente: { icon: AlertCircle, color: "bg-yellow-500/20 text-yellow-500", label: "PENDENTE" },
      excluido: { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "EXCLUÍDO" }
    };
    
    const { icon: Icon, color, label } = config[status] || config.pendente;
    
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const ClientCard = ({ client, type }) => (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{client.display_name || client.full_name}</p>
            <p className="text-gray-500 text-sm">
              Cadastro: {new Date(client.created_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <StatusBadge status={client.status} />
        </div>
        {type === "direct" && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-gray-400 text-xs">Bônus: 15% das compras</p>
          </div>
        )}
        {type === "indirect" && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-gray-400 text-xs">Bônus: 30% das compras</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Minha Rede</h1>
          <p className="text-gray-400">Gerencie seus clientes indicados</p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={copySiteLink} variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10">
            <Share2 className="w-4 h-4 mr-2" />
            Copiar Link do Site
          </Button>
          <Button onClick={copyReferralLink} className="bg-orange-500 hover:bg-orange-600">
            <Copy className="w-4 h-4 mr-2" />
            Copiar Link de Cadastro
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-gray-400 text-sm">Diretos</p>
            <p className="text-2xl font-bold text-white">{directClients.length}/3</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-gray-400 text-sm">Indiretos</p>
            <p className="text-2xl font-bold text-white">{indirectClients.length}/9</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-gray-400 text-sm">Ativos</p>
            <p className="text-2xl font-bold text-green-500">
              {[...directClients, ...indirectClients].filter(c => c.status === 'ativo').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-gray-400 text-sm">Grupos de 12</p>
            <p className="text-2xl font-bold text-orange-500">{partner?.groups_formed || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Spillover */}
      {directClients.length > 0 && (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-500" />
              Derramamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              Envie até 3 clientes para cada um dos seus 3 clientes diretos, ajudando-os a formar grupos mais rápido.
            </p>
            <Dialog open={spilloverDialogOpen} onOpenChange={setSpilloverDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Fazer Derramamento
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-orange-500/20">
                <DialogHeader>
                  <DialogTitle className="text-white">Derramamento de Cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white">Selecione o cliente direto</Label>
                    <Select value={selectedDirectClient} onValueChange={setSelectedDirectClient}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {directClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">E-mail do novo cliente</Label>
                    <Input
                      value={spilloverEmail}
                      onChange={(e) => setSpilloverEmail(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setSpilloverDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSpillover}
                    disabled={processing}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Confirmar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Network Tabs */}
      <Tabs defaultValue="direct" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="direct" className="data-[state=active]:bg-orange-500">
            <Users className="w-4 h-4 mr-2" />
            Diretos ({directClients.length})
          </TabsTrigger>
          <TabsTrigger value="indirect" className="data-[state=active]:bg-orange-500">
            <ChevronRight className="w-4 h-4 mr-2" />
            Indiretos ({indirectClients.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct">
          {directClients.length === 0 ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Você ainda não tem clientes diretos.</p>
                <p className="text-gray-500 text-sm mt-2">Compartilhe seu link de cadastro para começar!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directClients.map((client) => (
                <ClientCard key={client.id} client={client} type="direct" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="indirect">
          {indirectClients.length === 0 ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Você ainda não tem clientes indiretos.</p>
                <p className="text-gray-500 text-sm mt-2">Clientes indiretos são os indicados dos seus clientes diretos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {indirectClients.map((client) => (
                <ClientCard key={client.id} client={client} type="indirect" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}