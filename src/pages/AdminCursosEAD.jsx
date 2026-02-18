import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function AdminCursosEAD() {
  const [user, setUser] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCurso, setEditingCurso] = useState(null);

  // Configurações EAD
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    idTutorGlobal: 259,
    urlRedirecionamentoEAD: "",
    ativo: true
  });

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    valorBonus: 0,
    idAssinaturaGlobal: 0,
    imagem: "",
    ativo: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      if (userData.role !== 'admin') {
        return;
      }

      const [allCursos, allCompras, allLogs, allConfigs] = await Promise.all([
        base44.entities.CursosEAD.list(),
        base44.entities.ComprasCursosEAD.list(),
        base44.entities.LogsIntegracaoEAD.list(),
        base44.entities.ConfiguracoesEAD.list()
      ]);

      setCursos(allCursos);
      setCompras(allCompras);
      setLogs(allLogs);

      if (allConfigs.length > 0) {
        const c = allConfigs[0];
        setConfig(c);
        setConfigForm({
          idTutorGlobal: c.idTutorGlobal || 259,
          urlRedirecionamentoEAD: c.urlRedirecionamentoEAD || "",
          ativo: c.ativo !== false
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (curso = null) => {
    if (curso) {
      setEditingCurso(curso);
      setFormData({
        nome: curso.nome,
        descricao: curso.descricao || "",
        valorBonus: curso.valorBonus,
        idAssinaturaGlobal: curso.idAssinaturaGlobal,
        imagem: curso.imagem || "",
        ativo: curso.ativo !== false
      });
    } else {
      setEditingCurso(null);
      setFormData({
        nome: "",
        descricao: "",
        valorBonus: 0,
        idAssinaturaGlobal: 0,
        imagem: "",
        ativo: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.valorBonus || !formData.idAssinaturaGlobal) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      if (editingCurso) {
        await base44.entities.CursosEAD.update(editingCurso.id, formData);
        toast.success("Curso atualizado com sucesso");
      } else {
        await base44.entities.CursosEAD.create(formData);
        toast.success("Curso criado com sucesso");
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao salvar curso");
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm.idTutorGlobal || !configForm.urlRedirecionamentoEAD) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSavingConfig(true);
    try {
      if (config) {
        await base44.entities.ConfiguracoesEAD.update(config.id, configForm);
      } else {
        const created = await base44.entities.ConfiguracoesEAD.create(configForm);
        setConfig(created);
      }
      toast.success("Configuração salva com sucesso");
      // Recarregar config
      const allConfigs = await base44.entities.ConfiguracoesEAD.list();
      if (allConfigs.length > 0) setConfig(allConfigs[0]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este curso?")) return;

    try {
      await base44.entities.CursosEAD.delete(id);
      toast.success("Curso excluído com sucesso");
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao excluir curso");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Acesso negado. Apenas administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Administração EAD</h1>
          <p className="text-gray-400">Gerencie cursos, compras e logs</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Novo Curso
        </Button>
      </div>

      <Tabs defaultValue="cursos" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="cursos" className="data-[state=active]:bg-orange-500">
            Cursos ({cursos.length})
          </TabsTrigger>
          <TabsTrigger value="compras" className="data-[state=active]:bg-orange-500">
            Compras ({compras.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-orange-500">
            Logs ({logs.length})
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="data-[state=active]:bg-orange-500">
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cursos">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cursos.map((curso) => (
              <Card key={curso.id} className="bg-zinc-950 border-orange-500/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-white text-lg">{curso.nome}</CardTitle>
                    <Badge className={curso.ativo ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}>
                      {curso.ativo ? "ATIVO" : "INATIVO"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-400 text-sm line-clamp-2">{curso.descricao}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Valor Bônus</p>
                      <p className="text-orange-500 font-semibold">{curso.valorBonus}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">ID Assinatura</p>
                      <p className="text-white">{curso.idAssinaturaGlobal}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleOpenDialog(curso)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleDelete(curso.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-500 border-red-500/50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="compras">
          <div className="space-y-4">
            {compras.map((compra) => (
              <Card key={compra.id} className="bg-zinc-950 border-orange-500/20">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="text-gray-500 text-xs">Usuário</p>
                      <p className="text-white text-sm">{compra.usuarioEmail}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Curso</p>
                      <p className="text-white text-sm">{compra.cursoNome}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Data</p>
                      <p className="text-white text-sm">
                        {new Date(compra.dataCompra).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Status</p>
                      <Badge className={
                        compra.status === 'LIBERADO' ? "bg-green-500/20 text-green-500" :
                        compra.status === 'ERRO' ? "bg-red-500/20 text-red-500" :
                        "bg-yellow-500/20 text-yellow-500"
                      }>
                        {compra.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Valor</p>
                      <p className="text-orange-500 font-semibold">{compra.valorBonus}</p>
                    </div>
                  </div>
                  {compra.mensagemErro && (
                    <div className="mt-3 p-2 bg-red-500/10 rounded border border-red-500/20">
                      <p className="text-red-400 text-xs">{compra.mensagemErro}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="bg-zinc-950 border-orange-500/20">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Email</p>
                      <p className="text-white">{log.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Ação</p>
                      <Badge className="bg-blue-500/20 text-blue-500">{log.acao}</Badge>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Status</p>
                      <Badge className={log.sucesso ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}>
                        {log.sucesso ? "SUCESSO" : "ERRO"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Data</p>
                      <p className="text-white">{new Date(log.data).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-500 text-xs">Resposta API</p>
                      <p className="text-gray-400 text-xs truncate">{log.respostaAPI}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="configuracoes">
          <Card className="bg-zinc-950 border-orange-500/20 max-w-xl">
            <CardHeader>
              <CardTitle className="text-white">
                {config ? "Editar Configuração GlobalEAD" : "Criar Configuração GlobalEAD"}
              </CardTitle>
              {config && (
                <p className="text-gray-500 text-xs">Existe um único registro de configuração. Edite os campos abaixo.</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white">ID do Tutor Global *</Label>
                <Input
                  type="number"
                  value={configForm.idTutorGlobal}
                  onChange={(e) => setConfigForm({ ...configForm, idTutorGlobal: parseInt(e.target.value) || 0 })}
                  className="bg-zinc-900 border-zinc-700 text-white mt-1"
                  placeholder="Ex: 259"
                />
              </div>
              <div>
                <Label className="text-white">URL de Redirecionamento EAD *</Label>
                <Input
                  value={configForm.urlRedirecionamentoEAD}
                  onChange={(e) => setConfigForm({ ...configForm, urlRedirecionamentoEAD: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 text-white mt-1"
                  placeholder="https://seudominioead.com.br"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={configForm.ativo}
                  onCheckedChange={(checked) => setConfigForm({ ...configForm, ativo: checked })}
                />
                <Label className="text-white">Configuração Ativa</Label>
              </div>
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {savingConfig ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {savingConfig ? "Salvando..." : "Salvar Configuração"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Criar/Editar Curso */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCurso ? "Editar Curso" : "Novo Curso"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white">Nome do Curso *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label className="text-white">Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="bg-zinc-900 border-zinc-700 text-white"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Valor em Bônus *</Label>
                <Input
                  type="number"
                  value={formData.valorBonus}
                  onChange={(e) => setFormData({ ...formData, valorBonus: parseFloat(e.target.value) || 0 })}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <div>
                <Label className="text-white">ID Assinatura Global *</Label>
                <Input
                  type="number"
                  value={formData.idAssinaturaGlobal}
                  onChange={(e) => setFormData({ ...formData, idAssinaturaGlobal: parseInt(e.target.value) || 0 })}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-white">URL da Imagem</Label>
              <Input
                value={formData.imagem}
                onChange={(e) => setFormData({ ...formData, imagem: e.target.value })}
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label className="text-white">Curso Ativo</Label>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setDialogOpen(false)}
                variant="outline"
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}