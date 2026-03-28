import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckSquare, Loader2 } from "lucide-react";

const COLUMNS = [
  { id: "todo", label: "A Fazer" },
  { id: "in_progress", label: "Em Andamento" },
  { id: "review", label: "Revisão" },
  { id: "done", label: "Concluído" },
];

const PRIORITY_CONFIG = {
  low: { label: "Baixa", variant: "secondary" as const },
  medium: { label: "Média", variant: "default" as const },
  high: { label: "Alta", variant: "outline" as const },
  urgent: { label: "Urgente", variant: "destructive" as const },
};

const emptyForm = {
  title: "",
  description: "",
  assigned_to: "",
  due_date: "",
  status: "todo",
  priority: "medium",
  phase_id: "",
};

export default function Tarefas() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
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

  const { data: phases = [] } = useQuery({
    queryKey: ["project_phases", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("project_phases").select("id, name").eq("project_id", selectedProject);
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const { data: tasks = [], isLoading } = useQuery({
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
        company_id: companyId!,
        project_id: selectedProject,
        phase_id: values.phase_id || null,
      };
      if (editingTask) {
        const { error } = await supabase.from("project_tasks").update(payload).eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_tasks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_tasks"] });
      setDialogOpen(false);
      setEditingTask(null);
      setForm(emptyForm);
      toast({ title: editingTask ? "Tarefa atualizada!" : "Tarefa criada!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const openNew = () => { setEditingTask(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (task: any) => {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      assigned_to: task.assigned_to || "",
      due_date: task.due_date || "",
      status: task.status || "todo",
      priority: task.priority || "medium",
      phase_id: task.phase_id || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Kanban board de tarefas por projeto.</p>
        </div>
        <Button onClick={openNew} disabled={!selectedProject}>
          <Plus className="mr-2 h-4 w-4" /> Nova Tarefa
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
          <CheckSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Selecione um projeto para gerenciar tarefas.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter((t: any) => t.status === col.id);
            return (
              <div key={col.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {colTasks.map((task: any) => {
                    const pCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                    const phaseName = phases.find((ph: any) => ph.id === task.phase_id)?.name;
                    return (
                      <Card key={task.id} className="cursor-pointer hover:ring-1 hover:ring-primary/50" onClick={() => openEdit(task)}>
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium leading-tight">{task.title}</p>
                          {task.assigned_to && <p className="text-xs text-muted-foreground">{task.assigned_to}</p>}
                          <div className="flex items-center justify-between gap-2">
                            {task.due_date && <span className="text-xs text-muted-foreground">{task.due_date}</span>}
                            <Badge variant={pCfg.variant} className="text-xs">{pCfg.label}</Badge>
                          </div>
                          {phaseName && <Badge variant="outline" className="text-xs">{phaseName}</Badge>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Concretar laje" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="review">Revisão</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {phases.length > 0 && (
              <div className="space-y-2">
                <Label>Fase</Label>
                <Select value={form.phase_id} onValueChange={v => setForm(f => ({ ...f, phase_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma fase" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma fase</SelectItem>
                    {phases.map((ph: any) => <SelectItem key={ph.id} value={ph.id}>{ph.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.title || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
