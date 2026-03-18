import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner } from "@/components/PageWrapper";
import { Download, Copy, Check, Image, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";

const POSTS = [
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/20b4345f5_365958ae-9776-4bb5-b766-68937e89a0c5.jpg", title: "Compras com Bônus" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/c0ce9ef5f_8953876b-202d-4988-98ab-70eac0e8101b.jpg", title: "Preocupado com suas contas?" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/bbc180031_ae33b502-f8a7-41e2-bc92-2512dd74b6a9.jpg", title: "Pague IPTU e Contas com Bônus" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/88538eb04_c11cd848-12d1-44c9-beca-fd500e720a91.jpg", title: "Anda preocupado com suas contas?" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/ae42b05b9_c7857ad2-c353-42c8-803d-7f09ba642a1d.jpg", title: "Tem Mais de 15 anos? Compre o que quiser" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/95156ca18_cc9b67b2-b7ee-44bc-8128-25feb6f9a328.jpg", title: "Shopee, Mercado Livre e Amazon com Bônus" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/b7c901305_d4eaa9a8-f709-4688-9cbd-ed3939f35532.jpg", title: "IPTU, Parcelas do Imóvel e Reformas" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/69615d7d8_de7aa310-5b0e-4a3f-a8ba-e7eec7a3fee5.jpg", title: "Tem contas a pagar? (NET, SKY, Enel)" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/21f6013db_ded710a3-0d76-48ee-a13d-e0ad62ef9fe1.jpg", title: "Tem contas a pagar? (Cemig, Claro, Enel)" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/aa8029cc9_e0baf98f-2a42-4abe-99c8-eeca124e30a5.jpg", title: "Pague IPTU na Praia com Bônus" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/451d3c102_eb0bf3b1-a0c5-4f6e-b915-7b75225bae15.jpg", title: "Tem Mais de 15 anos? Eletrodomésticos" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/ca2d1c991_2e746afa-cf6d-47b8-a438-2f83d6d6ab2f.jpg", title: "Tem Mais de 15 anos? Moda e Acessórios" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/dde98526b_6f4758ce-6a0f-4eee-bbb2-fcf4640c8041.jpg", title: "Pague IPVA, Multas e Parcelas do Veículo" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/ef14f3505_9ba9db8e-2219-4830-b58f-5bdd34ba3349.jpg", title: "Tem Mais de 15 anos? Brinquedos e Games" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/d0d6ebb12_9e30ddef-1cc7-49ce-9e33-a48844280899.jpg", title: "Compra o que quiser e paga com bônus" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/bfccb89e9_2776f9f9-9c6d-4e54-9c17-53d6d60c0e82.jpg", title: "Compras em qualquer comércio" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/b91bd6fbf_3046de5a-5c37-42fa-847f-1ef6c18cfda7.jpg", title: "Pague suas contas com bônus (cachorro)" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/3a16c7415_3179a69b-c172-42f1-946c-634198449a99.jpg", title: "Tem Mais de 15 anos? Eletrônicos" },
  { url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697d0116fccbb3128aabd5bf/9a722e4d6_38553c02-e29d-4e38-8b7c-105fad11a4d2.jpg", title: "Compras com bônus (só celular)" },
];

const FRASES = [
  { title: "Sonhos e Objetivos", text: `Tem mais de 15 anos?\nQuer comprar aquele iPhone última geração? Quer realizar o sonho de viajar para o exterior? Fazer aquele curso ou faculdade? Então venha para a SOCIEDADE de CONSUMIDORES, aqui, você poderá realizar seus SONHOS com seus BÔNUS.\nAcesse o site e comece hoje mesmo!` },
  { title: "Qual é seu sonho?", text: `Qual é seu sonho? Comprar um carro, uma casa ou apartamento, viajar para o exterior, fazer aquele cruzeiro ou mudar seu estilo de vida para melhor?\nVenha para a Maior Sociedade de Consumidores do Brasil!\nAqui seus objetivos e sonhos podem se tornar realidade. Somos uma plataforma geradora de Bônus e com eles, você conquista o que quiser.\nSaiba Mais!` },
  { title: "Indicação de amigo", text: `Um amigo me indicou a SOCIEDADE de CONSUMIDORES. Aqui posso fazer minhas compras e pagar com os BÔNUS gerados pela plataforma. Achei top demais! Visite meu site e descubra mais!` },
  { title: "Peço sua opinião", text: `Preciso de sua opinião sobre uma SOCIEDADE de CONSUMIDORES. Foi um amigo que me indicou e eu gostei. Esta plataforma está gerando BÔNUS e com eles eu posso comprar o que quiser. Visite meu site.` },
  { title: "Revolucionando as redes sociais", text: `Eu me cadastrei e estou gostando muito deste projeto que está revolucionando as redes sociais, tenho certeza que você vai gostar também. A SOCIEDADE DE CONSUMIDORES está crescendo a cada dia, pois gera BÔNUS para compras de diversos produtos.` },
  { title: "Pague contas com bônus", text: `Eu faço parte da Sociedade de Consumidores, aqui consigo pagar IPTU, IPVA, Parcelas do meu carro, Multas, Contas de água, Luz, Gás e Internet com meus bônus. Cadastre-se Já!` },
  { title: "Preocupado com suas contas?", text: `Preocupado com suas contas? Já pensou em poder comprar o que você quiser, sem usar dinheiro, pagar boletos ou usar seu cartão de crédito? Venha para a SOCIEDADE de CONSUMIDORES. Somos uma plataforma inovadora, única e exclusiva na geração BÔNUS que você usa para compras na internet, lojas físicas e muito mais. Visite meu site.` },
  { title: "BÔNUS vs Dinheiro", text: `Entre gastar seu dinheiro ou COMPRAR com BÔNUS, qual você prefere? Conheça a SOCIEDADE DE CONSUMIDORES e pare definitivamente de gastar seu dinheiro fazendo compras. Visite meu site.` },
];

export default function Marketing() {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) setPartner(partners[0]);
    } catch { }
    finally { setLoading(false); }
  };

  const siteLink = partner?.unique_code ? `${window.location.origin}/PartnerSite?p=${partner.unique_code}` : null;

  const copyText = (text, index) => {
    const fullText = siteLink ? `${text}\n\n👉 ${siteLink}` : text;
    navigator.clipboard.writeText(fullText);
    setCopiedIndex(index); toast.success("Texto copiado!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyLink = () => {
    if (!siteLink) return;
    navigator.clipboard.writeText(siteLink);
    setCopiedIndex('link'); toast.success("Link copiado!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadImage = async (url, title, index) => {
    setDownloading(index);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(blobUrl); a.remove();
      toast.success("Download iniciado!");
    } catch { toast.error("Erro ao baixar imagem"); }
    finally { setDownloading(null); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AnimatedPage>
      <PageHeader title="Materiais de Divulgação" subtitle="Posts para baixar e divulgar nas redes sociais" />

      {/* Link */}
      <AnimatedItem>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 font-semibold text-sm">Seu Link de Divulgação</span>
          </div>
          {siteLink ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input readOnly value={siteLink} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm truncate" />
              <Button onClick={copyLink} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2 shrink-0">
                {copiedIndex === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedIndex === 'link' ? 'Copiado!' : 'Copiar Link'}
              </Button>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">Complete seu cadastro para obter seu link.</p>
          )}
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <Tabs defaultValue="posts">
          <TabsList className="bg-zinc-900 border border-white/[0.05] mb-6">
            <TabsTrigger value="posts" className="data-[state=active]:bg-orange-500 gap-2">
              <Image className="w-4 h-4" /> Posts ({POSTS.length})
            </TabsTrigger>
            <TabsTrigger value="textos" className="data-[state=active]:bg-orange-500 gap-2">
              <MessageSquare className="w-4 h-4" /> Frases ({FRASES.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts">
            <p className="text-zinc-500 text-sm mb-4">Baixe as imagens e compartilhe nas suas redes sociais.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {POSTS.map((post, index) => (
                <motion.div key={index} whileHover={{ scale: 1.02 }}
                  className="rounded-2xl bg-zinc-900 border border-white/[0.05] overflow-hidden group cursor-pointer">
                  <div className="relative">
                    <img src={post.url} alt={post.title} className="w-full object-cover" style={{ aspectRatio: '9/16' }} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center">
                      <Button onClick={() => downloadImage(post.url, post.title, index)} disabled={downloading === index}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-orange-500 hover:bg-orange-600 gap-2">
                        {downloading === index ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                        Baixar
                      </Button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-white text-xs font-medium line-clamp-2 mb-2">{post.title}</p>
                    <Button onClick={() => downloadImage(post.url, post.title, index)} disabled={downloading === index}
                      className="w-full bg-orange-500 hover:bg-orange-600 h-8 text-xs gap-1 rounded-lg">
                      {downloading === index ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-3 h-3" />}
                      {downloading === index ? 'Baixando...' : 'Baixar'}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="textos">
            <p className="text-zinc-500 text-sm mb-4">
              Copie e use junto com os posts. {siteLink && "Seu link será adicionado automaticamente."}
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {FRASES.map((frase, index) => (
                <div key={index} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
                  <h3 className="text-orange-400 font-semibold text-sm mb-3">{frase.title}</h3>
                  <div className="bg-zinc-800/60 rounded-xl p-3 mb-3">
                    <pre className="text-zinc-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">{frase.text}</pre>
                    {siteLink && <p className="text-orange-400 text-xs mt-2">👉 {siteLink}</p>}
                  </div>
                  <Button onClick={() => copyText(frase.text, index)} className="w-full bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
                    {copiedIndex === index ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedIndex === index ? 'Copiado!' : 'Copiar Texto + Link'}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}