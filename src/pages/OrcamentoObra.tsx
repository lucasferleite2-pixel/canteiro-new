import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Calculator, Loader2, FileDown, Layers } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const emptyForm = {
  sinapi_code: "",
  description: "",
  category: "",
  phase: "",
  unit: "m²",
  quantity: "",
  unit_price: "",
  bdi_percent: "0",
};

export default function OrcamentoObra() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [groupByPhase, setGroupByPhase] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["project_phases", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("project_phases").select("id, name").eq("project_id", selectedProject);
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["obra_budget_items", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("obra_budget_items").select("*").eq("project_id", selectedProject).order("phase").order("description");
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        sinapi_code: values.sinapi_code || null,
        description: values.description,
        category: values.category || null,
        phase: values.phase || null,
        unit: values.unit,
        quantity: Number(values.quantity) || 0,
        unit_price: Number(values.unit_price) || 0,
        bdi_percent: Number(values.bdi_percent) || 0,
        company_id: companyId!,
        project_id: selectedProject,
      };
      if (editingItem) {
        const { error } = await supabase.from("obra_budget_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obra_budget_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_budget_items"] });
      setDialogOpen(false);
      setEditingItem(null);
      setForm(emptyForm);
      toast({ title: editingItem ? "Item atualizado!" : "Item adicionado!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_budget_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_budget_items"] });
      setDeleteId(null);
      toast({ title: "Item excluído!" });
    },
  });

  const totalGeral = items.reduce((s: number, i: any) => s + (Number(i.total_price) || 0), 0);

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({
      sinapi_code: item.sinapi_code || "",
      description: item.description || "",
      category: item.category || "",
      phase: item.phase || "",
      unit: item.unit || "m²",
      quantity: String(item.quantity || ""),
      unit_price: String(item.unit_price || ""),
      bdi_percent: String(item.bdi_percent || "0"),
    });
    setDialogOpen(true);
  };

  const exportPDF = () => {
    const projectName = projects.find((p: any) => p.id === selectedProject)?.name || "Obra";
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Orçamento — ${projectName}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);

    const tableData = items.map((i: any) => [
      i.sinapi_code || "",
      i.description,
      i.phase || "",
      i.unit,
      Number(i.quantity).toFixed(2),
      `R$ ${Number(i.unit_price).toFixed(2)}`,
      `${Number(i.bdi_percent).toFixed(1)}%`,
      `R$ ${Number(i.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: 30,
      head: [["SINAPI", "Descrição", "Fase", "Un", "Qtd", "P.Unit.", "BDI", "Total"]],
      body: tableData,
      styles: { fontSize: 8 },
      columnStyles: { 1: { cellWidth: 50 } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(11);
    doc.text(`Total Geral: R$ ${totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, finalY + 10);
    doc.save(`orcamento-${projectName}.pdf`);
  };

  const renderTable = (rows: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SINAPI</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Fase</TableHead>
          <TableHead>Un</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead className="text-right">P. Unit.</TableHead>
          <TableHead className="text-right">BDI%</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((i: any) => (
          <TableRow key={i.id}>
            <TableCell className="text-muted-foreground text-xs">{i.sinapi_code || "—"}</TableCell>
            <TableCell className="font-medium">{i.description}</TableCell>
            <TableCell>{i.phase || "—"}</TableCell>
            <TableCell>{i.unit}</TableCell>
            <TableCell className="text-right">{Number(i.quantity).toFixed(2)}</TableCell>
            <TableCell className="text-right">R$ {Number(i.unit_price).toFixed(2)}</TableCell>
            <TableCell className="text-right">{Number(i.bdi_percent).toFixed(1)}%</TableCell>
            <TableCell className="text-right font-medium">R$ {Number(i.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(i.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderGrouped = () => {
    const groups = new Map<string, any[]>();
    items.forEach((i: any) => {
      const key = i.phase || "Sem fase";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    });
    return Array.from(groups.entries()).map(([phase, rows]) => (
      <div key={phase} className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pt-2">{phase}</h3>
        <div className="rounded-md border">{renderTable(rows)}</div>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamento</h1>
          <p className="text-muted-foreground text-sm">Itens de custo por obra com composições SINAPI.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setGroupByPhase(g => !g)}>
            <Layers className="mr-2 h-4 w-4" /> {groupByPhase ? "Sem agrupamento" : "Agrupar por fase"}
          </Button>
          {items.length > 0 && (
            <Button variant="outline" onClick={exportPDF}>
              <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
          )}
          <Button onClick={() => { setEditingItem(null); setForm(emptyForm); setDialogOpen(true); }} disabled={!selectedProject}>
            <Plus className="mr-2 h-4 w-4" /> Novo Item
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Obra:</Label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Selecione uma obra" /></SelectTrigger>
          <SelectContent>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!selectedProject ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Selecione uma obra para gerenciar o orçamento.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum item de orçamento cadastrado.</p>
          <Button variant="outline" onClick={() => { setEditingItem(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Item
          </Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {groupByPhase ? renderGrouped() : <div className="rounded-md border">{renderTable(items)}</div>}
          <Card>
            <CardFooter className="py-4 flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Geral</p>
                <p className="text-2xl font-bold">R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item de Orçamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Código SINAPI</Label>
                <Input value={form.sinapi_code} onChange={e => setForm(f => ({ ...f, sinapi_code: e.target.value }))} placeholder="Ex: 87452" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Estrutura" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Concretagem de laje" />
            </div>
            <div className="space-y-2">
              <Label>Fase</Label>
              <Select value={form.phase} onValueChange={v => setForm(f => ({ ...f, phase: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem fase</SelectItem>
                  {phases.map((ph: any) => <SelectItem key={ph.id} value={ph.name}>{ph.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Preço Unit. (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>BDI (%)</Label>
              <Input type="number" min="0" max="100" value={form.bdi_percent} onChange={e => setForm(f => ({ ...f, bdi_percent: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.description || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
