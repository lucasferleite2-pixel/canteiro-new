import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/financeiroUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";

type ContaBancaria = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  saldo_inicial: number;
  saldo_atual: number;
  cor: string | null;
  ativa: boolean;
};

const TIPO_LABELS: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  caixa: "Caixa",
  cartao_credito: "Cartão de Crédito",
  outros: "Outros",
};

export default function ContasBancarias() {
  const { companyId, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0", cor: "#0071E3" });

  const { data: contas = [], isLoading } = useQuery<ContaBancaria[]>({
    queryKey: ["contas_bancarias", companyId],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("contas_bancarias").select("*").eq("company_id", companyId!).eq("ativa", true).order("nome");
      if (error) throw error;
      return data as ContaBancaria[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any).from("contas_bancarias").insert({ ...payload, company_id: companyId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Conta criada com sucesso");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { error } = await (supabase as any).from("contas_bancarias").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Conta atualizada");
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("contas_bancarias").update({ ativa: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Conta removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0", cor: "#0071E3" });
  }

  function openNew() {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(c: ContaBancaria) {
    setEditingId(c.id);
    setForm({ nome: c.nome, banco: c.banco || "", agencia: c.agencia || "", conta: c.conta || "", tipo: c.tipo, saldo_inicial: String(c.saldo_inicial), cor: c.cor || "#0071E3" });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.nome) { toast.error("Nome obrigatório"); return; }
    const saldo = parseFloat(form.saldo_inicial || "0");
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: { nome: form.nome, banco: form.banco || null, agencia: form.agencia || null, conta: form.conta || null, tipo: form.tipo, cor: form.cor } });
    } else {
      createMutation.mutate({ nome: form.nome, banco: form.banco || null, agencia: form.agencia || null, conta: form.conta || null, tipo: form.tipo, saldo_inicial: saldo, saldo_atual: saldo, cor: form.cor });
    }
  }

  const total = contas.reduce((s, c) => s + c.saldo_atual, 0);

  if (isDemo) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Contas Bancárias</h1>
        <p className="text-muted-foreground">Funcionalidade disponível para empresas cadastradas.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-6 w-6" />Contas Bancárias</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas contas e visualize saldos consolidados</p>
        </div>
        <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" />Nova Conta</Button>
      </div>

      {/* Total card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Saldo Consolidado</div>
            <div className={`text-2xl font-bold ${total >= 0 ? "text-green-600" : "text-red-500"}`}>{formatBRL(total)}</div>
          </div>
          <div className="text-xs text-muted-foreground">{contas.length} conta{contas.length !== 1 ? "s" : ""}</div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {contas.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ background: c.cor || "#0071E3" }} />
                  <div>
                    <div className="font-medium text-sm">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.banco && `${c.banco} · `}
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{TIPO_LABELS[c.tipo] || c.tipo}</Badge>
                    </div>
                    {(c.agencia || c.conta) && (
                      <div className="text-xs text-muted-foreground">
                        {c.agencia && `Ag: ${c.agencia}`}{c.agencia && c.conta && " | "}{c.conta && `CC: ${c.conta}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Saldo atual</div>
                <div className={`text-lg font-bold ${c.saldo_atual >= 0 ? "text-green-600" : "text-red-500"}`}>{formatBRL(c.saldo_atual)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && contas.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da conta *</Label>
              <Input className="h-9 text-sm" placeholder="Ex: Conta Corrente Bradesco" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Banco</Label>
                <Input className="h-9 text-sm" placeholder="Ex: Bradesco" value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Agência</Label>
                <Input className="h-9 text-sm" value={form.agencia} onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Nº da Conta</Label>
                <Input className="h-9 text-sm" value={form.conta} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} />
              </div>
              {!editingId && (
                <div>
                  <Label className="text-xs">Saldo Inicial (R$)</Label>
                  <Input className="h-9 text-sm" type="number" min="0" step="0.01" value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
                </div>
              )}
              <div>
                <Label className="text-xs">Cor de identificação</Label>
                <div className="flex gap-2 items-center">
                  <Input className="h-9 w-12 p-1 text-sm" type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} />
                  <span className="text-xs text-muted-foreground">{form.cor}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar" : "Criar Conta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
