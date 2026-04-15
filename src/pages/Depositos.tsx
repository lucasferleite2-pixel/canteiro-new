import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Warehouse, Loader2, Pencil, Package } from "lucide-react";
import { formatBRL } from "@/lib/estoqueUtils";
import { Link } from "react-router-dom";

const TIPO_LABELS: Record<string, string> = {
  almoxarifado: "Almoxarifado",
  deposito: "Depósito",
  obra: "Obra",
  fornecedor: "Fornecedor",
  baixa: "Baixa",
};

const TIPO_COLORS: Record<string, string> = {
  almoxarifado: "bg-blue-100 text-blue-700 border-blue-200",
  deposito: "bg-gray-100 text-gray-700 border-gray-200",
  obra: "bg-orange-100 text-orange-700 border-orange-200",
  fornecedor: "bg-purple-100 text-purple-700 border-purple-200",
  baixa: "bg-red-100 text-red-700 border-red-200",
};

const emptyForm = {
  nome: "",
  tipo: "almoxarifado",
  project_id: "",
  responsavel: "",
  endereco: "",
  ativo: true,
  descricao: "",
};

export default function Depositos() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: depositos = [], isLoading } = useQuery({
    queryKey: ["depositos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("depositos").select("*").eq("company_id", companyId).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["estoque_saldos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("estoque_saldos").select("deposito_id, quantidade, custo_medio").eq("company_id", companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const saldosByDeposito = (saldos as any[]).reduce((acc: Record<string, { count: number; valor: number }>, s: any) => {
    if (!acc[s.deposito_id]) acc[s.deposito_id] = { count: 0, valor: 0 };
    acc[s.deposito_id].count++;
    acc[s.deposito_id].valor += Number(s.quantidade) * Number(s.custo_medio);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      if (!f.nome.trim()) throw new Error("Nome obrigatório");
      const payload: Record<string, any> = {
        company_id: companyId!,
        nome: f.nome.trim(),
        tipo: f.tipo,
        project_id: f.project_id || null,
        responsavel: f.responsavel || null,
        endereco: f.endereco || null,
        ativo: f.ativo,
        descricao: f.descricao || null,
      };
      if (editId) {
        const { error } = await (supabase as any).from("depositos").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("depositos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depositos"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
      toast({ title: editId ? "Depósito atualizado!" : "Depósito criado!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from("depositos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["depositos"] }),
  });

  const openEdit = (d: any) => {
    setForm({
      nome: d.nome || "",
      tipo: d.tipo || "almoxarifado",
      project_id: d.project_id || "",
      responsavel: d.responsavel || "",
      endereco: d.endereco || "",
      ativo: d.ativo ?? true,
      descricao: d.descricao || "",
    });
    setEditId(d.id);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Depósitos e Almoxarifados</h1>
          <p className="text-muted-foreground text-sm">Gerencie os locais de armazenamento de materiais.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Depósito
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (depositos as any[]).length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Warehouse className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum depósito cadastrado.</p>
          <Button variant="outline" onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Depósito</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(depositos as any[]).map((d: any) => {
            const info = saldosByDeposito[d.id] || { count: 0, valor: 0 };
            const projeto = (projects as any[]).find((p: any) => p.id === d.project_id);
            return (
              <Card key={d.id} className={`${!d.ativo ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{d.nome}</CardTitle>
                    <Badge variant="outline" className={`text-xs shrink-0 ${TIPO_COLORS[d.tipo] || ""}`}>{TIPO_LABELS[d.tipo] || d.tipo}</Badge>
                  </div>
                  {projeto && <p className="text-xs text-muted-foreground">Obra: {projeto.name}</p>}
                  {d.responsavel && <p className="text-xs text-muted-foreground">Responsável: {d.responsavel}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Produtos</p>
                      <p className="font-semibold">{info.count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor Total</p>
                      <p className="font-semibold">{formatBRL(info.valor)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(d)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to={`/estoque?deposito=${d.id}`}>
                        <Package className="h-3 w-3 mr-1" /> Ver estoque
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => toggleAtivo.mutate({ id: d.id, ativo: !d.ativo })}
                    >
                      {d.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar Depósito" : "Novo Depósito"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do depósito" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Obra vinculada</Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Endereço ou localização" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} id="dep-ativo" />
              <Label htmlFor="dep-ativo">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
