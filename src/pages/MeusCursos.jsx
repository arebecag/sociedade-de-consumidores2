import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { GraduationCap, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function MeusCursos() {
  const [compras, setCompras] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        const minhasCompras = await base44.entities.ComprasCursosEAD.filter({ usuarioId: partners[0].id });
        setCompras(minhasCompras);
      }
      const configs = await base44.entities.ConfiguracoesEAD.list();
      if (configs.length > 0) setConfig(configs[0]);
    } catch { }
    finally { setLoading(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

  if (loading) return <LoadingSpinner />;

  const cursosLiberados = compras.filter(c => c.status === 'LIBERADO');
  const outrasCompras = compras.filter(c => c.status !== 'LIBERADO');

  const StatusBadge = ({ status }) => {
    const cfg = {
      LIBERADO:    { cls: "bg-green-500/10 text-green-400 border-green-500/20",   Icon: CheckCircle2, label: "Liberado" },
      PROCESSANDO: { cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", Icon: Loader2,     label: "Processando" },
      ERRO:        { cls: "bg-red-500/10 text-red-400 border-red-500/20",          Icon: AlertCircle, label: "Erro" },
    };
    const { cls, Icon, label } = cfg[status] || cfg.PROCESSANDO;
    return <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}><Icon className={`w-3 h-3 ${status === 'PROCESSANDO' ? 'animate-spin' : ''}`} />{label}</span>;
  };

  return (
    <AnimatedPage>
      <PageHeader title="Meus Cursos" subtitle="Acesse os cursos que você já adquiriu" />

      {cursosLiberados.length === 0 ? (
        <AnimatedItem>
          <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] p-4">
            <EmptyState icon={GraduationCap} message="Você ainda não adquiriu nenhum curso." sub="Visite a loja de cursos para começar!" />
          </div>
        </AnimatedItem>
      ) : (
        <AnimatedItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cursosLiberados.map((compra) => (
              <motion.div key={compra.id} whileHover={{ y: -2 }}
                className="p-5 rounded-2xl bg-zinc-900/60 border border-green-500/20 hover:border-green-500/30 transition-all flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold">{compra.cursoNome}</h3>
                  <p className="text-zinc-500 text-xs mt-1">Adquirido em {new Date(compra.dataCompra).toLocaleDateString('pt-BR')}</p>
                  <p className="text-orange-400 text-sm font-semibold mt-1">{fmt(compra.valorBonus)} bônus</p>
                </div>
                <StatusBadge status={compra.status} />
                {config?.urlRedirecionamentoEAD && (
                  <Button onClick={() => window.open(config.urlRedirecionamentoEAD, '_blank')}
                    className="w-full bg-green-600 hover:bg-green-700 rounded-xl gap-2">
                    <ExternalLink className="w-4 h-4" />Acessar Curso
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </AnimatedItem>
      )}

      {outrasCompras.length > 0 && (
        <AnimatedItem>
          <h2 className="text-white font-bold mb-3">Outras Compras</h2>
          <div className="space-y-3">
            {outrasCompras.map((compra) => (
              <div key={compra.id} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{compra.cursoNome}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{new Date(compra.dataCompra).toLocaleDateString('pt-BR')}</p>
                  {compra.mensagemErro && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-red-500/5 rounded-lg border border-red-500/15">
                      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-xs">{compra.mensagemErro}</p>
                    </div>
                  )}
                </div>
                <StatusBadge status={compra.status} />
              </div>
            ))}
          </div>
        </AnimatedItem>
      )}
    </AnimatedPage>
  );
}