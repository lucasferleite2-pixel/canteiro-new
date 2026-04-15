import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { searchSinapi, parseOrcamentoFile, type SinapiComposicao } from "@/lib/sinapiUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Database, Upload, Info, Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const ESTADOS = ["NACIONAL","AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Sinapi() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("NACIONAL");
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [page, setPage] = useState(0);
  const [selectedComp, setSelectedComp] = useState<SinapiComposicao | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [addToObraOpen, setAddToObraOpen] = useState(false);
  const [addComp, setAddComp] = useState<SinapiComposicao | null>(null);
  const [selectedProject, setSelectedProject] = useState("");

  const PAGE_SIZE = 25;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["sinapi_search", query, estado, mes, ano],
    queryFn: () => searchSinapi(supabase as any, query, estado, 200),
    enabled: query.length >= 2,
    staleTime: 60000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("projects").select("id,name").eq("company_id", companyId).order("name");
      return data || [];
    },
  });

  const paginated = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function handleImport() {
    if (!importFile || !companyId) return;
    setImporting(true);
    setImportProgress(0);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter(Boolean);
      const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
      let imported = 0;
      const batch: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(";");
        const row: any = {};
        header.forEach((h, idx) => (row[h] = cols[idx]?.trim() || ""));

        const codigo = row["codigo"] || row["code"] || "";
        const descricao = row["descricao"] || row["description"] || "";
        const unidade = row["unidade"] || row["un"] || "un";
        const custo_total = parseFloat((row["custo_total"] || row["custo"] || "0").replace(",", ".")) || 0;
        const custo_mao_obra = parseFloat((row["custo_mo"] || row["custo_mao_obra"] || "0").replace(",", ".")) || 0;
        const custo_material = parseFloat((row["custo_mat"] || row["custo_material"] || "0").replace(",", ".")) || 0;
        const custo_equipamento = parseFloat((row["custo_eq"] || row["custo_equipamento"] || "0").replace(",", ".")) || 0;

        if (!codigo || !descricao) continue;

        batch.push({
          codigo,
          descricao,
          unidade,
          custo_total,
          custo_mao_obra,
          custo_material,
          custo_equipamento,
          estado,
          mes_referencia: mes,
          ano_referencia: parseInt(ano),
        });

        if (batch.length >= 100) {
          await (supabase as any).from("sinapi_composicoes").upsert(batch, { onConflict: "codigo,estado,mes_referencia,ano_referencia" });
          imported += batch.length;
          batch.length = 0;
          setImportProgress(Math.round((i / lines.length) * 100));
        }
      }

      if (batch.length > 0) {
        await (supabase as any).from("sinapi_composicoes").upsert(batch, { onConflict: "codigo,estado,mes_referencia,ano_referencia" });
        imported += batch.length;
      }

      toast.success(`${imported} composições importadas com sucesso`);
      setImportOpen(false);
      setImportFile(null);
      queryClient.invalidateQueries({ queryKey: ["sinapi_search"] });
    } catch (e: any) {
      toast.error("Erro na importação: " + e.message);
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  }

  const addToOrcamento = useMutation({
    mutationFn: async (comp: SinapiComposicao) => {
      if (!selectedProject || !companyId) throw new Error("Selecione uma obra");
      const { error } = await (supabase as any).from("orcamento_itens").insert({
        project_id: selectedProject,
        company_id: companyId,
        codigo: comp.codigo,
        descricao: comp.descricao,
        unidade: comp.unidade,
        quantidade: 1,
        preco_unitario: comp.custo_total,
        bdi: 0,
        origem: "sinapi",
        sinapi_composicao_id: comp.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adicionado ao orçamento");
      setAddToObraOpen(false);
      setAddComp(null);
      setSelectedProject("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6" />Base SINAPI</h1>
          <p className="text-sm text-muted-foreground">Composições e serviços com referência de preços da CEF</p>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1">
          <Upload className="h-4 w-4" />Importar CSV
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Os dados SINAPI são atualizados mensalmente pela Caixa Econômica Federal. Baixe o arquivo CSV em <strong>cef.gov.br/sinapi</strong></span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por código ou descrição..."
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={estado} onValueChange={v => { setEstado(v); setPage(0); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="w-24" type="number" value={ano} onChange={e => setAno(e.target.value)} placeholder="Ano" />
      </div>

      {/* Results */}
      {query.length < 2 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Database className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">Digite pelo menos 2 caracteres para buscar</p>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Importar dados SINAPI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {isFetching && (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            )}
            {!isFetching && results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma composição encontrada. Importe os dados SINAPI primeiro.
              </div>
            )}
            {!isFetching && results.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-24">Código</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs w-16">Un</TableHead>
                        <TableHead className="text-xs text-right w-24">MO</TableHead>
                        <TableHead className="text-xs text-right w-24">Mat</TableHead>
                        <TableHead className="text-xs text-right w-24">Equip</TableHead>
                        <TableHead className="text-xs text-right w-28">Total</TableHead>
                        <TableHead className="text-xs w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((c) => (
                        <TableRow key={c.id} className="text-xs">
                          <TableCell className="font-mono text-blue-600">{c.codigo}</TableCell>
                          <TableCell className="font-medium max-w-[280px]">
                            <span dangerouslySetInnerHTML={{ __html: c.descricao.replace(new RegExp(query, "gi"), m => `<mark class="bg-yellow-100">${m}</mark>`) }} />
                          </TableCell>
                          <TableCell>{c.unidade}</TableCell>
                          <TableCell className="text-right">{fmt(c.custo_mao_obra || 0)}</TableCell>
                          <TableCell className="text-right">{fmt(c.custo_material || 0)}</TableCell>
                          <TableCell className="text-right">{fmt(c.custo_equipamento || 0)}</TableCell>
                          <TableCell className="text-right font-bold">{fmt(c.custo_total)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setSelectedComp(c)}>Ver</Button>
                              <Button size="sm" className="h-6 text-xs px-2" onClick={() => { setAddComp(c); setAddToObraOpen(true); }}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {results.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
                    <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, results.length)} de {results.length}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" disabled={(page + 1) * PAGE_SIZE >= results.length} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Composition Detail Modal */}
      <Dialog open={!!selectedComp} onOpenChange={v => { if (!v) setSelectedComp(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Composição SINAPI</DialogTitle>
          </DialogHeader>
          {selectedComp && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Código</div>
                <div className="font-mono font-bold text-blue-600">{selectedComp.codigo}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Descrição</div>
                <div className="font-medium">{selectedComp.descricao}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Unidade:</span> {selectedComp.unidade}</div>
                <div><span className="text-muted-foreground">Estado:</span> {selectedComp.estado}</div>
                <div><span className="text-muted-foreground">Referência:</span> {selectedComp.mes_referencia}/{selectedComp.ano_referencia}</div>
              </div>
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Mão de Obra</span>
                  <span className="font-medium">{fmt(selectedComp.custo_mao_obra || 0)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Materiais</span>
                  <span className="font-medium">{fmt(selectedComp.custo_material || 0)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Equipamentos</span>
                  <span className="font-medium">{fmt(selectedComp.custo_equipamento || 0)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-muted/30 font-bold">
                  <span>Custo Total</span>
                  <span>{fmt(selectedComp.custo_total)}</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedComp(null)}>Fechar</Button>
                <Button onClick={() => { setAddComp(selectedComp); setSelectedComp(null); setAddToObraOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar ao Orçamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add to Orçamento Dialog */}
      <Dialog open={addToObraOpen} onOpenChange={v => { if (!v) { setAddToObraOpen(false); setAddComp(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar ao Orçamento</DialogTitle>
          </DialogHeader>
          {addComp && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">{addComp.descricao}</div>
              <div>
                <Label className="text-xs">Selecionar Obra *</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setAddToObraOpen(false); setAddComp(null); }}>Cancelar</Button>
                <Button
                  disabled={!selectedProject || addToOrcamento.isPending}
                  onClick={() => addToOrcamento.mutate(addComp)}
                >
                  {addToOrcamento.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={importOpen} onOpenChange={v => { if (!v && !importing) setImportOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar dados SINAPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              Arquivo CSV com colunas: codigo; descricao; unidade; custo_total; custo_mo; custo_mat; custo_eq
            </div>
            <div>
              <Label className="text-xs">Estado de referência</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Arquivo CSV *</Label>
              <Input
                type="file"
                accept=".csv,.txt"
                className="mt-1"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {importing && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Importando... {importProgress}%</div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" disabled={importing} onClick={() => setImportOpen(false)}>Cancelar</Button>
              <Button disabled={!importFile || importing} onClick={handleImport}>
                {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
