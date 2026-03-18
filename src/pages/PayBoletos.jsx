import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { Loader2, Upload, FileText, Download, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PayBoletos() {
  const [partner, setPartner] = useState(null);
  const [boletos, setBoletos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({ has_barcode: null, is_official: null, product_type: "", product_details: "", payment_type: "", due_date: "", amount: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
        const userBoletos = await base44.entities.Boleto.filter({ partner_id: partners[0].id });
        setBoletos(userBoletos.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch { }
    finally { setLoading(false); }
  };

  const validateDueDate = (date) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date + 'T00:00:00');
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) >= 7;
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
    { value: "outros", label: "Outros" },
  ];

  const needsDetails = ["loja_fisica", "servico", "outros"];
  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const isBlocked = partner?.status === 'pendente';

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { toast.error("Formato inválido. Aceitos: PDF, PNG, JPG"); return; }
    setSelectedFile(file);
  };

  const resetForm = () => { setSelectedFile(null); setFormData({ has_barcode: null, is_official: null, product_type: "", product_details: "", payment_type: "", due_date: "", amount: "" }); };

  const handleSubmit = async () => {
    if (!selectedFile) { toast.error("Selecione um arquivo"); return; }
    if (formData.has_barcode === null) { toast.error("Informe se o boleto tem código de barras"); return; }
    if (formData.is_official === null) { toast.error("Informe se o boleto é oficial"); return; }
    if (!formData.product_type) { toast.error("Selecione o tipo de produto/serviço"); return; }
    if (needsDetails.includes(formData.product_type) && !formData.product_details.trim()) { toast.error("Especifique os detalhes"); return; }
    if (!formData.payment_type) { toast.error("Selecione a forma de pagamento"); return; }
    if (!formData.due_date) { toast.error("Informe a data de vencimento"); return; }
    if (!validateDueDate(formData.due_date)) { toast.error("O boleto deve ter vencimento com no mínimo 7 dias de antecedência"); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error("Informe o valor do boleto"); return; }
    if (parseFloat(formData.amount) > (partner?.bonus_for_purchases || 0)) { toast.error("Valor maior que seu saldo de bônus para compras"); return; }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      await base44.entities.Boleto.create({
        partner_id: partner.id, partner_name: partner.full_name, file_url,
        has_barcode: formData.has_barcode, is_official: formData.is_official,
        product_type: formData.product_type, product_details: formData.product_details,
        payment_type: formData.payment_type, due_date: formData.due_date,
        amount: parseFloat(formData.amount), status: "pending", submitted_date: new Date().toISOString()
      });
      toast.success("Boleto enviado com sucesso!");
      setUploadDialogOpen(false); resetForm(); loadData();
    } catch { toast.error("Erro ao enviar boleto"); }
    finally { setUploading(false); }
  };

  const StatusPill = ({ status }) => {
    const cfg = {
      pending:  { icon: Clock,         cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pendente" },
      paid:     { icon: CheckCircle,   cls: "bg-green-500/10 text-green-400 border-green-500/20",   label: "Pago" },
      rejected: { icon: XCircle,       cls: "bg-red-500/10 text-red-400 border-red-500/20",          label: "Rejeitado" },
      expired:  { icon: AlertTriangle, cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",       label: "Expirado" },
    };
    const { icon: Icon, cls, label } = cfg[status] || cfg.pending;
    return <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}><Icon className="w-3 h-3" />{label}</span>;
  };

  const BoletoList = ({ list }) => {
    if (list.length === 0) return <EmptyState icon={FileText} message="Nenhum boleto encontrado." />;
    return (
      <motion.div variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
        {list.map(b => (
          <motion.div key={b.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={b.status} />
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400">
                    {b.payment_type === 'pix' ? 'PIX' : b.payment_type === 'qrcode' ? 'QR Code' : 'PIX/QR'}
                  </span>
                </div>
                <p className="text-white text-sm">Vencimento: {new Date(b.due_date).toLocaleDateString('pt-BR')}</p>
                <p className="text-zinc-500 text-xs">Enviado: {new Date(b.submitted_date || b.created_date).toLocaleDateString('pt-BR')}</p>
                {b.paid_date && <p className="text-green-400 text-xs">Pago em: {new Date(b.paid_date).toLocaleDateString('pt-BR')}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-white font-bold text-xl">{fmtR(b.amount)}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(b.file_url, '_blank')} className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 rounded-xl gap-1 text-xs">
                    <FileText className="w-3 h-3" /> Ver
                  </Button>
                  {b.receipt_url && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 rounded-xl gap-1 text-xs" onClick={() => window.open(b.receipt_url, '_blank')}>
                      <Download className="w-3 h-3" /> Recibo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    );
  };

  if (loading) return <LoadingSpinner />;

  const pendingBoletos = boletos.filter(b => b.status === 'pending');
  const paidBoletos = boletos.filter(b => b.status === 'paid');

  return (
    <AnimatedPage>
      <PageHeader
        title="Pagar Boletos"
        subtitle="Pague seus boletos usando seus bônus"
        action={
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/[0.05]">
              <p className="text-zinc-500 text-xs">Saldo Disponível</p>
              <p className="text-orange-400 font-bold text-sm">{fmtR(partner?.bonus_for_purchases)}</p>
            </div>
            <Button onClick={() => { if (isBlocked) { toast.error("Para usar todos os recursos, é necessário que você esteja ativo."); } else { setUploadDialogOpen(true); } }}
              className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
              <Upload className="w-4 h-4" /> Enviar Boleto
            </Button>
          </div>
        }
      />

      {/* Alertas */}
      <AnimatedItem>
        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-bold text-sm">ATENÇÃO: NUNCA CAIA EM GOLPES!</p>
            <p className="text-zinc-400 text-sm mt-0.5">A SOCIEDADE DE CONSUMIDORES NUNCA envia cobrança por PIX. A única forma de pagamento é por boleto gerado em nosso sistema.</p>
          </div>
        </div>
      </AnimatedItem>

      {isBlocked && (
        <AnimatedItem>
          <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-zinc-300 text-sm"><strong>Envio de boletos temporariamente bloqueado.</strong> Para usar todos os recursos, é necessário que você esteja ativo.</p>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        <Tabs defaultValue="pending">
          <TabsList className="bg-zinc-900 border border-white/[0.05] mb-6 w-full sm:w-auto">
            <TabsTrigger value="pending" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none text-xs gap-1"><Clock className="w-3 h-3" />Pendentes ({pendingBoletos.length})</TabsTrigger>
            <TabsTrigger value="paid" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none text-xs gap-1"><CheckCircle className="w-3 h-3" />Pagos ({paidBoletos.length})</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 flex-1 sm:flex-none text-xs gap-1"><FileText className="w-3 h-3" />Todos ({boletos.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending"><BoletoList list={pendingBoletos} /></TabsContent>
          <TabsContent value="paid"><BoletoList list={paidBoletos} /></TabsContent>
          <TabsContent value="all"><BoletoList list={boletos} /></TabsContent>
        </Tabs>
      </AnimatedItem>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Enviar Boleto para Pagamento</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-semibold">Arquivo do Boleto (PDF ou Foto)</Label>
                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-5 text-center hover:border-orange-500/50 transition-colors">
                  <input type="file" accept=".pdf,image/png,image/jpeg,image/jpg" onChange={handleFileChange} className="hidden" id="boleto-file" />
                  <label htmlFor="boleto-file" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-orange-400" />
                        <span className="text-white text-sm">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <><Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" /><p className="text-zinc-400 text-sm">Clique para selecionar</p><p className="text-zinc-600 text-xs">PDF, PNG, JPG</p></>
                    )}
                  </label>
                </div>
              </div>

              {[
                { label: "O boleto tem código de barras?", field: "has_barcode" },
                { label: "O boleto é oficial?", field: "is_official" },
              ].map(({ label, field }) => (
                <div key={field} className="space-y-2">
                  <Label className="text-zinc-300 text-sm font-semibold">{label}</Label>
                  <RadioGroup value={formData[field]?.toString()} onValueChange={v => setFormData({ ...formData, [field]: v === 'true' })} className="flex gap-4">
                    {[["true", "Sim"], ["false", "Não"]].map(([v, l]) => (
                      <div key={v} className="flex items-center gap-2">
                        <RadioGroupItem value={v} id={`${field}-${v}`} className="border-orange-500 text-orange-500" />
                        <Label htmlFor={`${field}-${v}`} className="text-zinc-300">{l}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-semibold">Qual produto está sendo pago?</Label>
                <Select value={formData.product_type} onValueChange={v => setFormData({ ...formData, product_type: v, product_details: "" })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white rounded-xl">
                    <SelectValue placeholder="Selecione o tipo de produto" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {productTypes.map(t => <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {needsDetails.includes(formData.product_type) && (
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm font-semibold">
                    {formData.product_type === "loja_fisica" ? "Nome da loja e do produto" : formData.product_type === "servico" ? "Nome do prestador e tipo de serviço" : "Especifique os detalhes"}
                  </Label>
                  <Textarea value={formData.product_details} onChange={e => setFormData({ ...formData, product_details: e.target.value })}
                    className="bg-zinc-900 border-zinc-700 text-white rounded-xl" rows={2} />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-semibold">Como deseja pagar?</Label>
                <RadioGroup value={formData.payment_type} onValueChange={v => setFormData({ ...formData, payment_type: v })} className="space-y-2">
                  {[["pix", "PIX"], ["qrcode", "QR Code"], ["any", "Qualquer um dos dois"]].map(([v, l]) => (
                    <div key={v} className="flex items-center gap-2">
                      <RadioGroupItem value={v} id={`pay-${v}`} className="border-orange-500 text-orange-500" />
                      <Label htmlFor={`pay-${v}`} className="text-zinc-300">{l}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-semibold">Data de Vencimento</Label>
                <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 text-white rounded-xl" />
                <p className="text-zinc-600 text-xs">Mínimo 7 dias de antecedência</p>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-semibold">Valor do boleto (R$)</Label>
                <Input type="number" step="0.01" min="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 text-white rounded-xl" placeholder="0,00" />
                <p className="text-zinc-600 text-xs">Saldo disponível: {fmtR(partner?.bonus_for_purchases)}</p>
                {formData.amount && parseFloat(formData.amount) > 0 && (
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <p className="text-orange-400 text-xs font-semibold">Conversão de Bônus (+346%)</p>
                    <p className="text-orange-300 font-bold">{fmtR(parseFloat(formData.amount) * 4.46)} em bônus</p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
                <p className="text-zinc-400 text-xs font-medium mb-1">💡 Simulador</p>
                <p className="text-zinc-500 text-xs">Para pagar um boleto, você precisa de 346% a mais do valor em bônus.<br />Ex: Boleto de R$ 100,00 = R$ 446,00 em bônus.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading} className="bg-orange-500 hover:bg-orange-600 gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Enviar Boleto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}