import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, Download, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PayBoletos() {
  const [partner, setPartner] = useState(null);
  const [boletos, setBoletos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [formData, setFormData] = useState({
    has_barcode: null,
    is_official: null,
    product_type: "",
    product_details: "",
    payment_type: "",
    due_date: "",
    amount: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        setPartner(partners[0]);
        
        const userBoletos = await base44.entities.Boleto.filter({ partner_id: partners[0].id });
        setBoletos(userBoletos.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateDueDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date + 'T00:00:00');
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
  };

  const productTypes = [
    { value: "aluguel", label: "Aluguel" },
    { value: "contas_consumo", label: "Contas de água, luz, telefone ou gás" },
    { value: "condominio", label: "Condomínio" },
    { value: "multa_veiculo", label: "Multa, IPVA, Licenciamento" },
    { value: "parcela_veiculo", label: "Parcela do Veículo" },
    { value: "parcela_imovel", label: "Parcela do Imóvel" },
    { value: "compras_internet", label: "Compras pela internet" },
    { value: "saude", label: "Médico, Dentista, Psicólogo" },
    { value: "loja_fisica", label: "Compras em loja física" },
    { value: "servico", label: "Prestação de serviço" },
    { value: "outros", label: "Outros" }
  ];

  const needsDetails = ["loja_fisica", "servico", "outros"];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast.error("Formato inválido. Aceitos: PDF, PNG, JPG");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    // Validations
    if (!selectedFile) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (formData.has_barcode === null) {
      toast.error("Informe se o boleto tem código de barras");
      return;
    }
    if (formData.is_official === null) {
      toast.error("Informe se o boleto é oficial");
      return;
    }
    if (!formData.product_type) {
      toast.error("Selecione o tipo de produto/serviço");
      return;
    }
    if (needsDetails.includes(formData.product_type) && !formData.product_details.trim()) {
      if (formData.product_type === "loja_fisica") {
        toast.error("Especifique o nome da loja e do produto");
      } else if (formData.product_type === "servico") {
        toast.error("Especifique o nome do prestador e tipo de serviço");
      } else {
        toast.error("Especifique os detalhes");
      }
      return;
    }
    if (!formData.payment_type) {
      toast.error("Selecione a forma de pagamento");
      return;
    }
    if (!formData.due_date) {
      toast.error("Informe a data de vencimento");
      return;
    }
    if (!validateDueDate(formData.due_date)) {
      toast.error("O boleto deve ter vencimento com no mínimo 7 dias de antecedência");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Informe o valor do boleto");
      return;
    }
    
    const amount = parseFloat(formData.amount);
    if (amount > (partner?.bonus_for_purchases || 0)) {
      toast.error("Valor maior que seu saldo de bônus para compras");
      return;
    }

    setUploading(true);
    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

      // Create boleto record
      await base44.entities.Boleto.create({
        partner_id: partner.id,
        partner_name: partner.full_name,
        file_url: file_url,
        has_barcode: formData.has_barcode,
        is_official: formData.is_official,
        product_type: formData.product_type,
        product_details: formData.product_details,
        payment_type: formData.payment_type,
        due_date: formData.due_date,
        amount: amount,
        status: "pending",
        submitted_date: new Date().toISOString()
      });

      toast.success("Boleto enviado com sucesso!");
      setUploadDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar boleto");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      has_barcode: null,
      is_official: null,
      product_type: "",
      product_details: "",
      payment_type: "",
      due_date: "",
      amount: ""
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const StatusBadge = ({ status }) => {
    const config = {
      pending: { icon: Clock, color: "bg-yellow-500/20 text-yellow-500", label: "Pendente" },
      paid: { icon: CheckCircle, color: "bg-green-500/20 text-green-500", label: "Pago" },
      rejected: { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "Rejeitado" },
      expired: { icon: AlertTriangle, color: "bg-gray-500/20 text-gray-500", label: "Expirado" }
    };
    
    const { icon: Icon, color, label } = config[status] || config.pending;
    
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Check if partner is blocked
  const isBlocked = partner?.status === 'pendente';

  const pendingBoletos = boletos.filter(b => b.status === 'pending');
  const paidBoletos = boletos.filter(b => b.status === 'paid');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Pagar Boletos</h1>
          <p className="text-gray-400">Pague seus boletos usando seus bônus</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Card className="bg-zinc-950 border-orange-500/20 px-4 py-2">
            <p className="text-gray-400 text-xs">Saldo Disponível</p>
            <p className="text-orange-500 font-bold">{formatCurrency(partner?.bonus_for_purchases)}</p>
          </Card>
          
          <Button
            onClick={() => setUploadDialogOpen(true)}
            disabled={isBlocked}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Upload className="w-4 h-4 mr-2" />
            Enviar Boleto
          </Button>
        </div>
      </div>

      {/* Security Warning */}
      <Alert className="bg-red-500/10 border-red-500/30">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <AlertDescription className="text-red-200">
          <strong>ATENÇÃO: NUNCA CAIA EM GOLPES!</strong><br />
          A SOCIEDADE DE CONSUMIDORES NUNCA envia cobrança por PIX. A única forma de pagamento é por boleto gerado em nosso sistema por COMPRA DE PRODUTOS E SERVIÇOS.
        </AlertDescription>
      </Alert>

      {/* Block Alert */}
      {isBlocked && (
        <Alert className="bg-yellow-500/10 border-yellow-500/30">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            <strong>Envio de boletos bloqueado.</strong> Resolva as pendências do seu cadastro para desbloquear.
          </AlertDescription>
        </Alert>
      )}

      {/* Boletos List */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="pending" className="data-[state=active]:bg-orange-500">
            <Clock className="w-4 h-4 mr-2" />
            Pendentes ({pendingBoletos.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="data-[state=active]:bg-orange-500">
            <CheckCircle className="w-4 h-4 mr-2" />
            Pagos ({paidBoletos.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-orange-500">
            <FileText className="w-4 h-4 mr-2" />
            Todos ({boletos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <BoletoList boletos={pendingBoletos} formatCurrency={formatCurrency} StatusBadge={StatusBadge} />
        </TabsContent>

        <TabsContent value="paid">
          <BoletoList boletos={paidBoletos} formatCurrency={formatCurrency} StatusBadge={StatusBadge} />
        </TabsContent>

        <TabsContent value="all">
          <BoletoList boletos={boletos} formatCurrency={formatCurrency} StatusBadge={StatusBadge} />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">Enviar Boleto para Pagamento</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-white">Arquivo do Boleto (PDF ou Foto)</Label>
                <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center hover:border-orange-500 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={handleFileChange}
                    className="hidden"
                    id="boleto-file"
                  />
                  <label htmlFor="boleto-file" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-6 h-6 text-orange-500" />
                        <span className="text-white text-sm">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                        <p className="text-gray-400 text-sm">Clique para selecionar</p>
                        <p className="text-gray-500 text-xs">PDF, PNG, JPG</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Has Barcode */}
              <div className="space-y-2">
                <Label className="text-white">O boleto tem código de barras?</Label>
                <RadioGroup
                  value={formData.has_barcode?.toString()}
                  onValueChange={(v) => setFormData({ ...formData, has_barcode: v === 'true' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true" id="barcode-yes" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="barcode-yes" className="text-gray-300">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="false" id="barcode-no" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="barcode-no" className="text-gray-300">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Is Official */}
              <div className="space-y-2">
                <Label className="text-white">O boleto é oficial?</Label>
                <RadioGroup
                  value={formData.is_official?.toString()}
                  onValueChange={(v) => setFormData({ ...formData, is_official: v === 'true' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true" id="official-yes" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="official-yes" className="text-gray-300">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="false" id="official-no" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="official-no" className="text-gray-300">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Product Type */}
              <div className="space-y-2">
                <Label className="text-white">Qual produto está sendo comprado/pago?</Label>
                <Select
                  value={formData.product_type}
                  onValueChange={(v) => setFormData({ ...formData, product_type: v, product_details: "" })}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue placeholder="Selecione o tipo de produto" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {productTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-white hover:bg-zinc-800">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Details (conditional) */}
              {needsDetails.includes(formData.product_type) && (
                <div className="space-y-2">
                  <Label className="text-white">
                    {formData.product_type === "loja_fisica" && "Especifique o nome da loja e do produto"}
                    {formData.product_type === "servico" && "Especifique o nome do prestador e o tipo de serviço"}
                    {formData.product_type === "outros" && "Especifique os detalhes"}
                  </Label>
                  <Textarea
                    value={formData.product_details}
                    onChange={(e) => setFormData({ ...formData, product_details: e.target.value })}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    placeholder={
                      formData.product_type === "loja_fisica" ? "Ex: Loja X - Produto Y" :
                      formData.product_type === "servico" ? "Ex: João da Silva - Serviço de encanamento" :
                      "Descreva os detalhes..."
                    }
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Payment Type */}
              <div className="space-y-2">
                <Label className="text-white">Como deseja pagar?</Label>
                <RadioGroup
                  value={formData.payment_type}
                  onValueChange={(v) => setFormData({ ...formData, payment_type: v })}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pay-pix" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="pay-pix" className="text-gray-300">PIX</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="qrcode" id="pay-qr" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="pay-qr" className="text-gray-300">QR Code</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="any" id="pay-any" className="border-orange-500 text-orange-500" />
                    <Label htmlFor="pay-any" className="text-gray-300">Qualquer um dos dois</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label className="text-white">Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
                <p className="text-gray-500 text-xs">Só aceitamos boletos com no mínimo 7 dias antes do vencimento</p>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-white">Valor do boleto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 text-white"
                  placeholder="0,00"
                />
                <p className="text-gray-500 text-xs">
                  Saldo disponível: {formatCurrency(partner?.bonus_for_purchases)}
                </p>
                
                {/* Conversão de Bônus */}
                {formData.amount && parseFloat(formData.amount) > 0 && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg mt-2">
                    <p className="text-orange-400 text-xs font-semibold">Conversão para Bônus (+346%)</p>
                    <p className="text-orange-500 font-bold text-lg">
                      {formatCurrency(parseFloat(formData.amount) * 4.46)} em bônus necessários
                    </p>
                  </div>
                )}
              </div>

              {/* Simulador de Bônus */}
              <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                <p className="text-gray-400 text-sm mb-1">💡 Simulador: Quanto de bônus preciso?</p>
                <p className="text-gray-500 text-xs">
                  Para pagar um boleto, você precisa de 346% a mais do valor em bônus.<br/>
                  Exemplo: Boleto de R$ 100,00 = R$ 446,00 em bônus.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? "Enviando..." : "Enviar Boleto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoletoList({ boletos, formatCurrency, StatusBadge }) {
  if (boletos.length === 0) {
    return (
      <Card className="bg-zinc-950 border-orange-500/20">
        <CardContent className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum boleto encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {boletos.map((boleto) => (
        <Card key={boleto.id} className="bg-zinc-950 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={boleto.status} />
                  <Badge className="bg-zinc-800 text-gray-400">
                    {boleto.payment_type === 'pix' ? 'PIX' : boleto.payment_type === 'qrcode' ? 'QR Code' : 'PIX/QR'}
                  </Badge>
                </div>
                <p className="text-white mt-2">Vencimento: {new Date(boleto.due_date).toLocaleDateString('pt-BR')}</p>
                <p className="text-gray-500 text-sm">
                  Enviado: {new Date(boleto.submitted_date || boleto.created_date).toLocaleDateString('pt-BR')}
                </p>
                {boleto.paid_date && (
                  <p className="text-green-500 text-sm">
                    Pago em: {new Date(boleto.paid_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-white font-bold text-lg">{formatCurrency(boleto.amount)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(boleto.file_url, '_blank')}
                    className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Ver
                  </Button>
                  {boleto.receipt_url && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => window.open(boleto.receipt_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Recibo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}