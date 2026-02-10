import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Image, Video, Share2, Copy, Check } from "lucide-react";

export default function Marketing() {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const videos = [
    {
      title: "Apresentação Sociedade de Consumidores",
      description: "Vídeo explicativo sobre como funciona o sistema",
      thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=225&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Depoimentos de Sucesso",
      description: "Vídeo com depoimentos de clientes satisfeitos",
      thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Como Indicar e Ganhar",
      description: "Tutorial passo a passo para indicar amigos",
      thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=225&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Benefícios Exclusivos",
      description: "Conheça todos os benefícios da plataforma",
      thumbnail: "https://images.unsplash.com/photo-1553729459-uj5jd8210zzz?w=400&h=225&fit=crop",
      downloadUrl: "#"
    }
  ];

  const images = [
    {
      title: "Banner para Stories",
      description: "Formato ideal para Instagram e WhatsApp Stories",
      size: "1080x1920",
      thumbnail: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&h=400&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Post para Feed",
      description: "Formato quadrado para feed do Instagram",
      size: "1080x1080",
      thumbnail: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=300&h=300&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Capa para Facebook",
      description: "Banner para capa do Facebook",
      size: "820x312",
      thumbnail: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=150&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Banner WhatsApp",
      description: "Imagem para compartilhar no WhatsApp",
      size: "1200x630",
      thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=210&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Convite Digital",
      description: "Convite para enviar por mensagem",
      size: "1080x1080",
      thumbnail: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=300&h=300&fit=crop",
      downloadUrl: "#"
    },
    {
      title: "Carrossel Explicativo",
      description: "Série de 5 imagens para carrossel",
      size: "1080x1080",
      thumbnail: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=300&h=300&fit=crop",
      downloadUrl: "#"
    }
  ];

  const textTemplates = [
    {
      title: "Texto para WhatsApp",
      text: `🚀 Você conhece a *Sociedade de Consumidores*?

É uma plataforma onde você pode:
✅ Comprar produtos digitais com desconto
✅ Pagar seus boletos com bônus
✅ Ganhar indicando amigos

${partner ? `👉 Conheça mais: ${window.location.origin}/PartnerSite?p=${partner.unique_code}` : ''}

Venha fazer parte! 💰`
    },
    {
      title: "Texto para Instagram",
      text: `Descobri uma forma incrível de economizar e ainda ganhar dinheiro! 💸

A @sociedadeconsumidores é uma plataforma que oferece:
📱 Produtos digitais exclusivos
💳 Pagamento de boletos com bônus
🤝 Bônus por indicações

Quer saber mais? Me chama no direct! 👇

#SociedadeDeConsumidores #RendaExtra #Economia`
    },
    {
      title: "Texto para Facebook",
      text: `Pessoal, vocês precisam conhecer a Sociedade de Consumidores!

É uma plataforma onde você pode economizar nas suas compras e ainda ganhar bônus indicando amigos.

Os benefícios são:
🔸 Produtos digitais com preços especiais
🔸 Use seu bônus para pagar boletos
🔸 Ganhe até 30% de bônus nas indicações

${partner ? `Saiba mais: ${window.location.origin}/PartnerSite?p=${partner.unique_code}` : ''}

Quem quiser saber mais, é só comentar aqui! 👇`
    }
  ];

  const copyText = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Materiais de Divulgação</h1>
        <p className="text-gray-400 mt-1">Baixe vídeos, imagens e textos para divulgar nas redes sociais</p>
      </div>

      <Card className="bg-zinc-900 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-orange-500 flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Seu Link do Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          {partner?.unique_code ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/PartnerSite?p=${partner.unique_code}`}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm"
              />
              <Button
                onClick={() => copyText(`${window.location.origin}/PartnerSite?p=${partner.unique_code}`, 'link')}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {copiedIndex === 'link' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedIndex === 'link' ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          ) : (
            <p className="text-gray-400">Complete seu cadastro para obter seu link do site.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="images" className="w-full">
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="images" className="data-[state=active]:bg-orange-500">
            <Image className="w-4 h-4 mr-2" />
            Imagens
          </TabsTrigger>
          <TabsTrigger value="videos" className="data-[state=active]:bg-orange-500">
            <Video className="w-4 h-4 mr-2" />
            Vídeos
          </TabsTrigger>
          <TabsTrigger value="texts" className="data-[state=active]:bg-orange-500">
            <Copy className="w-4 h-4 mr-2" />
            Textos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <Card key={index} className="bg-zinc-900 border-zinc-800 overflow-hidden">
                <div className="aspect-video bg-zinc-800 relative">
                  <img
                    src={image.thumbnail}
                    alt={image.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Image className="w-12 h-12 text-orange-500/50" />
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold">{image.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">{image.description}</p>
                  <p className="text-orange-500 text-xs mt-1">{image.size}</p>
                  <Button
                    className="w-full mt-3 bg-orange-500 hover:bg-orange-600"
                    disabled
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Em breve
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((video, index) => (
              <Card key={index} className="bg-zinc-900 border-zinc-800 overflow-hidden">
                <div className="aspect-video bg-zinc-800 relative">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Video className="w-12 h-12 text-orange-500/50" />
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold">{video.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">{video.description}</p>
                  <Button
                    className="w-full mt-3 bg-orange-500 hover:bg-orange-600"
                    disabled
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Em breve
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="texts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {textTemplates.map((template, index) => (
              <Card key={index} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{template.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-zinc-800 rounded-lg p-4 mb-4">
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                      {template.text}
                    </pre>
                  </div>
                  <Button
                    onClick={() => copyText(template.text, index)}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    {copiedIndex === index ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copiedIndex === index ? 'Copiado!' : 'Copiar Texto'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}