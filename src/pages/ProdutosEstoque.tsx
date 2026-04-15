import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Box, Loader2, Pencil, Trash2 } from "lucide-react";
import { calcularStatusEstoque, formatBRL } from "@/lib/estoqueUtils";

const UNIDADES = ["un", "kg", "m", "m²", "m³", "L", "cx", "pç", "h"];
const CATEGORIAS = ["Material", "Ferramental", "EPI", "Equipamento", "Consumível"];

const emptyForm = {
  codigo: "",
  nome: "",
  descricao: "",
  unidade: "un",
  categoria: "",
  estoque_minimo: "",
  estoque_maximo: "",
};

export default function ProdutosEstoque() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos_estoque", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("produtos_estoque")
        .select("id, codigo, nome, unidade, categoria, estoque_minimo, estoque_maximo, preco_custo_medio, descricao, ativo")
        .eq("company_id", companyId)
        .order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["estoque_saldos_totais", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("estoque_saldos").select("produto_id, quantidade").eq("company_id", companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const saldoByProduto = (saldos as any[]).reduce((acc: Record<string, number>, s: any) => {
    acc[s.produto_id] = (acc[s.produto_id] || 0) + Number(s.quantidade);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      if (!f.nome.trim()) throw new Error("Nome obrigatório");
      const payload: Record<string, any> = {
        company_id: companyId!,
        nome: f.nome.trim(),
        codigo: f.codigo.trim() || null,
        descricao: f.descricao || null,
        unidade: f.unidade,
        categoria: f.categoria || null,
        estoque_minimo: parseFloat(f.estoque_minimo) || 0,
        estoque_maximo: f.estoque_maximo ? parseFloat(f.estoque_maximo) : null,
      };
      if (editId) {
        const { error } = await (supabase as any).from("produtos_estoque").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("produtos_estoque").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos_estoque"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
      toast({ title: editId ? "Produto atualizado!" : "Produto criado!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("produtos_estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos_estoque"] });
      toast({ title: "Produto removido!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const filtered = (produtos as any[]).filter((p: any) => {
    if (search && !p.nome.toLowerCase().includes(search.toLowerCase()) && !(p.codigo || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "all" && p.categoria !== catFilter) return false;
    return true;
  });

  const openEdit = (p: any) => {
    setForm({
      codigo: p.codigo || "",
      nome: p.nome || "",
      descricao: p.descricao || "",
      unidade: p.unidade || "un",
      categoria: p.categoria || "",
      estoque_minimo: p.estoque_minimo != null ? String(p.estoque_minimo) : "",
      estoque_maximo: p.estoque_maximo != null ? String(p.estoque_maximo) : "",
    });
    setEditId(p.id);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground text-sm">Catálogo de produtos e materiais de estoque.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Box className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum produto cadastrado.</p>
          <Button variant="outline" onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
        </CardContent></Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Est. Mínimo</TableHead>
                <TableHead className="text-right">Custo Médio</TableHead>
                <TableHead className="text-right">Saldo Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => {
                const saldo = saldoByProduto[p.id] || 0;
                const status = calcularStatusEstoque(saldo, Number(p.estoque_minimo), p.estoque_maximo ? Number(p.estoque_maximo) : undefined);
                const BADGE: Record<string, { label: string; className: string }> = {
                  critico: { label: "Crítico", className: "bg-red-100 text-red-700 border-red-200" },
                  baixo: { label: "Baixo", className: "bg-orange-100 text-orange-700 border-orange-200" },
                  normal: { label: "Normal", className: "bg-green-100 text-green-700 border-green-200" },
                  alto: { label: "Alto", className: "bg-blue-100 text-blue-700 border-blue-200" },
                };
                const b = BADGE[status];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-sm">{p.codigo || "—"}</TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.categoria ? <Badge variant="outline" className="text-xs">{p.categoria}</Badge> : "—"}</TableCell>
                    <TableCell>{p.unidade}</TableCell>
                    <TableCell className="text-right">{Number(p.estoque_minimo).toLocaleString("pt-BR")} {p.unidade}</TableCell>
                    <TableCell className="text-right">{Number(p.preco_custo_medio) > 0 ? formatBRL(Number(p.preco_custo_medio)) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{saldo.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {p.unidade}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${b.className}`}>{b.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Auto" />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do produto" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione ou deixe em branco" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem categoria</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estoque Mínimo</Label>
                <Input type="number" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Estoque Máximo</Label>
                <Input type="number" value={form.estoque_maximo} onChange={e => setForm(f => ({ ...f, estoque_maximo: e.target.value }))} placeholder="Opcional" />
              </div>
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
