import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner } from "@/components/PageWrapper";
import { Globe, Copy, ExternalLink, Save, Share2, Check, Link, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function MySite() {
  const { partner, loading, reload } = usePartner();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (partner) setDisplayName(partner.display_name || partner.full_name?.split(" ")[0] || "");
  }, [partner]);

  const handleSave = async () => {
    if (!partner || !displayName.trim()) return;
    setSaving(true);
    try {
      await base44.entities.Partner.update(partner.id, { display_name: displayName.trim() });
      toast.success("Nome atualizado com sucesso!");
      reload();
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const baseUrl = "https://3x3sc.com.br";
  const getSiteUrl = () => partner?.unique_code ? `${baseUrl}/PartnerSite?p=${partner.unique_code}` : "";
  const getRegisterUrl = () => partner?.unique_code ? `${baseUrl}/Register?ref=${partner.unique_code}` : "";

  const copyLink = async (type) => {
    const link = type === 'site' ? getSiteUrl() : getRegisterUrl();
    if (!link) { toast.error("Código único não disponível"); return; }
    try { await navigator.clipboard.writeText(link); } catch {
      const ta = document.createElement("textarea"); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(type); toast.success("Link copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const shareOnWhatsApp = () => {
    const link = getSiteUrl();
    if (!link) { toast.error("Código único não disponível"); return; }
    const text = `Olá! Conheça a Sociedade de Consumidores e comece a gerar bônus: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <LoadingSpinner />;

  const links = [
    { id: 'site', label: "Link do Site de Divulgação", desc: "Compartilhe para atrair novos membros", value: getSiteUrl(), icon: Globe },
    { id: 'register', label: "Link de Cadastro Direto", desc: "Link com seu código de indicação", value: getRegisterUrl(), icon: Link },
  ];

  return (
    <AnimatedPage>
      <PageHeader title="Meu Site de Divulgação" subtitle="Personalize e compartilhe seu site" />

      {/* Unique code */}
      {partner?.unique_code && (
        <AnimatedItem>
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20">
            <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Seu Código Único</p>
              <p className="text-2xl font-black text-orange-400 font-mono tracking-wider">#{partner.unique_code}</p>
            </div>
          </div>
        </AnimatedItem>
      )}

      {/* Display name */}
      <AnimatedItem>
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-orange-400" />Personalizar Site</h2>
          <Label className="text-zinc-400 text-xs uppercase tracking-wider mb-2 block">Nome que aparece no site</Label>
          <div className="flex gap-3">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 rounded-xl flex-1" placeholder="Seu nome ou apelido" />
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2 px-5">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </div>
          <p className="text-zinc-600 text-xs mt-2">Este é o nome que seus visitantes verão no site de divulgação.</p>
        </div>
      </AnimatedItem>

      {/* Links */}
      <AnimatedItem>
        <div className="space-y-3">
          {links.map(({ id, label, desc, value, icon: Icon }) => (
            <div key={id} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-orange-400" />
                  <div>
                    <p className="text-white font-semibold text-sm">{label}</p>
                    <p className="text-zinc-500 text-xs">{desc}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input readOnly value={value || "Carregando..."} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-300 text-xs truncate" />
                <Button onClick={() => copyLink(id)} variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 rounded-xl gap-2 shrink-0">
                  {copied === id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === id ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AnimatedItem>

      {/* Share actions */}
      <AnimatedItem>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={shareOnWhatsApp}
            className="p-4 rounded-2xl bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Compartilhar no WhatsApp</p>
              <p className="text-green-200 text-xs">Enviar convite com seu link</p>
            </div>
          </motion.button>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={() => window.open(getSiteUrl(), '_blank')}
            className="p-4 rounded-2xl bg-orange-500 hover:bg-orange-600 transition-colors flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Ver Meu Site</p>
              <p className="text-orange-100 text-xs">Abrir em nova aba</p>
            </div>
          </motion.button>
        </div>
      </AnimatedItem>

      {/* Preview */}
      <AnimatedItem>
        <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h2 className="text-white font-bold">Prévia do Site</h2>
          </div>
          <div className="p-4">
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="bg-zinc-900 px-4 py-2.5 flex items-center gap-2 border-b border-zinc-800">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 bg-zinc-800 rounded px-3 py-1 text-xs text-zinc-500 truncate ml-2">{getSiteUrl()}</div>
              </div>
              <div className="bg-black p-5 space-y-4">
                <div className="text-center border-b border-orange-500/20 pb-4">
                  <p className="text-2xl font-bold text-orange-500">Sociedade de</p>
                  <p className="text-2xl font-bold text-white">Consumidores</p>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-zinc-400 text-sm">Indicador</p>
                  <p className="text-xl font-bold text-white">{partner?.display_name || partner?.full_name}</p>
                  <div className="inline-block bg-orange-500 text-white font-bold py-2 px-8 rounded-full text-sm">CADASTRE-SE JÁ</div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => window.open(getSiteUrl(), '_blank')} variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300 text-xs gap-1">
                <ExternalLink className="w-3 h-3" /> Ver site completo
              </Button>
            </div>
          </div>
        </div>
      </AnimatedItem>
    </AnimatedPage>
  );
}