import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner } from "@/components/PageWrapper";
import { Loader2, Save, User, MapPin, CreditCard, Bell, UserX, Shield, AlertTriangle, Eye, EyeOff, CheckCircle, XCircle, Mail } from "lucide-react";
import { toast } from "sonner";

function EmailChangeFlow({ currentEmail }) {
  const { logout } = useAuthCustom();
  const [step, setStep] = useState('input');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!newEmail || !newEmail.includes('@')) { toast.error('Digite um email válido'); return; }
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('changeEmail', { newEmail, step: 'request' });
      if (data.ok) { toast.success('Código enviado para o novo email'); setStep('confirm'); }
      else toast.error(data.error || 'Erro ao enviar código');
    } catch { toast.error('Erro ao processar solicitação'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!code || code.length !== 6) { toast.error('Digite o código de 6 dígitos'); return; }
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('changeEmail', { code, step: 'confirm' });
      if (data.ok) { toast.success('Email alterado! Faça login novamente.'); setTimeout(() => logout(), 2000); }
      else toast.error(data.error || 'Código inválido ou expirado');
    } catch { toast.error('Erro ao confirmar código'); }
    finally { setLoading(false); }
  };

  if (step === 'input') return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-start gap-2">
        <Mail className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
        <p className="text-zinc-300 text-sm">Você receberá um código de confirmação no novo email. Após confirmar, será necessário fazer login novamente.</p>
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">Email Atual</Label>
        <Input value={currentEmail} disabled className="bg-zinc-900 border-zinc-700 text-zinc-400 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">Novo Email</Label>
        <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white rounded-xl" placeholder="novo@email.com" />
      </div>
      <DialogFooter>
        <Button onClick={handleRequest} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Enviar Código
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
        <p className="text-zinc-300 text-sm">Código enviado para: <strong>{newEmail}</strong></p>
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">Código de Confirmação</Label>
        <Input type="text" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="bg-zinc-900 border-zinc-700 text-white text-center text-2xl tracking-widest rounded-xl" placeholder="000000" />
        <p className="text-zinc-500 text-xs">Código válido por 15 minutos</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('input')} className="border-zinc-700 text-zinc-300">Voltar</Button>
        <Button onClick={handleConfirm} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Confirmar
        </Button>
      </DialogFooter>
    </div>
  );
}

const fieldClass = "bg-zinc-800/60 border-zinc-700 text-white focus:border-orange-500 rounded-xl";
const labelClass = "text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block";

export default function Profile() {
  const { partner: loadedPartner, user: loadedUser, loading: partnerLoading, reload } = usePartner();
  const [partner, setPartner] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });

  const [formData, setFormData] = useState({
    full_name: "", birth_date: "", gender: "", phone: "", display_name: "", cpf: "",
    address: { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" },
    pix_key: "", pix_key_type: "", bank_name: "", bank_agency: "", bank_account: "", bank_holder_name: "", bank_holder_cpf: "",
    notification_email: true, notification_sms: false, notification_whatsapp: false, notification_frequency: "semanalmente",
    notification_status_pendente: true, notification_new_signup: true, notification_own_purchases: true, notification_third_party_purchases: true,
    successor: { full_name: "", cpf: "", phone: "", email: "", birth_date: "", relationship: "" }
  });

  useEffect(() => {
    if (!partnerLoading) {
      if (loadedPartner) populateForm(loadedPartner, loadedUser);
      setLoading(false);
    }
  }, [loadedPartner, loadedUser, partnerLoading]);

  const populateForm = (p, user) => {
    setPartner(p); setUserEmail(user?.email || p.email || "");
    setFormData({
      full_name: p.full_name || "", birth_date: p.birth_date || "", gender: p.gender || "",
      phone: p.phone || "", display_name: p.display_name || "", cpf: p.cpf || "",
      address: p.address || { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" },
      pix_key: p.pix_key || "", pix_key_type: p.pix_key_type || "",
      bank_name: p.bank_name || "", bank_agency: p.bank_agency || "", bank_account: p.bank_account || "",
      bank_holder_name: p.bank_holder_name || "", bank_holder_cpf: p.bank_holder_cpf || "",
      notification_email: p.notification_email ?? true, notification_sms: p.notification_sms ?? false,
      notification_whatsapp: p.notification_whatsapp ?? false, notification_frequency: p.notification_frequency || "semanalmente",
      notification_status_pendente: p.notification_status_pendente ?? true, notification_new_signup: p.notification_new_signup ?? true,
      notification_own_purchases: p.notification_own_purchases ?? true, notification_third_party_purchases: p.notification_third_party_purchases ?? true,
      successor: p.successor || { full_name: "", cpf: "", phone: "", email: "", birth_date: "", relationship: "" }
    });
  };

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleAddressChange = (field, value) => setFormData(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
  const handleSuccessorChange = (field, value) => setFormData(prev => ({ ...prev, successor: { ...prev.successor, [field]: value } }));

  const searchCep = async (cep) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const data = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`).then(r => r.json());
        if (!data.erro) setFormData(prev => ({ ...prev, address: { ...prev.address, cep: cleanCep, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" } }));
      } catch { }
    }
  };

  const formatCPF = (value) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
    return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
  };

  const handleSave = async () => {
    if (!partner) { toast.error("Erro: dados do parceiro não carregados."); return; }
    setSaving(true);
    try {
      const allComplete = formData.cpf && formData.pix_key && formData.pix_key_type &&
        formData.address.cep && formData.address.street && formData.address.number &&
        formData.address.neighborhood && formData.address.city && formData.address.state;
      const updateData = { ...formData, gender: formData.gender || partner.gender || "prefiro_nao_informar", phone: formData.phone || partner.phone || "", full_name: formData.full_name || partner.full_name || "", birth_date: formData.birth_date || partner.birth_date || null };
      Object.keys(updateData).forEach(key => { if (updateData[key] === "" && key !== "full_name" && key !== "phone" && key !== "gender") updateData[key] = null; });
      if (updateData.successor) { const s = { ...updateData.successor }; Object.keys(s).forEach(k => { if (s[k] === "") s[k] = null; }); updateData.successor = s; }
      if (updateData.address) { const a = { ...updateData.address }; Object.keys(a).forEach(k => { if (a[k] === "") a[k] = null; }); updateData.address = a; }
      if (allComplete && partner.pending_reasons?.length > 0) {
        const newReasons = partner.pending_reasons.filter(r => r !== "Falta de informações no cadastro");
        updateData.pending_reasons = newReasons;
        if (newReasons.length === 0 && partner.first_purchase_done) updateData.status = "ativo";
      }
      await base44.entities.Partner.update(partner.id, updateData);
      toast.success("Perfil atualizado com sucesso!");
      await reload();
    } catch (error) { toast.error("Erro ao salvar: " + (error.message || "Tente novamente")); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  const ChecklistItem = ({ ok, label }) => (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
      <span className="text-zinc-300 text-sm">{label}</span>
    </div>
  );

  return (
    <AnimatedPage>
      <PageHeader
        title="Meu Perfil"
        action={
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        }
      />

      {partner?.status === 'pendente' && (
        <AnimatedItem>
          <div className="p-5 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-yellow-300 font-bold">Checklist de Ativação da Conta</h3>
            </div>
            <div className="space-y-2">
              <ChecklistItem ok={formData.cpf && formData.cpf.length === 11} label="CPF completo" />
              <ChecklistItem ok={!!(formData.pix_key && formData.pix_key_type)} label="Chave PIX cadastrada" />
              <ChecklistItem ok={!!(formData.address.cep && formData.address.street && formData.address.number && formData.address.neighborhood && formData.address.city && formData.address.state)} label="Endereço completo" />
              <ChecklistItem ok={partner.first_purchase_done} label="Primeira compra realizada" />
            </div>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto mb-6">
            <TabsList className="bg-zinc-900 border border-white/[0.05] w-max">
              {[
                { value: "personal", icon: User, label: "Dados Pessoais" },
                { value: "address", icon: MapPin, label: "Endereço" },
                { value: "bank", icon: CreditCard, label: "Bancário" },
                { value: "notifications", icon: Bell, label: "Notificações" },
                { value: "successor", icon: Shield, label: "Sucessor" },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger key={value} value={value} className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <Icon className="w-3 h-3" /><span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="personal">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-5">
              <h2 className="text-white font-bold">Dados Pessoais</h2>
              {partner && (
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-sm">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${partner.status === 'ativo' ? 'bg-green-500/10 text-green-400' : partner.status === 'pendente' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                    {partner.status?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Nome Completo", field: "full_name", placeholder: "" },
                  { label: "Nome no Site", field: "display_name", placeholder: "Nome ou apelido" },
                  { label: "Data de Nascimento", field: "birth_date", type: "date" },
                  { label: "CPF *", field: "cpf", placeholder: "000.000.000-00" },
                ].map(({ label, field, type = "text", placeholder }) => (
                  <div key={field}>
                    <Label className={labelClass}>{label}</Label>
                    <Input type={type}
                      value={field === "cpf" ? formatCPF(formData.cpf) : formData[field]}
                      onChange={e => handleChange(field, field === "cpf" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                      maxLength={field === "cpf" ? 14 : undefined}
                      className={fieldClass} placeholder={placeholder} />
                    {field === "cpf" && formData.cpf.length !== 11 && <p className="text-red-400 text-xs mt-1">Campo obrigatório</p>}
                  </div>
                ))}
                <div>
                  <Label className={labelClass}>E-mail de Cadastro</Label>
                  <div className="flex gap-2">
                    <Input value={userEmail || partner?.created_by || ""} disabled className={`${fieldClass} flex-1`} />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 rounded-xl shrink-0">Alterar</Button>
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-950 border-zinc-800">
                        <DialogHeader><DialogTitle className="text-white">Alterar E-mail</DialogTitle></DialogHeader>
                        <EmailChangeFlow currentEmail={partner?.created_by} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="address">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-5">
              <h2 className="text-white font-bold">Endereço</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className={labelClass}>CEP *</Label>
                  <Input value={formData.address.cep} onChange={e => { handleAddressChange("cep", e.target.value); searchCep(e.target.value); }} className={fieldClass} placeholder="00000-000" maxLength={9} />
                </div>
                <div className="sm:col-span-2">
                  <Label className={labelClass}>Rua *</Label>
                  <Input value={formData.address.street} onChange={e => handleAddressChange("street", e.target.value)} className={fieldClass} />
                </div>
                {[
                  { label: "Número *", field: "number" },
                  { label: "Complemento", field: "complement" },
                  { label: "Bairro *", field: "neighborhood" },
                  { label: "Cidade *", field: "city" },
                  { label: "Estado *", field: "state", maxLength: 2 },
                ].map(({ label, field, maxLength }) => (
                  <div key={field}>
                    <Label className={labelClass}>{label}</Label>
                    <Input value={formData.address[field]} onChange={e => handleAddressChange(field, e.target.value)} className={fieldClass} maxLength={maxLength} />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bank">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-5">
              <h2 className="text-white font-bold">Informações Bancárias</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Banco", field: "bank_name", placeholder: "Nome do banco" },
                  { label: "Agência", field: "bank_agency", placeholder: "0000" },
                  { label: "Conta", field: "bank_account", placeholder: "00000-0" },
                  { label: "Nome do Titular", field: "bank_holder_name", placeholder: "Nome completo" },
                  { label: "CPF do Titular", field: "bank_holder_cpf", placeholder: "000.000.000-00" },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <Label className={labelClass}>{label}</Label>
                    <Input value={field === "bank_holder_cpf" ? formatCPF(formData[field] || "") : formData[field] || ""}
                      onChange={e => handleChange(field, field === "bank_holder_cpf" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                      maxLength={field === "bank_holder_cpf" ? 14 : undefined}
                      className={fieldClass} placeholder={placeholder} />
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-white/[0.05]">
                <h3 className="text-white font-semibold mb-4">Chave PIX</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className={labelClass}>Forma de Recebimento *</Label>
                    <Select value={formData.pix_key_type} onValueChange={v => handleChange("pix_key_type", v)}>
                      <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="ted">Conta Bancária (TED)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.pix_key_type === 'pix' && (
                    <div>
                      <Label className={labelClass}>Chave PIX *</Label>
                      <Input value={formData.pix_key} onChange={e => handleChange("pix_key", e.target.value)} className={fieldClass} placeholder="CPF, Email, Telefone ou Chave Aleatória" />
                      {!formData.pix_key && <p className="text-red-400 text-xs mt-1">Campo obrigatório</p>}
                    </div>
                  )}
                  {formData.pix_key_type === 'ted' && (
                    <div className="flex items-center"><p className="text-zinc-400 text-sm">Pagamento via TED usando os dados bancários acima.</p></div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-5">
              <h2 className="text-white font-bold">Preferências de Notificação</h2>
              <div className="space-y-3">
                {[
                  { label: "E-mail", desc: "Notificações por e-mail (obrigatório)", field: "notification_email", disabled: true, checked: true },
                  { label: "SMS", desc: "Notificações por SMS", field: "notification_sms" },
                  { label: "WhatsApp", desc: "Notificações por WhatsApp", field: "notification_whatsapp" },
                ].map(({ label, desc, field, disabled, checked }) => (
                  <div key={field} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/60">
                    <div>
                      <p className="text-white font-medium text-sm">{label}</p>
                      <p className="text-zinc-500 text-xs">{desc}</p>
                    </div>
                    <Switch checked={disabled ? true : formData[field]} onCheckedChange={disabled ? undefined : v => handleChange(field, v)} disabled={disabled} className="data-[state=checked]:bg-orange-500" />
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-white/[0.05]">
                <Label className={labelClass}>Frequência</Label>
                <Select value={formData.notification_frequency} onValueChange={v => handleChange("notification_frequency", v)}>
                  <SelectTrigger className={`${fieldClass} max-w-xs`}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {["diariamente", "semanalmente", "quinzenalmente", "mensalmente"].map(v => (
                      <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-4 border-t border-white/[0.05] space-y-3">
                {[
                  { label: "Novo Cadastro", desc: "Notificações de novos clientes", field: "notification_new_signup" },
                  { label: "Compras Próprias", desc: "Notificações sobre suas compras", field: "notification_own_purchases" },
                  { label: "Compras da Rede", desc: "Notificações de compras de clientes", field: "notification_third_party_purchases" },
                ].map(({ label, desc, field }) => (
                  <div key={field} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/60">
                    <div>
                      <p className="text-white font-medium text-sm">{label}</p>
                      <p className="text-zinc-500 text-xs">{desc}</p>
                    </div>
                    <Switch checked={formData[field]} onCheckedChange={v => handleChange(field, v)} className="data-[state=checked]:bg-orange-500" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="successor">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.05] space-y-5">
              <div>
                <h2 className="text-white font-bold">Informações do Sucessor</h2>
                <p className="text-zinc-500 text-sm mt-1">Em caso de falecimento, seus bônus e rede serão transferidos para o sucessor indicado.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Nome Completo", field: "full_name" },
                  { label: "CPF", field: "cpf" },
                  { label: "Telefone", field: "phone" },
                  { label: "E-mail", field: "email", type: "email" },
                  { label: "Data de Nascimento", field: "birth_date", type: "date" },
                  { label: "Grau de Parentesco", field: "relationship", placeholder: "Ex: Filho, Cônjuge, Amigo" },
                ].map(({ label, field, type = "text", placeholder }) => (
                  <div key={field}>
                    <Label className={labelClass}>{label}</Label>
                    <Input type={type}
                      value={field === "cpf" ? formatCPF(formData.successor.cpf || "") : formData.successor[field]}
                      onChange={e => handleSuccessorChange(field, field === "cpf" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                      maxLength={field === "cpf" ? 14 : undefined}
                      className={fieldClass} placeholder={placeholder} />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </AnimatedItem>

      {/* Delete Account */}
      <AnimatedItem>
        <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <UserX className="w-5 h-5 text-red-400" />
            <h3 className="text-red-400 font-bold">Excluir Conta</h3>
          </div>
          <ul className="text-zinc-400 text-sm space-y-1 mb-4 ml-4 list-disc">
            <li>Você perde todos os clientes cadastrados</li>
            <li>Seus clientes serão repassados para seu indicador direto</li>
            <li>O saldo para saque será depositado integralmente na sua conta</li>
            <li>O saldo para compras deve ser 100% gasto em 30 dias</li>
          </ul>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="rounded-xl gap-2 bg-red-500 hover:bg-red-600">
                <UserX className="w-4 h-4" /> Solicitar Exclusão da Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800">
              <DialogHeader><DialogTitle className="text-red-400">Confirmar Exclusão</DialogTitle></DialogHeader>
              <p className="text-zinc-300">Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.</p>
              <DialogFooter>
                <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => { toast.info("Entre em contato com o suporte para excluir sua conta."); setDeleteDialogOpen(false); }}>
                  Confirmar Exclusão
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AnimatedItem>
    </AnimatedPage>
  );
}