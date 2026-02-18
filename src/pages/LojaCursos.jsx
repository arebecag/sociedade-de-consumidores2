import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, GraduationCap, ShoppingCart, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function LojaCursos() {
  const [cursos, setCursos] = useState([]);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

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

      const allCursos = await base44.entities.CursosEAD.filter({ ativo: true });
      setCursos(allCursos);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComprarClick = (curso) => {
    setSelectedCurso(curso);
    setDialogOpen(true);
  };

  const handleConfirmarCompra = async () => {
    if (!partner || !selectedCurso) return;

    // Validações
    if (partner.bonus_for_purchases < selectedCurso.valorBonus) {
      toast.error("Bônus insuficiente para comprar este curso");
      return;
    }

    setProcessing(true);
    try {
      // Verificar se já comprou
      const comprasExistentes = await base44.entities.ComprasCursosEAD.filter({
        usuarioId: partner.id,
        cursoId: selectedCurso.id
      });

      const compraLiberada = comprasExistentes.find(c => c.status === 'LIBERADO');
      if (compraLiberada) {
        toast.error("Você já comprou este curso");
        setProcessing(false);
        return;
      }

      // Debitar bônus
      const novoSaldo = partner.bonus_for_purchases - selectedCurso.valorBonus;
      await base44.entities.Partner.update(partner.id, {
        bonus_for_purchases: novoSaldo,
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

      // Chamar função para liberar curso
      const response = await base44.functions.invoke('liberarCursoIndividual', {
        compraId: compra.id,
        cursoId: selectedCurso.id
      });

      if (response.data?.success) {
        toast.success("Curso liberado com sucesso!");
        setDialogOpen(false);
        
        // Redirecionar se houver URL
        if (response.data.urlRedirecionamento) {
          setTimeout(() => {
            window.open(response.data.urlRedirecionamento, '_blank');
          }, 1500);
        }
        
        // Redirecionar para Meus Cursos
        setTimeout(() => {
          window.location.href = createPageUrl("MeusCursos");
        }, 2000);
      } else {
        toast.error(response.data?.error || "Erro ao liberar acesso. Nossa equipe já foi notificada.");
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
        <p className="text-gray-400">Compre cursos usando seus bônus</p>
      </div>

      {partner && (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Bônus Disponível para Compras</p>
                <p className="text-2xl font-bold text-orange-500">
                  {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(partner.bonus_for_purchases || 0)}
                </p>
              </div>
              <ShoppingCart className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {cursos.length === 0 ? (
        <Card className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-12 text-center">
            <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum curso disponível no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursos.map((curso) => (
            <Card key={curso.id} className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/40 transition-colors overflow-hidden">
              {curso.imagem && (
                <div className="w-full h-48 bg-zinc-900">
                  <img
                    src={curso.imagem}
                    alt={curso.nome}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-orange-500" />
                  {curso.nome}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-400 text-sm line-clamp-3">
                  {curso.descricao || "Curso de qualidade para seu desenvolvimento."}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs">Valor em Bônus</p>
                    <p className="text-xl font-bold text-orange-500">
                      {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(curso.valorBonus)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleComprarClick(curso)}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Comprar com Bônus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCurso && (
              <>
                <div className="p-4 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-sm">Curso</p>
                  <p className="text-white font-semibold">{selectedCurso.nome}</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-sm">Valor em Bônus</p>
                  <p className="text-orange-500 font-bold text-xl">
                    {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(selectedCurso.valorBonus)}
                  </p>
                </div>
                {partner && (
                  <div className="p-4 bg-zinc-900 rounded-lg">
                    <p className="text-gray-400 text-sm">Seu Saldo Atual</p>
                    <p className="text-white font-semibold">
                      {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(partner.bonus_for_purchases || 0)}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Saldo após compra: {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((partner.bonus_for_purchases || 0) - selectedCurso.valorBonus)}
                    </p>
                  </div>
                )}
              </>
            )}
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
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Compra"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}