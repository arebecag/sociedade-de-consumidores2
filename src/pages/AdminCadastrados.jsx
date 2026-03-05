import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search, Users } from "lucide-react";
import { toast } from "sonner";

export default function AdminCadastrados() {
  const [partners, setPartners] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setIsAdmin(u?.role === 'admin');
      if (u?.role === 'admin') loadPartners();
      else setLoading(false);
    }).catch(() => { setIsAdmin(false); setLoading(false); });
  }, []);

  const loadPartners = async () => {
    try {
      const all = await base44.entities.Partner.list('-created_date', 1000);
      setPartners(all);
      setFiltered(all);
    } catch (e) {
      toast.error("Erro ao carregar cadastrados");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val) => {
    setSearch(val);
    const q = val.toLowerCase();
    setFiltered(partners.filter(p =>
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.unique_code?.toLowerCase().includes(q)
    ));
  };

  const exportCSV = () => {
    const header = "Nome,E-mail,Celular,Código,Status,Data Cadastro";
    const rows = filtered.map(p =>
      `"${p.full_name || ''}","${p.email || p.created_by || ''}","${p.phone || ''}","${p.unique_code || ''}","${p.status || ''}","${new Date(p.created_date).toLocaleDateString('pt-BR')}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cadastrados.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  if (loading || isAdmin === null) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }

  if (!isAdmin) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-red-400">Acesso negado</p></div>;
  }

  const statusColor = (s) => s === 'ativo' ? 'bg-green-500/20 text-green-400' : s === 'pendente' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Lista de Cadastrados</h1>
          <p className="text-gray-400">{filtered.length} de {partners.length} parceiros</p>
        </div>
        <Button onClick={exportCSV} className="bg-orange-500 hover:bg-orange-600">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, celular ou código..."
          className="bg-zinc-900 border-zinc-700 text-white pl-9"
        />
      </div>

      <Card className="bg-zinc-950 border-orange-500/20">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-gray-400 font-medium p-4">Nome</th>
                  <th className="text-left text-gray-400 font-medium p-4">E-mail</th>
                  <th className="text-left text-gray-400 font-medium p-4">Celular</th>
                  <th className="text-left text-gray-400 font-medium p-4">Código</th>
                  <th className="text-left text-gray-400 font-medium p-4">Status</th>
                  <th className="text-left text-gray-400 font-medium p-4">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 text-white font-medium">{p.full_name || "—"}</td>
                    <td className="p-4 text-gray-300">{p.email || p.created_by || "—"}</td>
                    <td className="p-4 text-gray-300">{p.phone || "—"}</td>
                    <td className="p-4 text-orange-400 font-mono text-xs">{p.unique_code || "—"}</td>
                    <td className="p-4">
                      <Badge className={statusColor(p.status)}>{p.status?.toUpperCase() || "—"}</Badge>
                    </td>
                    <td className="p-4 text-gray-500">{new Date(p.created_date).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-gray-500">Nenhum resultado encontrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}