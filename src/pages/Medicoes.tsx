import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Ruler, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", variant: "secondary" as const },
  enviado: { label: "Enviado", variant: "default" as const },
  aprovado: { label: "Aprovado", variant: "outline" as const },
  reprovado: { label: "Reprovado", variant: "destructive" as const },
};

const emptyForm = { periodo_inicio: "", periodo_fim: "", observacoes: "" };

export default function Medicoes() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: medicoes = [], isLoading } = useQuery({
    queryKey: ["obra_medicoes", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("obra_medicoes").select("*").eq("project_id", selectedProject).order("periodo_inicio", { ascending: false });
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["obra_medicao_itens", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data } = await supabase.from("obra_medicao_itens").select("*").eq("medicao_id", expandedId);
      return data || [];
    },
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("obra_medicoes").insert({
        ...values,
        company_id: companyId!,
        project_id: selectedProject,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_medicoes"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Medição criada!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("obra_medicoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_medicoes"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const STATUS_FLOW: Record<string, string> = {
    rascunho: "enviado",
    enviado: "aprovado",
    aprovado: "aprovado",
    reprovado: "reprovado",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medições</h1>
          <p className="text-muted-foreground text-sm">Controle de avanço físico por período.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!selectedProject}>
          <Plus className="mr-2 h-4 w-4" /> Nova Medição
        </Button>
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
          <Ruler className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Selecione uma obra para gerenciar medições.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : medicoes.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Ruler className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhuma medição cadastrada.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova Medição</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {medicoes.map((m: any) => {
            const statusCfg = STATUS_CONFIG[m.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.rascunho;
            const isExpanded = expandedId === m.id;
            const medicaoItens = isExpanded ? itens : [];
            const total = medicaoItens.reduce((s: number, i: any) => s + (Number(i.quantity_current) * Number(i.unit_price) || 0), 0);

            return (
              <Card key={m.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {m.periodo_inicio} — {m.periodo_fim}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        {m.valor_medido > 0 && (
                          <span className="text-sm text-muted-foreground">
                            R$ {Number(m.valor_medido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {m.percentual_avanco > 0 && (
                          <span className="text-sm text-muted-foreground">{m.percentual_avanco}% de avanço</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status !== "aprovado" && m.status !== "reprovado" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: m.id, status: STATUS_FLOW[m.status] })}>
                          Avançar status
                        </Button>
                      )}
                      {m.status === "enviado" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: m.id, status: "reprovado" })}>
                          Reprovar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0">
                    {medicaoItens.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum item nesta medição.</p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Un</TableHead>
                              <TableHead className="text-right">Qtd Contratada</TableHead>
                              <TableHead className="text-right">Qtd Anterior</TableHead>
                              <TableHead className="text-right">Qtd Atual</TableHead>
                              <TableHead className="text-right">P. Unit.</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {medicaoItens.map((i: any) => (
                              <TableRow key={i.id}>
                                <TableCell>{i.description}</TableCell>
                                <TableCell>{i.unit}</TableCell>
                                <TableCell className="text-right">{Number(i.quantity_planned).toFixed(2)}</TableCell>
                                <TableCell className="text-right">{Number(i.quantity_previous).toFixed(2)}</TableCell>
                                <TableCell className="text-right">{Number(i.quantity_current).toFixed(2)}</TableCell>
                                <TableCell className="text-right">R$ {Number(i.unit_price).toFixed(2)}</TableCell>
                                <TableCell className="text-right font-medium">
                                  R$ {(Number(i.quantity_current) * Number(i.unit_price)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={6} className="text-right font-semibold">Total</TableCell>
                              <TableCell className="text-right font-bold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Medição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Período Início *</Label>
                <Input type="date" value={form.periodo_inicio} onChange={e => setForm(f => ({ ...f, periodo_inicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Período Fim *</Label>
                <Input type="date" value={form.periodo_fim} onChange={e => setForm(f => ({ ...f, periodo_fim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.periodo_inicio || !form.periodo_fim || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
