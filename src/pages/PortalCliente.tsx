import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Globe, Copy, Check, XCircle, Loader2 } from "lucide-react";

const BASE_URL = "https://erp.valenobre.com";

export default function PortalCliente() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "",
    client_name: "",
    client_email: "",
    expires_at: "",
    perm_cronograma: true,
    perm_fotos: true,
    perm_financeiro: false,
    perm_documentos: true,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["client_portal_shares", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("client_portal_shares").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("client_portal_shares").insert({
        company_id: companyId!,
        project_id: values.project_id,
        client_name: values.client_name || null,
        client_email: values.client_email || null,
        expires_at: values.expires_at || null,
        permissions: {
          cronograma: values.perm_cronograma,
          fotos: values.perm_fotos,
          financeiro: values.perm_financeiro,
          documentos: values.perm_documentos,
        },
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_portal_shares"] });
      setDialogOpen(false);
      toast({ title: "Acesso criado!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_portal_shares").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_portal_shares"] });
      setDeactivateId(null);
      toast({ title: "Acesso desativado." });
    },
  });

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${BASE_URL}/portal/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const isExpired = (share: any) => share.expires_at && new Date(share.expires_at) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portal do Cliente</h1>
          <p className="text-muted-foreground text-sm">Gerencie acessos compartilhados com clientes.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Acesso
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : shares.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum acesso compartilhado.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo Acesso</Button>
        </CardContent></Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Expiração</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shares.map((s: any) => {
                const project = projects.find((p: any) => p.id === s.project_id);
                const perms = s.permissions || {};
                const expired = isExpired(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{project?.name || "—"}</TableCell>
                    <TableCell>{s.client_name || "—"}</TableCell>
                    <TableCell>{s.client_email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {perms.cronograma && <Badge variant="outline" className="text-xs">cronograma</Badge>}
                        {perms.fotos && <Badge variant="outline" className="text-xs">fotos</Badge>}
                        {perms.financeiro && <Badge variant="outline" className="text-xs">financeiro</Badge>}
                        {perms.documentos && <Badge variant="outline" className="text-xs">documentos</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{s.expires_at ? new Date(s.expires_at).toLocaleDateString("pt-BR") : "Sem expiração"}</TableCell>
                    <TableCell>{s.last_accessed_at ? new Date(s.last_accessed_at).toLocaleDateString("pt-BR") : "Nunca"}</TableCell>
                    <TableCell>
                      <Badge variant={!s.is_active ? "secondary" : expired ? "destructive" : "default"}>
                        {!s.is_active ? "Inativo" : expired ? "Expirado" : "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(s.access_token)} title="Copiar link">
                          {copiedToken === s.access_token ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        {s.is_active && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeactivateId(s.id)} title="Desativar">
                            <XCircle className="h-4 w-4" />
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
          <DialogHeader><DialogTitle>Novo Acesso ao Portal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do cliente</Label>
                <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expiração (opcional)</Label>
              <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>
            <div className="space-y-3">
              <Label>Permissões</Label>
              {[
                { key: "perm_cronograma" as const, label: "Cronograma" },
                { key: "perm_fotos" as const, label: "Fotos" },
                { key: "perm_financeiro" as const, label: "Financeiro" },
                { key: "perm_documentos" as const, label: "Documentos" },
              ].map(p => (
                <div key={p.key} className="flex items-center gap-2">
                  <Checkbox checked={form[p.key]} onCheckedChange={v => setForm(f => ({ ...f, [p.key]: !!v }))} id={p.key} />
                  <label htmlFor={p.key} className="text-sm">{p.label}</label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.project_id || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivateId} onOpenChange={v => { if (!v) setDeactivateId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar acesso?</AlertDialogTitle>
            <AlertDialogDescription>O cliente perderá acesso ao portal imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deactivateId && deactivateMutation.mutate(deactivateId)}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
