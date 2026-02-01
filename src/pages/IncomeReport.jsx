import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Download, AlertTriangle, Building2, User } from "lucide-react";
import { toast } from "sonner";

export default function IncomeReport() {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [annualIncome, setAnnualIncome] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        setPartner(partners[0]);
        // Calcular renda anual (total sacado)
        setAnnualIncome(partners[0].total_withdrawn || 0);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatCPF = (cpf) => {
    if (!cpf) return "";
    const numbers = cpf.replace(/\D/g, "");
    if (numbers.length !== 11) return cpf;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      // Simular geração de relatório
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("Relatório gerado! Download iniciando...");
      // Aqui seria implementada a geração real do PDF
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const needsReport = annualIncome >= 60000;
  const currentYear = new Date().getFullYear() - 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Informe de Rendimentos</h1>
        <p className="text-gray-400">Declaração para Receita Federal - Ano Base {currentYear}</p>
      </div>

      {!needsReport ? (
        <Alert className="bg-green-500/10 border-green-500/30">
          <AlertTriangle className="w-4 h-4 text-green-500" />
          <AlertDescription className="text-green-200">
            <strong>Não é necessário gerar informe.</strong> Sua renda anual de {formatCurrency(annualIncome)} está abaixo do limite de R$ 60.000,00.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <strong>ATENÇÃO:</strong> Sua renda anual de {formatCurrency(annualIncome)} ultrapassou R$ 60.000,00. É necessário declarar à Receita Federal.
            </AlertDescription>
          </Alert>

          {/* Fonte Pagadora */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                Identificação da Fonte Pagadora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-sm">Nome</p>
                  <p className="text-white font-semibold">Sociedade de Consumidores LTDA.</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-sm">CNPJ</p>
                  <p className="text-white font-semibold">62.221.470/0001-32</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Beneficiário */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                Identificação do Beneficiário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-sm">Nome</p>
                  <p className="text-white font-semibold">{partner?.full_name || "-"}</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-lg">
                  <p className="text-gray-400 text-sm">CPF</p>
                  <p className="text-white font-semibold">{formatCPF(partner?.cpf) || "Não informado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rendimentos */}
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                Rendimentos Isentos e Não Tributáveis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-zinc-900 rounded-lg">
                <p className="text-gray-400 text-sm">Tipo de Rendimento</p>
                <p className="text-white font-semibold">Lucros e dividendos recebidos</p>
              </div>
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-gray-400 text-sm">Valor Total Ano Base {currentYear}</p>
                <p className="text-orange-500 font-bold text-3xl">{formatCurrency(annualIncome)}</p>
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={generateReport} 
            disabled={generating || !partner?.cpf}
            className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-lg"
          >
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Download className="w-5 h-5 mr-2" />
            )}
            {generating ? "Gerando Relatório..." : "Baixar Informe de Rendimentos (PDF)"}
          </Button>

          {!partner?.cpf && (
            <p className="text-red-500 text-sm text-center">
              * É necessário ter o CPF cadastrado no perfil para gerar o informe.
            </p>
          )}
        </>
      )}
    </div>
  );
}