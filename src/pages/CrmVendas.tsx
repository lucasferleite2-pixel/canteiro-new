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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, TrendingUp, Loader2, Phone, Mail, Building2, User } from "lucide-react";

const STAGES = [
  { id: "contato", label: "Contato" },
  { id: "qualificacao", label: "Qualificação" },
  { id: "orcamentacao", label: "Orçamentação" },
  { id: "proposta", label: "Proposta" },
  { id: "negociacao", label: "Negociação" },
];

const ACTIVITY_TYPES = ["ligacao", "email", "reuniao", "visita", "proposta", "outro"];

const emptyLeadForm = {
  client_name: "", client_email: "", client_phone: "", client_company: "",
  source: "", stage: "contato", estimated_value: "", probability_percent: "50",
  assigned_to: "", notes: "",
};

const emptyActivityForm = {
  type: "ligacao", title: "", description: "", scheduled_at: "",
};

export default function CrmVendas() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [lostReason, setLostReason] = useState("");
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [pendingLostId, setPendingLostId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["crm_leads", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("crm_leads").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["crm_activities", selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      const { data } = await supabase.from("crm_activities").select("*").eq("lead_id", selectedLead.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedLead?.id,
  });

  const createLead = useMutation({
    mutationFn: async (values: typeof leadForm) => {
      const { error } = await supabase.from("crm_leads").insert({
        ...values,
        estimated_value: Number(values.estimated_value) || 0,
        probability_percent: Number(values.probability_percent) || 50,
        company_id: companyId!,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_leads"] });
      setLeadDialogOpen(false);
      setLeadForm(emptyLeadForm);
      toast({ title: "Lead criado!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("crm_leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_leads"] }),
  });

  const markWon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_leads").update({ stage: "ganho", won_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_leads"] });
      setSelectedLead(null);
      toast({ title: "Lead marcado como Ganho!" });
    },
  });

  const markLost = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("crm_leads").update({ stage: "perdido", lost_reason: reason, lost_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_leads"] });
      setSelectedLead(null);
      setLostDialogOpen(false);
      setLostReason("");
      toast({ title: "Lead marcado como Perdido." });
    },
  });

  const addActivity = useMutation({
    mutationFn: async (values: typeof activityForm) => {
      const { error } = await supabase.from("crm_activities").insert({
        ...values,
        scheduled_at: values.scheduled_at || null,
        lead_id: selectedLead!.id,
        company_id: companyId!,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
      setActivityDialogOpen(false);
      setActivityForm(emptyActivityForm);
      toast({ title: "Atividade registrada!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  // KPIs
  const activeLeads = leads.filter((l: any) => !["ganho", "perdido"].includes(l.stage));
  const pipelineValue = activeLeads.reduce((s: number, l: any) => s + (Number(l.estimated_value) || 0), 0);
  const wonLeads = leads.filter((l: any) => l.stage === "ganho");
  const conversionRate = leads.length > 0 ? ((wonLeads.length / leads.length) * 100).toFixed(1) : "0";
  const avgTicket = wonLeads.length > 0
    ? wonLeads.reduce((s: number, l: any) => s + Number(l.estimated_value || 0), 0) / wonLeads.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">CRM — Pipeline de oportunidades.</p>
        </div>
        <Button onClick={() => setLeadDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Lead
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Leads Ativos", value: activeLeads.length },
          { label: "Pipeline", value: `R$ ${pipelineValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
          { label: "Taxa de Conversão", value: `${conversionRate}%` },
          { label: "Ticket Médio (Ganhos)", value: avgTicket > 0 ? `R$ ${avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STAGES.map(stage => {
            const stageLeads = leads.filter((l: any) => l.stage === stage.id);
            return (
              <div key={stage.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {stageLeads.map((lead: any) => (
                    <Card key={lead.id} className="cursor-pointer hover:ring-1 hover:ring-primary/50" onClick={() => setSelectedLead(lead)}>
                      <CardContent className="p-3 space-y-2">
                        <p className="text-sm font-medium leading-tight truncate">{lead.client_name}</p>
                        {lead.client_company && <p className="text-xs text-muted-foreground truncate">{lead.client_company}</p>}
                        {lead.estimated_value > 0 && (
                          <p className="text-xs font-medium">R$ {Number(lead.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                        )}
                        <div className="flex items-center justify-between">
                          {lead.assigned_to && <span className="text-xs text-muted-foreground truncate">{lead.assigned_to}</span>}
                          <Badge variant="outline" className="text-xs ml-auto">{lead.probability_percent}%</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ganhos e Perdidos */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { stage: "ganho", label: "Ganhos", color: "text-green-600" },
          { stage: "perdido", label: "Perdidos", color: "text-red-600" },
        ].map(col => {
          const colLeads = leads.filter((l: any) => l.stage === col.stage);
          return (
            <Card key={col.stage}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${col.color}`}>{col.label} ({colLeads.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                {colLeads.map((lead: any) => (
                  <div key={lead.id} className="flex justify-between items-center text-sm">
                    <span>{lead.client_name}</span>
                    {lead.estimated_value > 0 && <span className="text-muted-foreground">R$ {Number(lead.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>}
                  </div>
                ))}
                {colLeads.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lead detail sheet */}
      <Sheet open={!!selectedLead} onOpenChange={v => { if (!v) setSelectedLead(null); }}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLead.client_name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2 text-sm">
                  {selectedLead.client_email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selectedLead.client_email}</div>}
                  {selectedLead.client_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{selectedLead.client_phone}</div>}
                  {selectedLead.client_company && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{selectedLead.client_company}</div>}
                  {selectedLead.assigned_to && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{selectedLead.assigned_to}</div>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Valor:</span> R$ {Number(selectedLead.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
                  <div><span className="text-muted-foreground">Prob.:</span> {selectedLead.probability_percent}%</div>
                  <div><span className="text-muted-foreground">Estágio:</span> {selectedLead.stage}</div>
                  <div><span className="text-muted-foreground">Origem:</span> {selectedLead.source || "—"}</div>
                </div>
                {selectedLead.notes && <p className="text-sm text-muted-foreground">{selectedLead.notes}</p>}

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mover para estágio</Label>
                  <Select value={selectedLead.stage} onValueChange={v => { updateStage.mutate({ id: selectedLead.id, stage: v }); setSelectedLead((s: any) => ({ ...s, stage: v })); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {!["ganho", "perdido"].includes(selectedLead.stage) && (
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => markWon.mutate(selectedLead.id)}>Ganho</Button>
                    <Button variant="destructive" className="flex-1" onClick={() => { setPendingLostId(selectedLead.id); setLostDialogOpen(true); }}>Perdido</Button>
                  </div>
                )}

                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Atividades</p>
                    <Button variant="outline" size="sm" onClick={() => setActivityDialogOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Registrar
                    </Button>
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((a: any) => (
                        <div key={a.id} className="text-sm border rounded p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{a.title}</span>
                            <Badge variant="outline" className="text-xs">{a.type}</Badge>
                          </div>
                          {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                          {a.scheduled_at && <p className="text-xs text-muted-foreground">{new Date(a.scheduled_at).toLocaleDateString("pt-BR")}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New Lead Dialog */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nome do cliente *</Label>
                <Input value={leadForm.client_name} onChange={e => setLeadForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={leadForm.client_email} onChange={e => setLeadForm(f => ({ ...f, client_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={leadForm.client_phone} onChange={e => setLeadForm(f => ({ ...f, client_phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input value={leadForm.client_company} onChange={e => setLeadForm(f => ({ ...f, client_company: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={leadForm.source} onValueChange={v => setLeadForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["indicacao", "site", "licitacao", "prospeccao", "outro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estágio</Label>
                <Select value={leadForm.stage} onValueChange={v => setLeadForm(f => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor Estimado (R$)</Label>
                <Input type="number" min="0" value={leadForm.estimated_value} onChange={e => setLeadForm(f => ({ ...f, estimated_value: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Probabilidade (%)</Label>
                <Input type="number" min="0" max="100" value={leadForm.probability_percent} onChange={e => setLeadForm(f => ({ ...f, probability_percent: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Responsável</Label>
                <Input value={leadForm.assigned_to} onChange={e => setLeadForm(f => ({ ...f, assigned_to: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Observações</Label>
                <Textarea value={leadForm.notes} onChange={e => setLeadForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createLead.mutate(leadForm)} disabled={!leadForm.client_name || createLead.isPending}>
              {createLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Atividade</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={activityForm.type} onValueChange={v => setActivityForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={activityForm.title} onChange={e => setActivityForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={activityForm.description} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Data Agendada</Label>
              <Input type="datetime-local" value={activityForm.scheduled_at} onChange={e => setActivityForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addActivity.mutate(activityForm)} disabled={!activityForm.title || addActivity.isPending}>
              {addActivity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost reason dialog */}
      <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motivo da Perda</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Descreva o motivo..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => pendingLostId && markLost.mutate({ id: pendingLostId, reason: lostReason })}>
              {markLost.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
