import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap, ExternalLink, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MeusCursos() {
  const [compras, setCompras] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        const partner = partners[0];
        const minhasCompras = await base44.entities.ComprasCursosEAD.filter({ 
          usuarioId: partner.id 
        });
        setCompras(minhasCompras);
      }

      // Buscar configurações
      const configs = await base44.entities.ConfiguracoesEAD.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcessarCurso = () => {
    if (config?.urlRedirecionamentoEAD) {
      window.open(config.urlRedirecionamentoEAD, '_blank');
    }
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      LIBERADO: { color: "bg-green-500/20 text-green-500", label: "LIBERADO" },
      PROCESSANDO: { color: "bg-yellow-500/20 text-yellow-500", label: "PROCESSANDO" },
      ERRO: { color: "bg-red-500/20 text-red-500", label: "ERRO" }
    };
    const { color, label } = statusConfig[status] || statusConfig.PROCESSANDO;
    return <Badge className={color}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const cursosLiberados = compras.filter(c => c.status === 'LIBERADO');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Meus Cursos</h1>
        <p className="text-gray-400">Acesse os cursos que você já adquiriu</p>
      </div>

      {cursosLiberados.length === 0 ? (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-12 text-center">
            <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Você ainda não comprou nenhum curso.</p>
            <p className="text-gray-500 text-sm mt-2">Visite a loja de cursos para começar!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursosLiberados.map((compra) => (
            <Card key={compra.id} className="bg-zinc-950 border-orange-500/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-orange-500" />
                    {compra.cursoNome}
                  </CardTitle>
                  <StatusBadge status={compra.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-gray-500 text-xs">Data da Compra</p>
                  <p className="text-white text-sm">
                    {new Date(compra.dataCompra).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Valor Pago</p>
                  <p className="text-orange-500 font-semibold">
                    {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(compra.valorBonus)} bônus
                  </p>
                </div>
                {config?.urlRedirecionamentoEAD && (
                  <Button
                    onClick={handleAcessarCurso}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Acessar Curso
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Compras com erro ou processando */}
      {compras.filter(c => c.status !== 'LIBERADO').length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Outras Compras</h2>
          <div className="grid grid-cols-1 gap-4">
            {compras.filter(c => c.status !== 'LIBERADO').map((compra) => (
              <Card key={compra.id} className="bg-zinc-950 border-yellow-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{compra.cursoNome}</p>
                      <p className="text-gray-500 text-sm">
                        {new Date(compra.dataCompra).toLocaleDateString('pt-BR')}
                      </p>
                      {compra.mensagemErro && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-red-400 text-xs">{compra.mensagemErro}</p>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={compra.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}