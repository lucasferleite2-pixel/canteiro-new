import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Layers, Search, X } from "lucide-react";
import { toast } from "sonner";

type ComposicaoItem = {
  id?: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  tipo: "material" | "mao_obra" | "equipamento" | "servico";
};

type Composicao = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  custo_total: number;
  notas: string | null;
  ativa: boolean;
};

const TIPO_COLORS: Record<string, string> = {
  material: "bg-blue-100 text-blue-800",
  mao_obra: "bg-green-100 text-green-800",
  equipamento: "bg-orange-100 text-orange-800",
  servico: "bg-purple-100 text-purple-800",
};

const TIPO_LABELS: Record<string, string> = {
  material: "Material",
  mao_obra: "Mão de Obra",
  equipamento: "Equipamento",
  servico: "Serviço",
};

const UNITS = ["m²", "m", "un", "kg", "h", "vb", "m³", "t", "l", "cj"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emptyItem = (): ComposicaoItem => ({
  descricao: "",
  unidade: "un",
  quantidade: 1,
  preco_unitario: 0,
  tipo: "material",
});

export default function Composicoes() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ codigo: "", descricao: "", unidade: "m²", notas: "" });
  const [itens, setItens] = useState<ComposicaoItem[]>([emptyItem()]);

  const { data: composicoes = [], isLoading } = useQuery<Composicao[]>({
    queryKey: ["composicoes_proprias", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("composicoes_proprias").select("*").eq("company_id", companyId).eq("ativa", true).order("descricao");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() =>
    composicoes.filter(c =>
      c.descricao.toLowerCase().includes(search.toLowerCase()) ||
      (c.codigo && c.codigo.toLowerCase().includes(search.toLowerCase()))
    ), [composicoes, search]);

  const custo_total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  function resetForm() {
    setForm({ codigo: "", descricao: "", unidade: "m²", notas: "" });
    setItens([emptyItem()]);
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(c: Composicao) {
    setEditingId(c.id);
    setForm({ codigo: c.codigo || "", descricao: c.descricao, unidade: c.unidade, notas: c.notas || "" });
    // Load items
    (supabase as any).from("composicao_itens").select("*").eq("composicao_id", c.id).then(({ data }: any) => {
      setItens(data && data.length > 0 ? data.map((d: any) => ({ id: d.id, descricao: d.descricao, unidade: d.unidade, quantidade: d.quantidade, preco_unitario: d.preco_unitario, tipo: d.tipo })) : [emptyItem()]);
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      if (!form.descricao) throw new Error("Descrição obrigatória");

      const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

      if (editingId) {
        const { error } = await (supabase as any).from("composicoes_proprias").update({
          codigo: form.codigo || null,
          descricao: form.descricao,
          unidade: form.unidade,
          notas: form.notas || null,
          custo_total: total,
        }).eq("id", editingId);
        if (error) throw error;
        // Replace items
        await (supabase as any).from("composicao_itens").delete().eq("composicao_id", editingId);
        if (itens.filter(i => i.descricao).length > 0) {
          await (supabase as any).from("composicao_itens").insert(
            itens.filter(i => i.descricao).map(i => ({ composicao_id: editingId, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade, preco_unitario: i.preco_unitario, tipo: i.tipo }))
          );
        }
      } else {
        const { data: comp, error } = await (supabase as any).from("composicoes_proprias").insert({
          company_id: companyId,
          codigo: form.codigo || null,
          descricao: form.descricao,
          unidade: form.unidade,
          notas: form.notas || null,
          custo_total: total,
        }).select().single();
        if (error) throw error;
        if (itens.filter(i => i.descricao).length > 0) {
          await (supabase as any).from("composicao_itens").insert(
            itens.filter(i => i.descricao).map(i => ({ composicao_id: comp.id, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade, preco_unitario: i.preco_unitario, tipo: i.tipo }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composicoes_proprias"] });
      toast.success(editingId ? "Composição atualizada" : "Composição criada");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("composicoes_proprias").update({ ativa: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composicoes_proprias"] });
      toast.success("Composição removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function updateItem(idx: number, field: keyof ComposicaoItem, value: any) {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItens(prev => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6" />Composições Próprias</h1>
          <p className="text-sm text-muted-foreground">Composições de custo customizadas da empresa</p>
        </div>
        <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" />Nova Composição</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar composição..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(c => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {c.codigo && <div className="text-xs text-blue-600 font-mono mb-0.5">{c.codigo}</div>}
                  <div className="font-medium text-sm">{c.descricao}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Unidade: {c.unidade}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Custo total</span>
                <span className="font-bold text-sm">{fmt(c.custo_total)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            {search ? "Nenhuma composição encontrada." : "Nenhuma composição cadastrada. Clique em \"Nova Composição\" para começar."}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Composição" : "Nova Composição"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código (opcional)</Label>
                <Input className="h-9 text-sm" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: CP-001" />
              </div>
              <div>
                <Label className="text-xs">Unidade *</Label>
                <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Descrição *</Label>
                <Input className="h-9 text-sm" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Notas</Label>
                <Textarea className="text-sm resize-none" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>

            {/* Insumos table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">Insumos</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addItem}><Plus className="h-3 w-3" />Adicionar</Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-28">Tipo</TableHead>
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="text-xs w-16">Un</TableHead>
                      <TableHead className="text-xs w-20">Qtd</TableHead>
                      <TableHead className="text-xs w-24">Preço Unit</TableHead>
                      <TableHead className="text-xs w-24 text-right">Total</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="p-1">
                          <Select value={item.tipo} onValueChange={v => updateItem(idx, "tipo", v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input className="h-7 text-xs" value={item.descricao} onChange={e => updateItem(idx, "descricao", e.target.value)} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input className="h-7 text-xs w-14" value={item.unidade} onChange={e => updateItem(idx, "unidade", e.target.value)} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input className="h-7 text-xs w-16" type="number" min="0" step="0.001" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", parseFloat(e.target.value) || 0)} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input className="h-7 text-xs w-20" type="number" min="0" step="0.01" value={item.preco_unitario} onChange={e => updateItem(idx, "preco_unitario", parseFloat(e.target.value) || 0)} />
                        </TableCell>
                        <TableCell className="p-1 text-right text-xs font-medium">{fmt(item.quantidade * item.preco_unitario)}</TableCell>
                        <TableCell className="p-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(idx)}><X className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end mt-2 pr-2">
                <div className="text-sm font-bold">Total calculado: {fmt(custo_total)}</div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
