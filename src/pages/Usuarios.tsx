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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Pencil, Trash2, Loader2, ShieldAlert } from "lucide-react";

const ROLES = ["admin", "engineer", "foreman", "financial", "legal", "client"] as const;
type Role = typeof ROLES[number];

const ROLE_CONFIG: Record<Role, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  admin: { label: "Admin", variant: "destructive" },
  engineer: { label: "Engenheiro", variant: "default" },
  foreman: { label: "Encarregado", variant: "outline" },
  financial: { label: "Financeiro", variant: "secondary" },
  legal: { label: "Jurídico", variant: "secondary" },
  client: { label: "Cliente", variant: "outline" },
};

export default function Usuarios() {
  const { companyId, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "engineer" as Role, message: "" });
  const [newRole, setNewRole] = useState<Role>("engineer");

  // Fetch members: profiles joined with user_roles for this company
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["company_members", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, created_at")
        .eq("company_id", companyId);
      if (!profiles?.length) return [];

      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", companyId)
        .in("user_id", userIds);

      return profiles.map(p => ({
        ...p,
        roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role as Role),
      }));
    },
    enabled: !!companyId,
  });

  // Check if current user is admin
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is_admin", companyId, currentUser?.id],
    queryFn: async () => {
      if (!companyId || !currentUser?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", currentUser.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!companyId && !!currentUser?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: async (values: typeof inviteForm) => {
      // Temporary mechanism: create alert for pending invite
      const { error } = await supabase.from("alerts").insert({
        company_id: companyId!,
        title: `Convite pendente para: ${values.email}`,
        message: `Role: ${values.role}${values.message ? ` | Mensagem: ${values.message}` : ""}`,
        severity: "info",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInviteDialogOpen(false);
      setInviteForm({ email: "", role: "engineer", message: "" });
      toast({ title: "Convite registrado!", description: "O convite foi salvo nos alertas do sistema." });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      // Remove existing roles for this user in company, then add new one
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("company_id", companyId!);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, company_id: companyId!, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_members"] });
      setEditRoleDialogOpen(false);
      setSelectedMember(null);
      toast({ title: "Role atualizada!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Disassociate profile from company
      const { error } = await supabase.from("profiles").update({ company_id: null }).eq("user_id", userId);
      if (error) throw error;
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("company_id", companyId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_members"] });
      setRemoveDialogOpen(false);
      setSelectedMember(null);
      toast({ title: "Membro removido!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const roleCounts = ROLES.reduce((acc, role) => {
    acc[role] = members.filter(m => m.roles.includes(role)).length;
    return acc;
  }, {} as Record<Role, number>);

  if (!isAdmin && !isLoading && members.length > 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Usuários e Permissões</h1>
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Somente administradores podem gerenciar membros.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários e Permissões</h1>
          <p className="text-muted-foreground text-sm">Gerencie membros da empresa e controle de acesso.</p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Convidar Membro
        </Button>
      </div>

      {/* KPIs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-sm">{members.length} membros</Badge>
        {ROLES.filter(r => roleCounts[r] > 0).map(role => (
          <Badge key={role} variant={ROLE_CONFIG[role].variant} className="text-xs">
            {ROLE_CONFIG[role].label}: {roleCounts[role]}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum membro cadastrado</p>
          <p className="text-sm text-muted-foreground/70 mb-4">Convide membros da sua equipe para colaborar no sistema.</p>
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Convidar Membro
          </Button>
        </CardContent></Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                        {(m.full_name || m.email || "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{m.full_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{m.email || "—"}</TableCell>
                  <TableCell>{m.phone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {m.roles.length > 0 ? m.roles.map((r: Role) => (
                        <Badge key={r} variant={ROLE_CONFIG[r]?.variant || "secondary"} className="text-xs">
                          {ROLE_CONFIG[r]?.label || r}
                        </Badge>
                      )) : <span className="text-xs text-muted-foreground">Sem role</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {m.user_id !== currentUser?.id && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setSelectedMember(m);
                          setNewRole(m.roles[0] || "engineer");
                          setEditRoleDialogOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                          setSelectedMember(m);
                          setRemoveDialogOpen(true);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v as Role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_CONFIG[r].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem personalizada</Label>
              <Textarea value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="Opcional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => inviteMutation.mutate(inviteForm)} disabled={!inviteForm.email || inviteMutation.isPending}>
              {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Role — {selectedMember?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nova Role</Label>
            <Select value={newRole} onValueChange={v => setNewRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_CONFIG[r].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => selectedMember && updateRoleMutation.mutate({ userId: selectedMember.user_id, role: newRole })} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={v => { if (!v) setRemoveDialogOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover {selectedMember?.full_name || selectedMember?.email} da empresa. O usuário perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => selectedMember && removeMutation.mutate(selectedMember.user_id)}>
              {removeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
