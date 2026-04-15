import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShoppingCart, Loader2, ArrowRight, Package } from "lucide-react";

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", variant: "secondary" as const },
  cotacao: { label: "Em cotação", variant: "default" as const },
  aprovado: { label: "Aprovado", variant: "outline" as const },
  pedido: { label: "Pedido feito", variant: "default" as const },
  recebido: { label: "Recebido", variant: "outline" as const },
  cancelado: { label: "Cancelado", variant: "destructive" as const },
};

const STATUS_NEXT: Record<string, string> = {
  rascunho: "cotacao",
  cotacao: "aprovado",
  aprovado: "pedido",
  pedido: "recebido",
};

const emptyForm = {
  supplier: "",
  project_id: "",
  expected_delivery: "",
  notes: "",
};

export default function GestaoCompras() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("purchase_orders").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("purchase_orders").insert({
        supplier: values.supplier || null,
        project_id: values.project_id || null,
        expected_delivery: values.expected_delivery || null,
        notes: values.notes || null,
        company_id: companyId!,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Ordem de compra criada!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const advanceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const filtered = orders.filter((o: any) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchProject = projectFilter === "all" || o.project_id === projectFilter;
    return matchStatus && matchProject;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compras</h1>
          <p className="text-muted-foreground text-sm">Central de ordens de compra.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Ordem
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhuma ordem de compra encontrada.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova Ordem</Button>
        </CardContent></Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead>Entrega Prevista</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o: any) => {
                const statusCfg = STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.rascunho;
                const projectName = projects.find((p: any) => p.id === o.project_id)?.name;
                const nextStatus = STATUS_NEXT[o.status];
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_number || `#${o.id.slice(-6).toUpperCase()}`}</TableCell>
                    <TableCell>{o.supplier || "—"}</TableCell>
                    <TableCell>{projectName || "—"}</TableCell>
                    <TableCell><Badge variant={statusCfg.variant}>{statusCfg.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {o.total_value > 0 ? `R$ ${Number(o.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell>{o.requested_at || "—"}</TableCell>
                    <TableCell>{o.expected_delivery || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {nextStatus && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => advanceStatus.mutate({ id: o.id, status: nextStatus })}>
                            <ArrowRight className="h-3 w-3 mr-1" /> Avançar
                          </Button>
                        )}
                        {o.status === "recebido" && (
                          <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => navigate(`/estoque/nova?tipo=entrada&doc_ref=${encodeURIComponent(o.order_number || o.id.slice(-6).toUpperCase())}`)}>
                            <Package className="h-3 w-3 mr-1" /> Entrada no Estoque
                          </Button>
                        )}
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
          <DialogHeader>
            <DialogTitle>Nova Ordem de Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem projeto</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entrega Prevista</Label>
              <Input type="date" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
