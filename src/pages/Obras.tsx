import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Building2, MapPin, Calendar, DollarSign, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_OBRAS } from "@/lib/demoData";
import { DemoBanner } from "@/components/DemoBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { ObraFormDialog, type ObraFormData } from "@/components/obras/ObraFormDialog";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  planning: { label: "Planejamento", variant: "secondary" },
  in_progress: { label: "Em Andamento", variant: "default" },
  paused: { label: "Pausada", variant: "outline" },
  completed: { label: "Concluída", variant: "secondary" },
};

const UNDO_TOAST_ID = "undo-delete-obra";

export default function Obras() {
  const { companyId, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<ObraFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isDemo,
  });

  const resolvedObras = isDemo ? DEMO_OBRAS : obras;

  const buildPayload = (form: ObraFormData) => ({
    name: form.name,
    description: form.description || null,
    address: form.address || null,
    municipality: form.municipality || null,
    budget: form.budget ? parseFloat(form.budget) : 0,
    start_date: form.start_date || null,
    expected_end_date: form.expected_end_date || null,
    status: form.status,
  });

  const createMutation = useMutation({
    mutationFn: async (form: ObraFormData) => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await supabase.from("projects").insert({
        company_id: companyId,
        ...buildPayload(form),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreateOpen(false);
      toast("Obra criada com sucesso!");
    },
    onError: (err: any) => toast.error("Erro ao criar obra", { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async (form: ObraFormData) => {
      if (!editingId) throw new Error("Sem ID");
      const { error } = await supabase
        .from("projects")
        .update(buildPayload(form) as any)
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
      setEditingId(null);
      toast("Obra atualizada com sucesso!");
    },
    onError: (err: any) => toast.error("Erro ao atualizar obra", { description: err.message }),
  });

  const openEdit = (obra: any) => {
    setEditingId(obra.id);
    setEditInitial({
      name: obra.name || "",
      description: obra.description || "",
      address: obra.address || "",
      municipality: obra.municipality || "",
      budget: obra.budget ? String(obra.budget) : "",
      start_date: obra.start_date || "",
      expected_end_date: obra.expected_end_date || "",
      status: obra.status || "planning",
    });
    setEditOpen(true);
  };

  // ── Delete helpers ────────────────────────────────────────────────────────

  const handleUndoDelete = () => {
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    deleteTimeoutRef.current = null;
    countdownIntervalRef.current = null;
    toast.dismiss(UNDO_TOAST_ID);
    toast("Exclusão cancelada.");
  };

  const cascadeDelete = async (projectId: string) => {
    // Fetch rdo_dia IDs for this project first (needed for sub-table deletes)
    const { data: rdoDias } = await supabase
      .from("rdo_dia")
      .select("id")
      .eq("obra_id", projectId);

    const rdoDiaIds = (rdoDias ?? []).map((r) => r.id);

    if (rdoDiaIds.length > 0) {
      await supabase.from("rdo_foto").delete().in("rdo_dia_id", rdoDiaIds);
      await supabase.from("rdo_atividade").delete().in("rdo_dia_id", rdoDiaIds);
      await supabase.from("rdo_material").delete().in("rdo_dia_id", rdoDiaIds);
      await supabase.from("rdo_despesa_item").delete().in("rdo_dia_id", rdoDiaIds);
      await supabase.from("rdo_ocorrencia").delete().in("rdo_dia_id", rdoDiaIds);
      await supabase.from("rdo_dia").delete().eq("obra_id", projectId);
    }

    await supabase.from("diary_entries").delete().eq("project_id", projectId);
    await supabase.from("financial_records").delete().eq("project_id", projectId);
    await supabase.from("contracts").delete().eq("project_id", projectId);
    await supabase.from("alerts").delete().eq("project_id", projectId);

    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) throw error;
  };

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) return;
    const obra = deleteTarget;
    setDeleteTarget(null);

    // Clear any previous pending deletion
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    let secs = 10;

    const showCountdownToast = (remaining: number) => {
      toast(`Obra excluída. Desfazer (${remaining}s)...`, {
        id: UNDO_TOAST_ID,
        duration: Infinity,
        action: {
          label: "Desfazer",
          onClick: handleUndoDelete,
        },
      });
    };

    showCountdownToast(secs);

    countdownIntervalRef.current = setInterval(() => {
      secs -= 1;
      showCountdownToast(secs);
      if (secs <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
      }
    }, 1000);

    deleteTimeoutRef.current = setTimeout(async () => {
      clearInterval(countdownIntervalRef.current!);
      countdownIntervalRef.current = null;
      deleteTimeoutRef.current = null;
      toast.dismiss(UNDO_TOAST_ID);
      try {
        await cascadeDelete(obra.id);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } catch (err: any) {
        toast.error("Erro ao excluir obra", { description: err.message });
      }
    }, 10000);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <DemoBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
          <p className="text-muted-foreground">Gerencie todas as suas obras em um só lugar.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Nova Obra
        </Button>
      </div>

      <ObraFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(form) => createMutation.mutate(form)}
        isPending={createMutation.isPending}
        mode="create"
      />

      <ObraFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={(form) => updateMutation.mutate(form)}
        isPending={updateMutation.isPending}
        initialData={editInitial}
        mode="edit"
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá excluir permanentemente <strong>{deleteTarget?.name}</strong> e todos os dados
              relacionados: diários, RDOs, atividades, despesas, ocorrências, fotos, contratos e registros
              financeiros. Esta ação não pode ser desfeita após 10 segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirmed}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isDemo && isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : resolvedObras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma obra cadastrada</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Cadastre sua primeira obra para começar.</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar Obra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resolvedObras.map((obra) => {
            const st = statusMap[obra.status] || statusMap.planning;
            return (
              <Card key={obra.id} className="hover:border-primary/30 transition-colors group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{obra.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {!isDemo && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openEdit(obra)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget({ id: obra.id, name: obra.name })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                  {obra.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{obra.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {(obra.municipality || obra.address) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {obra.municipality}
                        {obra.municipality && obra.address ? " — " : ""}
                        {obra.address}
                      </span>
                    </div>
                  )}
                  {obra.budget ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatCurrency(obra.budget)}
                    </div>
                  ) : null}
                  {obra.start_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Início: {new Date(obra.start_date).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
