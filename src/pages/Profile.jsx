import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, User, MapPin, CreditCard, Bell, UserX, Shield, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });

  const [formData, setFormData] = useState({
    full_name: "",
    birth_date: "",
    display_name: "",
    cpf: "",
    address: {
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: ""
    },
    pix_key: "",
    pix_key_type: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    bank_holder_name: "",
    bank_holder_cpf: "",
    notification_email: true,
    notification_sms: false,
    notification_whatsapp: false,
    notification_frequency: "semanalmente",
    successor: {
      full_name: "",
      cpf: "",
      phone: "",
      email: "",
      birth_date: "",
      relationship: ""
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        const p = partners[0];
        setPartner(p);
        setFormData({
          full_name: p.full_name || "",
          birth_date: p.birth_date || "",
          display_name: p.display_name || "",
          cpf: p.cpf || "",
          address: p.address || {
            cep: "",
            street: "",
            number: "",
            complement: "",
            neighborhood: "",
            city: "",
            state: ""
          },
          pix_key: p.pix_key || "",
          pix_key_type: p.pix_key_type || "",
          bank_name: p.bank_name || "",
          bank_agency: p.bank_agency || "",
          bank_account: p.bank_account || "",
          bank_holder_name: p.bank_holder_name || "",
          bank_holder_cpf: p.bank_holder_cpf || "",
          notification_email: p.notification_email ?? true,
          notification_sms: p.notification_sms ?? false,
          notification_whatsapp: p.notification_whatsapp ?? false,
          notification_frequency: p.notification_frequency || "semanalmente",
          successor: p.successor || {
            full_name: "",
            cpf: "",
            phone: "",
            email: "",
            birth_date: "",
            relationship: ""
          }
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleSuccessorChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      successor: { ...prev.successor, [field]: value }
    }));
  };

  const searchCep = async (cep) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            address: {
              ...prev.address,
              cep: cleanCep,
              street: data.logradouro || "",
              neighborhood: data.bairro || "",
              city: data.localidade || "",
              state: data.uf || ""
            }
          }));
        }
      } catch (error) {
        console.error("CEP Error:", error);
      }
    }
  };

  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const validateRequiredFields = () => {
    const errors = [];
    
    if (!formData.cpf || formData.cpf.length !== 11) {
      errors.push("CPF");
    }
    if (!formData.pix_key || !formData.pix_key_type) {
      errors.push("Chave PIX");
    }
    if (!formData.address.cep || !formData.address.street || !formData.address.number || 
        !formData.address.neighborhood || !formData.address.city || !formData.address.state) {
      errors.push("Endereço completo");
    }
    
    return errors;
  };

  const handleSave = async () => {
    if (!partner) return;
    
    const missingFields = validateRequiredFields();
    
    if (missingFields.length > 0) {
      toast.error(`Campos obrigatórios faltando: ${missingFields.join(", ")}`);
      return;
    }
    
    setSaving(true);
    try {
      // Check if all required fields are now complete
      const allComplete = formData.cpf && formData.pix_key && formData.pix_key_type &&
                         formData.address.cep && formData.address.street && formData.address.number &&
                         formData.address.neighborhood && formData.address.city && formData.address.state;
      
      const updateData = { ...formData };
      
      // Remove pending reasons if all fields are complete
      if (allComplete && partner.pending_reasons?.length > 0) {
        const newReasons = partner.pending_reasons.filter(r => r !== "Falta de informações no cadastro");
        updateData.pending_reasons = newReasons;
        
        // If only "first purchase" remains and no other reasons, keep status pending
        // If all reasons removed and first purchase done, set to active
        if (newReasons.length === 0 && partner.first_purchase_done) {
          updateData.status = "ativo";
        }
      }
      
      await base44.entities.Partner.update(partner.id, updateData);
      toast.success("Perfil atualizado com sucesso!");
      loadData();
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    // This would need backend logic to handle the redistribution
    toast.info("Entre em contato com o suporte para excluir sua conta.");
    setDeleteDialogOpen(false);
  };

  const calculateAnnualIncome = () => {
    if (!partner) return 0;
    return partner.total_withdrawn || 0;
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Meu Perfil</h1>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
        
        {partner?.status === 'pendente' && partner?.pending_reasons?.includes("Falta de informações no cadastro") && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <strong>Atenção:</strong> Complete os campos obrigatórios (CPF, PIX, Endereço) para remover as pendências do seu cadastro.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="personal" className="data-[state=active]:bg-orange-500">
            <User className="w-4 h-4 mr-2" />
            Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="address" className="data-[state=active]:bg-orange-500">
            <MapPin className="w-4 h-4 mr-2" />
            Endereço
          </TabsTrigger>
          <TabsTrigger value="bank" className="data-[state=active]:bg-orange-500">
            <CreditCard className="w-4 h-4 mr-2" />
            Dados Bancários
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-orange-500">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="successor" className="data-[state=active]:bg-orange-500">
            <Shield className="w-4 h-4 mr-2" />
            Sucessor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-white">Nome Completo</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Nome no Site de Divulgação</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => handleChange("display_name", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    placeholder="Nome ou apelido"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">E-mail de Cadastro</Label>
                  <Input
                    value={partner?.created_by || ""}
                    disabled
                    className="bg-zinc-900 border-zinc-700 text-gray-400"
                  />
                  <p className="text-gray-500 text-xs">Para alterar o e-mail, entre em contato com o suporte.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleChange("birth_date", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">CPF *</Label>
                  <Input
                    value={formatCPF(formData.cpf)}
                    onChange={(e) => handleChange("cpf", e.target.value.replace(/\D/g, ""))}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    maxLength={14}
                    placeholder="000.000.000-00"
                  />
                  {(!formData.cpf || formData.cpf.length !== 11) && (
                    <p className="text-red-500 text-xs">Campo obrigatório</p>
                  )}
                </div>
              </div>

              {/* Income Report */}
              {calculateAnnualIncome() >= 60000 && (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-200">
                    Seus rendimentos ultrapassaram R$ 60.000,00 este ano. Lembre-se de declarar à Receita Federal.
                    <Button variant="link" className="text-yellow-500 p-0 h-auto ml-2">
                      Baixar Relatório
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Password Change */}
              <div className="pt-6 border-t border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-4">Alterar Senha</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Senha Atual</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={passwordData.current}
                        onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                        className="bg-zinc-900 border-zinc-700 text-white pr-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Nova Senha</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={passwordData.new}
                      onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                      className="bg-zinc-900 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Confirmar Nova Senha</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      className="bg-zinc-900 border-zinc-700 text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={showPassword}
                    onCheckedChange={setShowPassword}
                  />
                  <Label className="text-gray-400 text-sm">Mostrar senhas</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-white">CEP *</Label>
                <Input
                  value={formData.address.cep}
                  onChange={(e) => {
                    handleAddressChange("cep", e.target.value);
                    searchCep(e.target.value);
                  }}
                  className="bg-zinc-900 border-zinc-700 text-white"
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">Rua *</Label>
                <Input
                  value={formData.address.street}
                  onChange={(e) => handleAddressChange("street", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Número *</Label>
                <Input
                  value={formData.address.number}
                  onChange={(e) => handleAddressChange("number", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
                <div className="space-y-2">
                  <Label className="text-white">Complemento</Label>
                  <Input
                    value={formData.address.complement}
                    onChange={(e) => handleAddressChange("complement", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Bairro *</Label>
                  <Input
                    value={formData.address.neighborhood}
                    onChange={(e) => handleAddressChange("neighborhood", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Cidade *</Label>
                  <Input
                    value={formData.address.city}
                    onChange={(e) => handleAddressChange("city", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Estado *</Label>
                  <Input
                    value={formData.address.state}
                    onChange={(e) => handleAddressChange("state", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    maxLength={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Informações Bancárias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dados da Conta */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Dados da Conta Bancária</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white">Banco</Label>
                    <Input
                      value={formData.bank_name || ""}
                      onChange={(e) => handleChange("bank_name", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="Nome do banco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Agência</Label>
                    <Input
                      value={formData.bank_agency || ""}
                      onChange={(e) => handleChange("bank_agency", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Conta</Label>
                    <Input
                      value={formData.bank_account || ""}
                      onChange={(e) => handleChange("bank_account", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="00000-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Nome do Titular</Label>
                    <Input
                      value={formData.bank_holder_name || ""}
                      onChange={(e) => handleChange("bank_holder_name", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="Nome completo do titular"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">CPF do Titular</Label>
                    <Input
                      value={formatCPF(formData.bank_holder_cpf || "")}
                      onChange={(e) => handleChange("bank_holder_cpf", e.target.value.replace(/\D/g, ""))}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      maxLength={14}
                      placeholder="000.000.000-00"
                    />
                    {formData.cpf && formData.bank_holder_cpf && formData.cpf !== formData.bank_holder_cpf && (
                      <p className="text-red-500 text-xs">⚠️ O CPF do titular deve ser o mesmo do cadastro</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Chave PIX */}
              <div className="pt-6 border-t border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-4">Chave PIX</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white">Tipo de Chave PIX *</Label>
                    <Select value={formData.pix_key_type} onValueChange={(v) => handleChange("pix_key_type", v)}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                        <SelectItem value="random">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Chave PIX *</Label>
                    <Input
                      value={formData.pix_key}
                      onChange={(e) => handleChange("pix_key", e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white"
                      placeholder="Sua chave PIX"
                    />
                    {(!formData.pix_key || !formData.pix_key_type) && (
                      <p className="text-red-500 text-xs">Campo obrigatório</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Preferências de Notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-white font-medium">E-mail</p>
                    <p className="text-gray-400 text-sm">Receber notificações por e-mail (obrigatório)</p>
                  </div>
                  <Switch checked={true} disabled className="data-[state=checked]:bg-orange-500" />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-white font-medium">SMS</p>
                    <p className="text-gray-400 text-sm">Receber notificações por SMS</p>
                  </div>
                  <Switch
                    checked={formData.notification_sms}
                    onCheckedChange={(checked) => handleChange("notification_sms", checked)}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-white font-medium">WhatsApp</p>
                    <p className="text-gray-400 text-sm">Receber notificações por WhatsApp</p>
                  </div>
                  <Switch
                    checked={formData.notification_whatsapp}
                    onCheckedChange={(checked) => handleChange("notification_whatsapp", checked)}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <Label className="text-white mb-3 block">Frequência das Notificações</Label>
                <Select value={formData.notification_frequency} onValueChange={(v) => handleChange("notification_frequency", v)}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="diariamente">Diariamente</SelectItem>
                    <SelectItem value="semanalmente">Semanalmente</SelectItem>
                    <SelectItem value="quinzenalmente">Quinzenalmente</SelectItem>
                    <SelectItem value="mensalmente">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="successor">
          <Card className="bg-zinc-950 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Informações do Sucessor</CardTitle>
              <p className="text-gray-400 text-sm">Em caso de falecimento, seus bônus e rede serão transferidos para o sucessor indicado.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-white">Nome Completo</Label>
                  <Input
                    value={formData.successor.full_name}
                    onChange={(e) => handleSuccessorChange("full_name", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">CPF</Label>
                  <Input
                    value={formatCPF(formData.successor.cpf || "")}
                    onChange={(e) => handleSuccessorChange("cpf", e.target.value.replace(/\D/g, ""))}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    maxLength={14}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Telefone</Label>
                  <Input
                    value={formData.successor.phone}
                    onChange={(e) => handleSuccessorChange("phone", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">E-mail</Label>
                  <Input
                    type="email"
                    value={formData.successor.email}
                    onChange={(e) => handleSuccessorChange("email", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.successor.birth_date}
                    onChange={(e) => handleSuccessorChange("birth_date", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Grau de Parentesco ou Amizade</Label>
                  <Input
                    value={formData.successor.relationship}
                    onChange={(e) => handleSuccessorChange("relationship", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    placeholder="Ex: Filho, Cônjuge, Amigo"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Account */}
      <Card className="bg-red-500/10 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-500 flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Excluir Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-500/10 border-red-500/30 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <AlertDescription className="text-red-200">
              <strong>ATENÇÃO:</strong> Ao excluir sua conta:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Você perde todos os clientes cadastrados</li>
                <li>Seus clientes serão repassados para seu indicador direto</li>
                <li>O saldo de bônus para depósito será depositado integralmente na sua conta</li>
                <li>O saldo de bônus para compras deve ser 100% gasto dentro de 30 dias</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="bg-red-500 hover:bg-red-600">
                <UserX className="w-4 h-4 mr-2" />
                Solicitar Exclusão da Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-red-500/30">
              <DialogHeader>
                <DialogTitle className="text-red-500">Confirmar Exclusão</DialogTitle>
              </DialogHeader>
              <p className="text-gray-300">
                Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteAccount}>
                  Confirmar Exclusão
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}