import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { Loader2, GraduationCap, ShoppingCart, CheckCircle2, BookOpen, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";

const URL_ACESSO = "https://globaleadflix.com.br/login";
const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export default function LojaCursos() {
  const [cursos, setCursos] = useState([]);
  const [partner, setPartner] = useState(null);
  const [statusCursos, setStatusCursos] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingCursoId, setProcessingCursoId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      const p = partners[0] || null; setPartner(p);
      const [allCursos, todasCompras] = await Promise.all([
        base44.entities.CursosEAD.filter({ ativo: true }),
        p ? base44.entities.ComprasCursosEAD.filter({ usuarioId: p.id }) : Promise.resolve([])
      ]);
      setCursos(allCursos);
      const mapa = {};
      for (const c of todasCompras) {
        if (c.status === 'LIBERADO') mapa[c.cursoId] = 'liberado';
        else if (c.status === 'PROCESSANDO') mapa[c.cursoId] = 'processando';
        else if (c.status === 'ERRO') mapa[c.cursoId] = 'erro';
      }
      setStatusCursos(mapa);
    } catch { }
    finally { setLoading(false); }
  };

  const handleComprarClick = (curso) => {
    if (!partner) { toast.error("Complete seu cadastro para comprar cursos."); return; }
    if (statusCursos[curso.id] === 'liberado' || processingCursoId === curso.id) return;
    if ((partner.bonus_for_purchases || 0) < curso.valorBonus) { toast.error("Saldo de bônus insuficiente."); return; }
    setSelectedCurso(curso); setDialogOpen(true);
  };

  const handleConfirmarCompra = async () => {
    if (!partner || !selectedCurso) return;
    if ((partner.bonus_for_purchases || 0) < selectedCurso.valorBonus) { toast.error("Saldo insuficiente."); return; }
    if (statusCursos[selectedCurso.id] === 'liberado') { toast.error("Você já possui este curso."); setDialogOpen(false); return; }
    if (processingCursoId === selectedCurso.id) return;
    setProcessing(true); setProcessingCursoId(selectedCurso.id); setDialogOpen(false);
    setStatusCursos(prev => ({ ...prev, [selectedCurso.id]: 'processando' }));
    try {
      const comprasExist = await base44.entities.ComprasCursosEAD.filter({ usuarioId: partner.id, cursoId: selectedCurso.id, status: 'LIBERADO' });
      if (comprasExist.length > 0) { toast.error("Você já possui este curso."); setStatusCursos(prev => ({ ...prev, [selectedCurso.id]: 'liberado' })); return; }
      const [partnerFresco] = await base44.entities.Partner.filter({ id: partner.id });
      const saldoAtual = partnerFresco?.bonus_for_purchases || 0;
      if (saldoAtual < selectedCurso.valorBonus) { toast.error(`Saldo insuficiente: ${fmt(saldoAtual)}`); setPartner(p => ({ ...p, bonus_for_purchases: saldoAtual })); return; }
      const compra = await base44.entities.ComprasCursosEAD.create({
        usuarioId: partner.id, usuarioEmail: partnerFresco.created_by || partner.created_by,
        cursoId: selectedCurso.id, cursoNome: selectedCurso.nome,
        dataCompra: new Date().toISOString(), status: 'PROCESSANDO', valorBonus: selectedCurso.valorBonus
      });
      const response = await base44.functions.invoke('liberarCursoIndividual', { compraId: compra.id, cursoId: selectedCurso.id });
      if (response.data?.success) {
        setStatusCursos(prev => ({ ...prev, [selectedCurso.id]: 'liberado' }));
        setPartner(prev => ({ ...prev, bonus_for_purchases: saldoAtual - selectedCurso.valorBonus, total_spent_purchases: (prev.total_spent_purchases || 0) + selectedCurso.valorBonus }));
        toast.success("🎉 Curso liberado com sucesso! Redirecionando...");
        setTimeout(() => window.open(URL_ACESSO, '_blank'), 1500);
      } else {
        setStatusCursos(prev => ({ ...prev, [selectedCurso.id]: 'erro' }));
        toast.error(response.data?.error || "Erro ao liberar acesso.");
      }
    } catch {
      setStatusCursos(prev => ({ ...prev, [selectedCurso.id]: 'erro' }));
      toast.error("Erro ao processar compra. Tente novamente.");
    } finally { setProcessing(false); setProcessingCursoId(null); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AnimatedPage>
      <PageHeader title="Cursos EAD" subtitle="Adquira cursos usando seus bônus e aprenda quando quiser" />

      {partner && (
        <AnimatedItem>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Bônus disponível para compras</p>
              <p className="text-orange-400 font-black text-2xl">{fmt(partner.bonus_for_purchases)}</p>
            </div>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        {cursos.length === 0 ? <EmptyState icon={GraduationCap} message="Nenhum curso disponível no momento." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cursos.map((curso) => {
              const status = statusCursos[curso.id];
              const semSaldo = (partner?.bonus_for_purchases || 0) < curso.valorBonus;
              const isProcessando = processingCursoId === curso.id || status === 'processando';

              const borderClass =
                status === 'liberado' ? "border-green-500/25" :
                isProcessando ? "border-yellow-500/25" :
                status === 'erro' ? "border-red-500/25" :
                "border-white/[0.05] hover:border-orange-500/25";

              return (
                <motion.div key={curso.id} whileHover={{ y: -2 }}
                  className={`rounded-2xl bg-zinc-900/60 border transition-all overflow-hidden flex flex-col ${borderClass}`}>
                  {curso.imagem ? (
                    <img src={curso.imagem} alt={curso.nome} className="w-full h-44 object-cover" />
                  ) : (
                    <div className="w-full h-44 bg-zinc-800 flex items-center justify-center">
                      <GraduationCap className="w-14 h-14 text-orange-500/20" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-bold text-sm leading-tight">{curso.nome}</h3>
                      {status === 'liberado' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-green-500/10 text-green-400 border-green-500/20 shrink-0 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Adquirido</span>
                      ) : isProcessando ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shrink-0 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Processando</span>
                      ) : status === 'erro' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20 shrink-0">Erro</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0 flex items-center gap-1"><BookOpen className="w-3 h-3" />Disponível</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs line-clamp-3 flex-1">{curso.descricao || "Curso de qualidade para seu desenvolvimento."}</p>
                    <div>
                      <p className="text-zinc-600 text-xs">Valor em Bônus</p>
                      <p className="text-orange-400 font-black text-xl">{fmt(curso.valorBonus)}</p>
                    </div>
                    {status === 'liberado' ? (
                      <Button onClick={() => window.open(URL_ACESSO, '_blank')} className="w-full bg-green-600 hover:bg-green-700 rounded-xl gap-2"><ExternalLink className="w-4 h-4" />Acessar Curso</Button>
                    ) : isProcessando ? (
                      <Button disabled className="w-full bg-yellow-600/50 rounded-xl"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</Button>
                    ) : status === 'erro' ? (
                      <Button onClick={() => handleComprarClick(curso)} className="w-full bg-red-600 hover:bg-red-700 rounded-xl">Tentar Novamente</Button>
                    ) : (
                      <Button onClick={() => handleComprarClick(curso)} disabled={!partner || semSaldo} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl gap-2 disabled:opacity-50">
                        <ShoppingCart className="w-4 h-4" />{semSaldo ? "Saldo Insuficiente" : "Comprar com Bônus"}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatedItem>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader><DialogTitle className="text-white">Confirmar Compra</DialogTitle></DialogHeader>
          {selectedCurso && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900">
                <p className="text-zinc-500 text-xs">Curso</p>
                <p className="text-white font-semibold">{selectedCurso.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900">
                  <p className="text-zinc-500 text-xs">Valor do curso</p>
                  <p className="text-orange-400 font-bold">{fmt(selectedCurso.valorBonus)}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900">
                  <p className="text-zinc-500 text-xs">Saldo após compra</p>
                  <p className="text-white font-bold">{fmt((partner?.bonus_for_purchases || 0) - selectedCurso.valorBonus)}</p>
                </div>
              </div>
              <p className="text-zinc-500 text-sm text-center">Após a compra, você será redirecionado para acessar o curso.</p>
              <div className="flex gap-3">
                <Button onClick={() => setDialogOpen(false)} variant="outline" className="flex-1 border-zinc-700 text-zinc-300 rounded-xl" disabled={processing}>Cancelar</Button>
                <Button onClick={handleConfirmarCompra} className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl" disabled={processing}>
                  {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</> : "Confirmar Compra"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}