import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, ShoppingCart, CheckCircle2, BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const URL_ACESSO = "https://globaleadflix.com.br/login";
const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// Status por cursoId: 'liberado' | 'processando' | 'erro'
export default function LojaCursos() {
  const [cursos, setCursos] = useState([]);
  const [partner, setPartner] = useState(null);
  const [statusCursos, setStatusCursos] = useState({}); // cursoId -> 'liberado' | 'processando' | 'erro'
  const [loading, setLoading] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingCursoId, setProcessingCursoId] = useState(null); // lock por curso

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      const p = partners[0] || null;
      setPartner(p);

      const [allCursos, todasCompras] = await Promise.all([
        base44.entities.CursosEAD.filter({ ativo: true }),
        p ? base44.entities.ComprasCursosEAD.filter({ usuarioId: p.id, status: 'LIBERADO' }) : Promise.resolve([])
      ]);

      setCursos(allCursos);

      const mapa = {};
      for (const c of todasCompras) {
        mapa[c.cursoId] = true;
      }
      setComprasLiberadas(mapa);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComprarClick = (curso) => {
    if (!partner) {
      toast.error("Complete seu cadastro para comprar cursos.");
      return;
    }
    if (comprasLiberadas[curso.id]) return;

    if ((partner.bonus_for_purchases || 0) < curso.valorBonus) {
      toast.error("Saldo de bônus insuficiente para este curso.");
      return;
    }

    setSelectedCurso(curso);
    setDialogOpen(true);
  };

  const handleConfirmarCompra = async () => {
    if (!partner || !selectedCurso) return;

    // Checar saldo
    if ((partner.bonus_for_purchases || 0) < selectedCurso.valorBonus) {
      toast.error("Saldo de bônus insuficiente.");
      return;
    }

    // Checar se já liberado
    if (comprasLiberadas[selectedCurso.id]) {
      toast.error("Você já possui este curso.");
      setDialogOpen(false);
      return;
    }

    setProcessing(true);
    try {
      // Verificar novamente no banco (segurança)
      const comprasExistentes = await base44.entities.ComprasCursosEAD.filter({
        usuarioId: partner.id,
        cursoId: selectedCurso.id,
        status: 'LIBERADO'
      });
      if (comprasExistentes.length > 0) {
        toast.error("Você já possui este curso.");
        setDialogOpen(false);
        return;
      }

      // Debitar bônus
      await base44.entities.Partner.update(partner.id, {
        bonus_for_purchases: (partner.bonus_for_purchases || 0) - selectedCurso.valorBonus,
        total_spent_purchases: (partner.total_spent_purchases || 0) + selectedCurso.valorBonus
      });

      // Criar registro de compra
      const compra = await base44.entities.ComprasCursosEAD.create({
        usuarioId: partner.id,
        usuarioEmail: partner.created_by,
        cursoId: selectedCurso.id,
        cursoNome: selectedCurso.nome,
        dataCompra: new Date().toISOString(),
        status: 'PROCESSANDO',
        valorBonus: selectedCurso.valorBonus
      });

      // Liberar acesso via função
      const response = await base44.functions.invoke('liberarCursoIndividual', {
        compraId: compra.id,
        cursoId: selectedCurso.id
      });

      if (response.data?.success) {
        toast.success("Curso liberado! Redirecionando...");
        setDialogOpen(false);
        setComprasLiberadas(prev => ({ ...prev, [selectedCurso.id]: true }));
        setPartner(prev => ({
          ...prev,
          bonus_for_purchases: (prev.bonus_for_purchases || 0) - selectedCurso.valorBonus
        }));
        setTimeout(() => {
          window.open(URL_ACESSO, '_blank');
        }, 1000);
      } else {
        toast.error(response.data?.error || "Erro ao liberar acesso.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao processar compra. Tente novamente.");
    } finally {
      setProcessing(false);
    }
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
        <h1 className="text-3xl font-bold text-white">Cursos EAD</h1>
        <p className="text-gray-400">Adquira cursos usando seus bônus e aprenda quando quiser</p>
      </div>

      {/* Saldo */}
      {partner && (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Bônus disponível para compras</p>
              <p className="text-2xl font-bold text-orange-500">{fmt(partner.bonus_for_purchases)}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-orange-500 opacity-60" />
          </CardContent>
        </Card>
      )}

      {/* Grid de cursos */}
      {cursos.length === 0 ? (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-12 text-center">
            <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum curso disponível no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursos.map((curso) => {
            const jaAdquirido = !!comprasLiberadas[curso.id];
            const semSaldo = (partner?.bonus_for_purchases || 0) < curso.valorBonus;

            return (
              <Card
                key={curso.id}
                className={`bg-zinc-950 border transition-all overflow-hidden flex flex-col ${
                  jaAdquirido ? "border-green-500/30" : "border-orange-500/20 hover:border-orange-500/40"
                }`}
              >
                {/* Imagem ou placeholder */}
                {curso.imagem ? (
                  <img src={curso.imagem} alt={curso.nome} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-zinc-900 flex items-center justify-center">
                    <GraduationCap className="w-16 h-16 text-orange-500/20" />
                  </div>
                )}

                <CardContent className="p-5 flex flex-col flex-1 space-y-3">
                  {/* Status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-semibold text-lg leading-tight">{curso.nome}</h3>
                    {jaAdquirido ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Adquirido
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0">
                        <BookOpen className="w-3 h-3 mr-1" />
                        Disponível
                      </Badge>
                    )}
                  </div>

                  <p className="text-gray-400 text-sm line-clamp-3 flex-1">
                    {curso.descricao || "Curso de qualidade para seu desenvolvimento."}
                  </p>

                  {/* Valor */}
                  <div>
                    <p className="text-gray-500 text-xs">Valor em Bônus</p>
                    <p className="text-orange-500 font-bold text-xl">{fmt(curso.valorBonus)}</p>
                  </div>

                  {/* Botão */}
                  {jaAdquirido ? (
                    <Button
                      onClick={() => window.open(URL_ACESSO, '_blank')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Acessar Curso
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleComprarClick(curso)}
                      disabled={!partner || semSaldo}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {semSaldo ? "Saldo Insuficiente" : "Comprar com Bônus"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Compra</DialogTitle>
          </DialogHeader>
          {selectedCurso && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-900 rounded-lg">
                <p className="text-gray-400 text-sm">Curso</p>
                <p className="text-white font-semibold">{selectedCurso.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-xs">Valor do curso</p>
                  <p className="text-orange-500 font-bold">{fmt(selectedCurso.valorBonus)}</p>
                </div>
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-xs">Saldo após compra</p>
                  <p className="text-white font-bold">
                    {fmt((partner?.bonus_for_purchases || 0) - selectedCurso.valorBonus)}
                  </p>
                </div>
              </div>
              <p className="text-gray-400 text-sm text-center">
                Após a compra, você será redirecionado para acessar o curso.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setDialogOpen(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={processing}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarCompra}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={processing}
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</>
                  ) : (
                    "Confirmar Compra"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}