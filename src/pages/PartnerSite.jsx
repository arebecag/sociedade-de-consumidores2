import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, Mail, AlertCircle, LogIn } from "lucide-react";

export default function PartnerSite() {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartner();
  }, []);

  const loadPartner = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("p");
      
      if (!code) {
        setLoading(false);
        return;
      }

      // Usa backend function com service role — funciona sem autenticação
      const res = await base44.functions.invoke('getPartnerByCode', { code });
      if (res.data && res.data.id) {
        setPartner(res.data);
      }
    } catch (err) {
      console.error("Erro ao carregar parceiro:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Página não encontrada</h1>
          <p className="text-gray-400">O parceiro solicitado não existe.</p>
        </div>
      </div>
    );
  }

  const registerUrl = `https://3x3sc.com.br/Register?ref=${partner.unique_code}`;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="py-8 px-4 text-center border-b border-orange-500/20 relative">
        <div className="absolute top-4 right-4">
          <Link to={createPageUrl("Register")}>
            <Button
              variant="outline"
              className="border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          </Link>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-orange-500">Sociedade de</h1>
        <h1 className="text-4xl md:text-5xl font-bold text-white">Consumidores</h1>
      </header>

      {/* Contact Buttons - visible at top */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center py-4 px-4 bg-zinc-950/80 border-b border-orange-500/10">
        <a
          href="https://wa.me/5511951453200"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
        >
          <Phone className="w-4 h-4 text-white" />
          <span className="text-white font-semibold">(11) 95145-3200 – WhatsApp</span>
        </a>
        <a
          href="mailto:suporte@sociedadedeconsumidores.com.br"
          className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors text-sm"
        >
          <Mail className="w-4 h-4 text-white" />
          <span className="text-white font-semibold">suporte@sociedadedeconsumidores.com.br</span>
        </a>
      </div>

      {/* Partner Name */}
      <section className="py-12 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-400 text-lg mb-2">Indicador</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
            {partner.display_name || partner.full_name}
          </h2>
          
          {/* CTA Button */}
          <Button
            onClick={() => window.location.href = registerUrl}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 px-12 text-xl rounded-full shadow-lg shadow-orange-500/30 transition-all hover:scale-105"
          >
            CADASTRE-SE JÁ
          </Button>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="aspect-video rounded-2xl overflow-hidden border-2 border-orange-500/30">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/4nJcg2rVM40"
              title="Sociedade de Consumidores"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </section>

      {/* Second CTA */}
      <section className="py-8 px-4 text-center">
        <Button
          onClick={() => window.location.href = registerUrl}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 px-12 text-xl rounded-full shadow-lg shadow-orange-500/30 transition-all hover:scale-105"
        >
          CADASTRE-SE JÁ
        </Button>
      </section>

      {/* Content Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto bg-zinc-950 rounded-3xl p-8 md:p-12 border border-orange-500/20">
          <div className="prose prose-invert max-w-none">
            <p className="text-xl md:text-2xl text-white font-semibold mb-6">
              Sejam Bem vindos a maior <span className="text-orange-500">SOCIEDADE DE CONSUMIDORES</span> do BRASIL.
            </p>
            
            <p className="text-gray-300 mb-6">
              Somos uma empresa <strong className="text-white">REGISTRADA</strong>, <strong className="text-white">PATENTEADA</strong> e especializada em vendas online e geração de <strong className="text-orange-500">BÔNUS</strong>.
            </p>
            
            <p className="text-gray-300 mb-6">
              Ao se cadastrar como <strong className="text-white">PARCEIRO</strong> você recebe o direito de cadastrar novos clientes e quando eles comprarem, nossa plataforma gera para você <strong className="text-orange-500">BÔNUS de ATÉ 40%</strong>.
            </p>
            
            <p className="text-gray-300 mb-6">
              Parte do <strong className="text-orange-500">BÔNUS</strong> você <strong className="text-white">TROCA por PRODUTOS ou SERVIÇOS</strong>, a outra parte será depositada para você na sua conta bancária.
            </p>
            
            <p className="text-gray-300 mb-6">
              Pague seus <strong className="text-white">BOLETOS</strong> de <strong className="text-white">CONDOMÍNIO</strong>, seu <strong className="text-white">ALUGUEL</strong> e as contas de <strong className="text-white">ÁGUA, LUZ e GÁS</strong> com seus <strong className="text-orange-500">BÔNUS</strong>.
            </p>
            
            <p className="text-gray-300 mb-6">
              Faça <strong className="text-white">COMPRAS</strong> com <strong className="text-white">CÓDIGO QR</strong>, <strong className="text-white">CÓDIGO DE BARRAS</strong> ou <strong className="text-white">PIX</strong> pagando com seus bônus acumulados.
            </p>
            
            <p className="text-gray-300 mb-6">
              Temos diversos <strong className="text-white">PRODUTOS DIGITAIS</strong>, Tele Consultas com: <strong className="text-white">MÉDICOS, PSICÓLOGOS e NUTRICIONISTAS</strong>.
            </p>
            
            <p className="text-gray-300 mb-6">
              <strong className="text-white">CURSOS ONLINE</strong>, <strong className="text-white">FACULDADE EAD</strong> e muito mais!
            </p>
            
            <p className="text-gray-300 mb-6">
              Você terá gratuitamente um <strong className="text-orange-500">SITE INDIVIDUAL e PERSONALIZADO</strong> igual a este, para você divulgar e cadastrar seus clientes.
            </p>
            
            <p className="text-xl text-white font-semibold mb-8">
              Conquiste uma renda de mais de <span className="text-orange-500">R$ 8.000,00 por mês</span>, com os <span className="text-orange-500">BÔNUS</span> de seus clientes.
            </p>
            
            {/* Steps */}
            <div className="bg-black/50 rounded-2xl p-6 md:p-8 mb-8">
              <h3 className="text-2xl font-bold text-orange-500 mb-6">Siga os 4 passos simples para seu sucesso!</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <p className="text-gray-300 pt-2">Cadastre-se agora mesmo.</p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <p className="text-gray-300 pt-2">Entre no seu <strong className="text-white">ESCRITÓRIO VIRTUAL</strong>, e personalize seu <strong className="text-white">SITE de DIVULGAÇÃO</strong> com seu nome ou apelido.</p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">3</span>
                  </div>
                  <p className="text-gray-300 pt-2">Inicie <strong className="text-white">IMEDIATAMENTE</strong> de forma gratuita a divulgação do seu site para sua <strong className="text-white">FAMÍLIA, PARENTES, AMIGOS e CONHECIDOS</strong>. Use suas redes sociais, assim você vai lotar sua loja de clientes.</p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">4</span>
                  </div>
                  <p className="text-gray-300 pt-2">Faça sua primeira compra no valor mínimo de <strong className="text-orange-500">R$ 125,00</strong> de <strong className="text-white">PRODUTOS DIGITAIS</strong> para você ficar <strong className="text-white">ATIVO</strong> na <strong className="text-orange-500">SOCIEDADE DE CONSUMIDORES</strong>.</p>
                </div>
              </div>
            </div>
            
            <p className="text-xl text-center text-white font-semibold">
              Bem vindos ao futuro, bem vindos a <span className="text-orange-500">SOCIEDADE DE CONSUMIDORES</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-white mb-6">Suporte</h3>
          
          <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
            <a
              href="https://wa.me/5511951453200"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 rounded-xl transition-colors"
            >
              <Phone className="w-6 h-6 text-white" />
              <div className="text-left">
                <p className="text-white font-semibold">(11) 95145-3200</p>
                <p className="text-green-200 text-sm">Somente WhatsApp</p>
              </div>
            </a>
            
            <a
              href="mailto:suporte@sociedadedeconsumidores.com.br"
              className="flex items-center gap-3 px-6 py-4 bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors"
            >
              <Mail className="w-6 h-6 text-white" />
              <div className="text-left">
                <p className="text-white font-semibold">suporte@sociedadedeconsumidores.com.br</p>
                <p className="text-orange-200 text-sm">E-mail</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-orange-500/20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500">
            © {new Date().getFullYear()} Sociedade de Consumidores. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}