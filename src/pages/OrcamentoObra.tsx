import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { calcularTotalOrcamento, parseOrcamentoFile, searchSinapi, type OrcamentoItem, type SinapiComposicao, type ParsedOrcamentoRow } from "@/lib/sinapiUtils";
import { gerarPropostaComercialPDF } from "@/lib/orcamentoPdfGenerator";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, Pencil, Trash2, Calculator, Loader2, FileDown, Layers, Upload, Search, Copy, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  origem: "manual" as "manual" | "sinapi" | "composicao_propria",
  fase: "",
  codigo: "",
  descricao: "",
  unidade: "m²",
  quantidade: "1",
  preco_unitario: "0",
  bdi: "0",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ORIGEM_BADGE: Record<string, { label: string; className: string }> = {
  sinapi: { label: "SINAPI", className: "bg-blue-100 text-blue-800" },
  composicao_propria: { label: "Própria", className: "bg-purple-100 text-purple-800" },
  manual: { label: "Manual", className: "bg-gray-100 text-gray-800" },
};

export default function OrcamentoObra() {
  const { companyId } = useAuth();
  const { toast: toastLegacy } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedProject, setSelectedProject] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [groupByPhase, setGroupByPhase] = useState(true);

  // SINAPI inline search
  const [sinapiQuery, setSinapiQuery] = useState("");
  const [sinapiResults, setSinapiResults] = useState<SinapiComposicao[]>([]);
  const [sinapiSearching, setSinapiSearching] = useState(false);

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedOrcamentoRow[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Curva ABC
  const [curvaOpen, setCurvaOpen] = useState(false);

  // Queries
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: composicoes = [] } = useQuery({
    queryKey: ["composicoes_proprias", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("composicoes_proprias").select("*").eq("company_id", companyId).eq("ativa", true).order("descricao");
      return data || [];
    },
  });

  // New orcamento_itens
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["orcamento_itens", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await (supabase as any).from("orcamento_itens").select("*").eq("project_id", selectedProject).order("ordem").order("fase").order("descricao");
      return (data || []).map((d: any) => ({
        ...d,
        preco_unitario: Number(d.preco_unitario || 0),
        quantidade: Number(d.quantidade || 0),
        bdi: Number(d.bdi || 0),
      }));
    },
    enabled: !!selectedProject,
  });

  const { subtotal, totalComBdi, curvaABC, porFase } = useMemo(
    () => calcularTotalOrcamento(itens as OrcamentoItem[]),
    [itens]
  );
  const bdiMedio = subtotal > 0 ? ((totalComBdi - subtotal) / subtotal) * 100 : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.descricao) throw new Error("Descrição obrigatória");
      const payload: any = {
        project_id: selectedProject,
        company_id: companyId,
        fase: form.fase || null,
        codigo: form.codigo || null,
        descricao: form.descricao,
        unidade: form.unidade,
        quantidade: parseFloat(form.quantidade) || 1,
        preco_unitario: parseFloat(form.preco_unitario) || 0,
        bdi: parseFloat(form.bdi) || 0,
        origem: form.origem,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("orcamento_itens").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("orcamento_itens").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamento_itens"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      setSinapiQuery("");
      setSinapiResults([]);
      toast.success(editingId ? "Item atualizado" : "Item adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("orcamento_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamento_itens"] });
      setDeleteId(null);
      toast.success("Item excluído");
    },
  });

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSinapiQuery("");
    setSinapiResults([]);
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditingId(item.id);
    setForm({
      origem: item.origem || "manual",
      fase: item.fase || "",
      codigo: item.codigo || "",
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: String(item.quantidade),
      preco_unitario: String(item.preco_unitario),
      bdi: String(item.bdi || 0),
    });
    setSinapiQuery("");
    setSinapiResults([]);
    setDialogOpen(true);
  }

  async function duplicateItem(item: any) {
    const { error } = await (supabase as any).from("orcamento_itens").insert({
      project_id: selectedProject,
      company_id: companyId,
      fase: item.fase,
      codigo: item.codigo,
      descricao: item.descricao + " (cópia)",
      unidade: item.unidade,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      bdi: item.bdi,
      origem: item.origem,
    });
    if (error) toast.error(error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ["orcamento_itens"] });
      toast.success("Item duplicado");
    }
  }

  async function handleSinapiSearch(q: string) {
    setSinapiQuery(q);
    if (q.length < 2) { setSinapiResults([]); return; }
    setSinapiSearching(true);
    try {
      const results = await searchSinapi(supabase as any, q, "NACIONAL", 10);
      setSinapiResults(results);
    } catch {
      setSinapiResults([]);
    } finally {
      setSinapiSearching(false);
    }
  }

  function selectSinapiItem(c: SinapiComposicao) {
    setForm(f => ({
      ...f,
      codigo: c.codigo,
      descricao: c.descricao,
      unidade: c.unidade,
      preco_unitario: String(c.custo_total),
      origem: "sinapi",
    }));
    setSinapiResults([]);
    setSinapiQuery(c.descricao);
  }

  function selectComposicaoItem(c: any) {
    setForm(f => ({
      ...f,
      codigo: c.codigo || "",
      descricao: c.descricao,
      unidade: c.unidade,
      preco_unitario: String(c.custo_total),
      origem: "composicao_propria",
    }));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    try {
      const rows = await parseOrcamentoFile(file);
      setImportPreview(rows);
      setImportOpen(true);
    } catch (err: any) {
      toast.error(err.message);
    }
    e.target.value = "";
  }

  async function handleImportConfirm() {
    if (!companyId || !selectedProject) return;
    setImporting(true);
    try {
      const payload = importPreview.map((r, i) => ({
        project_id: selectedProject,
        company_id: companyId,
        fase: r.fase || null,
        codigo: r.codigo || null,
        descricao: r.descricao,
        unidade: r.unidade,
        quantidade: r.quantidade,
        preco_unitario: r.preco_unitario,
        bdi: r.bdi || 0,
        origem: "manual",
        ordem: i,
      }));
      const { error } = await (supabase as any).from("orcamento_itens").insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["orcamento_itens"] });
      toast.success(`${payload.length} itens importados com sucesso`);
      setImportOpen(false);
      setImportPreview([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  const projeto = projects.find((p: any) => p.id === selectedProject);

  function renderRows(rows: any[]) {
    return rows.map((i: any) => {
      const total = i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100);
      const badge = ORIGEM_BADGE[i.origem as string] || ORIGEM_BADGE.manual;
      return (
        <TableRow key={i.id} className="text-xs">
          <TableCell className="font-mono text-muted-foreground">{i.codigo || "—"}</TableCell>
          <TableCell className="font-medium max-w-[200px] truncate">{i.descricao}</TableCell>
          <TableCell>{i.unidade}</TableCell>
          <TableCell className="text-right">{i.quantidade.toFixed(2)}</TableCell>
          <TableCell className="text-right">{fmt(i.preco_unitario)}</TableCell>
          <TableCell className="text-right">{(i.bdi || 0).toFixed(1)}%</TableCell>
          <TableCell className="text-right font-bold">{fmt(total)}</TableCell>
          <TableCell>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.className}`}>{badge.label}</span>
          </TableCell>
          <TableCell>
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(i)}><Pencil className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicateItem(i)}><Copy className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(i.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </TableCell>
        </TableRow>
      );
    });
  }

  const renderTable = (rows: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Código</TableHead>
          <TableHead className="text-xs">Descrição</TableHead>
          <TableHead className="text-xs">Un</TableHead>
          <TableHead className="text-xs text-right">Qtd</TableHead>
          <TableHead className="text-xs text-right">P. Unit.</TableHead>
          <TableHead className="text-xs text-right">BDI%</TableHead>
          <TableHead className="text-xs text-right">Total c/BDI</TableHead>
          <TableHead className="text-xs">Origem</TableHead>
          <TableHead className="text-xs w-20"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderRows(rows)}</TableBody>
    </Table>
  );

  const renderGrouped = () => {
    const groups = new Map<string, any[]>();
    for (const i of itens) {
      const k = (i as any).fase || "Sem fase";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(i);
    }
    return Array.from(groups.entries()).map(([fase, rows]) => {
      const faseTotal = rows.reduce((s: number, i: any) => s + i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100), 0);
      return (
        <div key={fase} className="space-y-1">
          <div className="flex items-center justify-between px-1 pt-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{fase}</h3>
            <span className="text-sm font-medium">{fmt(faseTotal)}</span>
          </div>
          <div className="rounded-md border">{renderTable(rows)}</div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileSelect} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamento</h1>
          <p className="text-muted-foreground text-sm">Itens de custo com SINAPI e composições próprias</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setGroupByPhase(g => !g)}>
            <Layers className="mr-2 h-4 w-4" />{groupByPhase ? "Sem agrupamento" : "Agrupar por fase"}
          </Button>
          {itens.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setCurvaOpen(true)}>
                <BarChart3 className="mr-2 h-4 w-4" />Curva ABC
              </Button>
              <Button variant="outline" onClick={() => projeto && gerarPropostaComercialPDF(projeto, itens as OrcamentoItem[], {})}>
                <FileDown className="mr-2 h-4 w-4" />Gerar Proposta
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!selectedProject}>
            <Upload className="mr-2 h-4 w-4" />Importar Planilha
          </Button>
          <Button onClick={openNew} disabled={!selectedProject}>
            <Plus className="mr-2 h-4 w-4" />Novo Item
          </Button>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium shrink-0">Obra:</Label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Selecione uma obra" /></SelectTrigger>
          <SelectContent>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI bar */}
      {selectedProject && itens.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Subtotal sem BDI</div>
            <div className="text-lg font-bold">{fmt(subtotal)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total com BDI</div>
            <div className="text-lg font-bold text-primary">{fmt(totalComBdi)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">BDI Médio</div>
            <div className="text-lg font-bold">{bdiMedio.toFixed(1)}%</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Nº de Itens</div>
            <div className="text-lg font-bold">{itens.length}</div>
          </CardContent></Card>
        </div>
      )}

      {/* Table area */}
      {!selectedProject ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Selecione uma obra para gerenciar o orçamento.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Calculator className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhum item de orçamento cadastrado.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Importar Planilha</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Item</Button>
          </div>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {groupByPhase ? renderGrouped() : <div className="rounded-md border">{renderTable(itens)}</div>}
          <Card>
            <CardFooter className="py-4 flex justify-end gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Sem BDI</p>
                <p className="text-lg font-semibold">{fmt(subtotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total com BDI</p>
                <p className="text-2xl font-bold">{fmt(totalComBdi)}</p>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setSinapiResults([]); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Item" : "Novo Item de Orçamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Source selector */}
            <div>
              <Label className="text-xs">Origem</Label>
              <div className="flex gap-2 mt-1">
                {(["manual", "sinapi", "composicao_propria"] as const).map(o => (
                  <Button key={o} size="sm" variant={form.origem === o ? "default" : "outline"} className="text-xs h-7"
                    onClick={() => { setForm(f => ({ ...f, origem: o })); setSinapiResults([]); setSinapiQuery(""); }}>
                    {o === "manual" ? "Manual" : o === "sinapi" ? "SINAPI" : "Composição Própria"}
                  </Button>
                ))}
              </div>
            </div>

            {/* SINAPI search */}
            {form.origem === "sinapi" && (
              <div>
                <Label className="text-xs">Buscar SINAPI</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-7 h-8 text-sm" placeholder="Código ou descrição..." value={sinapiQuery}
                    onChange={e => handleSinapiSearch(e.target.value)} />
                </div>
                {sinapiSearching && <div className="text-xs text-muted-foreground mt-1">Buscando...</div>}
                {sinapiResults.length > 0 && (
                  <div className="rounded-md border mt-1 max-h-40 overflow-y-auto">
                    {sinapiResults.map(c => (
                      <button key={c.id} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted border-b last:border-0"
                        onClick={() => selectSinapiItem(c)}>
                        <span className="font-mono text-blue-600 mr-2">{c.codigo}</span>
                        {c.descricao} — <strong>{fmt(c.custo_total)}/{c.unidade}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Composição própria selector */}
            {form.origem === "composicao_propria" && (
              <div>
                <Label className="text-xs">Composição Própria</Label>
                <Select onValueChange={v => { const c = composicoes.find((x: any) => x.id === v); if (c) selectComposicaoItem(c); }}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {composicoes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.descricao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fase</Label>
                <Input className="h-8 text-sm mt-1" value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))} placeholder="Ex: Estrutura" />
              </div>
              <div>
                <Label className="text-xs">Código</Label>
                <Input className="h-8 text-sm mt-1" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Descrição *</Label>
                <Input className="h-8 text-sm mt-1" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Input className="h-8 text-sm mt-1" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input className="h-8 text-sm mt-1" type="number" min="0" step="0.001" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Preço Unitário (R$)</Label>
                <Input className="h-8 text-sm mt-1" type="number" min="0" step="0.01" value={form.preco_unitario} onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">BDI (%)</Label>
                <Input className="h-8 text-sm mt-1" type="number" min="0" max="100" value={form.bdi} onChange={e => setForm(f => ({ ...f, bdi: e.target.value }))} />
              </div>
            </div>
            {form.descricao && (
              <div className="text-xs text-right text-muted-foreground">
                Total: {fmt((parseFloat(form.quantidade) || 0) * (parseFloat(form.preco_unitario) || 0) * (1 + (parseFloat(form.bdi) || 0) / 100))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.descricao || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <Dialog open={importOpen} onOpenChange={v => { if (!v) { setImportOpen(false); setImportPreview([]); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Planilha — {importPreview.length} itens encontrados</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Fase</TableHead>
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Un</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">P.Unit</TableHead>
                  <TableHead className="text-xs text-right">BDI%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 50).map((r, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell>{r.fase || "—"}</TableCell>
                    <TableCell>{r.codigo || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.descricao}</TableCell>
                    <TableCell>{r.unidade}</TableCell>
                    <TableCell className="text-right">{r.quantidade.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{fmt(r.preco_unitario)}</TableCell>
                    <TableCell className="text-right">{(r.bdi || 0).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {importPreview.length > 50 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground">... e mais {importPreview.length - 50} itens</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview([]); }}>Cancelar</Button>
            <Button onClick={handleImportConfirm} disabled={importing}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Importação ({importPreview.length} itens)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Curva ABC modal */}
      <Dialog open={curvaOpen} onOpenChange={setCurvaOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Curva ABC — {(projeto as any)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ChartContainer config={{ valor: { label: "Valor", color: "#0071E3" } }} className="h-52">
              <BarChart data={curvaABC.slice(0, 20)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => `R$${(Number(v)/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="descricao" tick={{ fontSize: 9 }} width={120} />
                <ChartTooltip content={<ChartTooltipContent formatter={v => fmt(Number(v))} />} />
                <Bar dataKey="valor" fill="#0071E3" />
              </BarChart>
            </ChartContainer>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs text-right">%</TableHead>
                    <TableHead className="text-xs text-right">% Acum.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {curvaABC.map((item, i) => (
                    <TableRow key={i} className={`text-xs ${item.acumulado <= 80 ? "bg-blue-50/50" : item.acumulado <= 95 ? "bg-yellow-50/50" : ""}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.descricao}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(item.valor)}</TableCell>
                      <TableCell className="text-right">{item.percentual.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-medium">{item.acumulado.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
