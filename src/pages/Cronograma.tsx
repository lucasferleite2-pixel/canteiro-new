import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, CalendarDays, Loader2 } from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pendente", variant: "secondary" as const },
  in_progress: { label: "Em andamento", variant: "default" as const },
  completed: { label: "Concluída", variant: "outline" as const },
  delayed: { label: "Atrasada", variant: "destructive" as const },
};

const emptyForm = {
  name: "",
  description: "",
  responsible: "",
  start_date: "",
  end_date: "",
  status: "pending",
  progress_percent: "0",
  color: "#3B82F6",
};

export default function Cronograma() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ["project_phases", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("project_phases").select("*").eq("project_id", selectedProject).order("order_index");
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project_tasks", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("project_tasks").select("*").eq("project_id", selectedProject).order("due_date");
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        ...values,
        progress_percent: Number(values.progress_percent),
        company_id: companyId!,
        project_id: selectedProject,
      };
      if (editingPhase) {
        const { error } = await supabase.from("project_phases").update(payload).eq("id", editingPhase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_phases").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_phases"] });
      setDialogOpen(false);
      setEditingPhase(null);
      setForm(emptyForm);
      toast({ title: editingPhase ? "Fase atualizada!" : "Fase criada!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_phases"] });
      setDeleteId(null);
      toast({ title: "Fase excluída!" });
    },
  });

  const openNew = () => { setEditingPhase(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (phase: any) => {
    setEditingPhase(phase);
    setForm({
      name: phase.name || "",
      description: phase.description || "",
      responsible: phase.responsible || "",
      start_date: phase.start_date || "",
      end_date: phase.end_date || "",
      status: phase.status || "pending",
      progress_percent: String(phase.progress_percent || 0),
      color: phase.color || "#3B82F6",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cronograma</h1>
          <p className="text-muted-foreground text-sm">Fases e tarefas do projeto.</p>
        </div>
        <Button onClick={openNew} disabled={!selectedProject}>
          <Plus className="mr-2 h-4 w-4" /> Nova Fase
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Projeto:</Label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
          <SelectContent>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!selectedProject ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Selecione um projeto para visualizar o cronograma.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : phases.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhuma fase cadastrada.</p>
          <Button variant="outline" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Fase</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {phases.map((phase: any) => {
            const phaseTasks = tasks.filter((t: any) => t.phase_id === phase.id);
            const statusCfg = STATUS_CONFIG[phase.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
            return (
              <Card key={phase.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                      <CardTitle className="text-base truncate">{phase.name}</CardTitle>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(phase)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(phase.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {phase.description && <p className="text-sm text-muted-foreground">{phase.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {phase.responsible && <div><span className="text-muted-foreground">Responsável:</span> {phase.responsible}</div>}
                    {phase.start_date && <div><span className="text-muted-foreground">Início:</span> {phase.start_date}</div>}
                    {phase.end_date && <div><span className="text-muted-foreground">Fim:</span> {phase.end_date}</div>}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{phase.progress_percent}%</span>
                    </div>
                    <Progress value={phase.progress_percent} className="h-2" />
                  </div>
                  {phaseTasks.length > 0 && (
                    <div className="border-t pt-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Tarefas ({phaseTasks.length})</p>
                      {phaseTasks.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/40">
                          <span>{t.title}</span>
                          <Badge variant="outline" className="text-xs">{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPhase ? "Editar Fase" : "Nova Fase"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Fundação" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="delayed">Atrasada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Progresso (%)</Label>
                <Input type="number" min="0" max="100" value={form.progress_percent} onChange={e => setForm(f => ({ ...f, progress_percent: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fase?</AlertDialogTitle>
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
