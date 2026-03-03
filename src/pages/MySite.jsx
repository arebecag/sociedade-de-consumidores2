import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Copy, ExternalLink, Save, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function MySite() {
  const { partner, loading, reload } = usePartner();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (partner) {
      setDisplayName(partner.display_name || partner.full_name?.split(" ")[0] || "");
    }
  }, [partner]);

  const handleSave = async () => {
    if (!partner || !displayName.trim()) return;
    
    setSaving(true);
    try {
      await base44.entities.Partner.update(partner.id, { display_name: displayName.trim() });
      toast.success("Nome atualizado com sucesso!");
      loadData();
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (type) => {
    if (!partner || !partner.unique_code) {
      toast.error("Código único não disponível");
      return;
    }
    
    const baseUrl = "https://3x3sc.com.br";
    const link = type === 'site' 
      ? `${baseUrl}/PartnerSite?p=${partner.unique_code}`
      : `${baseUrl}/Register?ref=${partner.unique_code}`;
    
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Link copiado!");
    }
  };

  const openSite = () => {
    if (!partner || !partner.unique_code) {
      toast.error("Código único não disponível");
      return;
    }
    const baseUrl = "https://3x3sc.com.br";
    window.open(`${baseUrl}/PartnerSite?p=${partner.unique_code}`, '_blank');
  };

  const shareOnWhatsApp = () => {
    if (!partner || !partner.unique_code) {
      toast.error("Código único não disponível");
      return;
    }
    const link = `https://3x3sc.com.br/PartnerSite?p=${partner.unique_code}`;
    const text = `Olá! Conheça a Sociedade de Consumidores e comece a gerar bônus: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getSiteUrl = () => {
    if (!partner?.unique_code) return "";
    return `https://3x3sc.com.br/PartnerSite?p=${partner.unique_code}`;
  };

  const getRegisterUrl = () => {
    if (!partner?.unique_code) return "";
    return `https://3x3sc.com.br/Register?ref=${partner.unique_code}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Meu Site de Divulgação</h1>
        <p className="text-gray-400">Personalize e compartilhe seu site</p>
      </div>

      {/* Personalization Card */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-orange-500" />
            Personalizar Site
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-white">Nome que aparece no site</Label>
            <div className="flex gap-4">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white max-w-md"
                placeholder="Seu nome ou apelido"
              />
              <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>
            <p className="text-gray-500 text-sm">Este é o nome que seus visitantes verão no topo do seu site de divulgação.</p>
          </div>
        </CardContent>
      </Card>

      {/* Links Card */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white">Seus Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Site Link */}
          <div className="p-4 bg-zinc-900 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">Link do Site de Divulgação</p>
                <p className="text-gray-500 text-sm mt-1 break-all">
                  {getSiteUrl() || "Carregando..."}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={() => copyLink('site')} variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
                <Button onClick={openSite} className="bg-orange-500 hover:bg-orange-600">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir
                </Button>
              </div>
            </div>
          </div>

          {/* Unique Code */}
          <div className="p-4 bg-zinc-900 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-white font-medium">Seu Código Único</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">
                  {partner?.unique_code || <span className="text-gray-500 text-base">Não disponível</span>}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share Card */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white">Compartilhar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={shareOnWhatsApp}
              className="bg-green-600 hover:bg-green-700 h-auto py-4 flex-col"
            >
              <Share2 className="w-6 h-6 mb-2" />
              <span>Compartilhar no WhatsApp</span>
            </Button>
            <Button
              onClick={() => copyLink('site')}
              className="bg-blue-600 hover:bg-blue-700 h-auto py-4 flex-col"
            >
              <Copy className="w-6 h-6 mb-2" />
              <span>Copiar Link do Site</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white">Prévia do Site</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black rounded-xl border border-zinc-800 overflow-hidden">
            {/* Mock browser bar */}
            <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 bg-zinc-800 rounded px-3 py-1 text-xs text-gray-400 truncate ml-2">
                {getSiteUrl()}
              </div>
            </div>

            {/* Preview content */}
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="text-center border-b border-orange-500/20 pb-6">
                <h1 className="text-2xl font-bold text-orange-500">Sociedade de</h1>
                <h1 className="text-2xl font-bold text-white">Consumidores</h1>
              </div>

              {/* Partner name + CTA */}
              <div className="text-center space-y-3">
                <p className="text-gray-400 text-sm">Indicador</p>
                <h2 className="text-xl font-bold text-white">{partner?.display_name || partner?.full_name}</h2>
                <div className="inline-block bg-orange-500 text-white font-bold py-2 px-8 rounded-full text-sm">
                  CADASTRE-SE JÁ
                </div>
              </div>

              {/* Video placeholder */}
              <div className="aspect-video bg-zinc-900 rounded-xl border border-orange-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-orange-500 border-b-[8px] border-b-transparent ml-1" />
                  </div>
                  <p className="text-gray-500 text-xs">Vídeo de apresentação</p>
                </div>
              </div>

              {/* Content preview */}
              <div className="bg-zinc-950 rounded-xl p-4 border border-orange-500/10 space-y-2">
                <p className="text-white text-sm font-semibold">Bem vindo à maior <span className="text-orange-500">SOCIEDADE DE CONSUMIDORES</span> do Brasil.</p>
                <p className="text-gray-400 text-xs">Gere bônus de até 40% com as compras dos seus clientes...</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button onClick={openSite} variant="outline" size="sm" className="border-orange-500/40 text-orange-500 hover:bg-orange-500/10 text-xs">
              <ExternalLink className="w-3 h-3 mr-1" />
              Ver site completo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}