import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL, getMonthRange } from "@/lib/financeiroUtils";
import { seedDefaultCategories } from "@/lib/defaultCategories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, ChevronLeft, ChevronRight, Wallet, TrendingUp, TrendingDown, DollarSign, Pencil, Trash2, ChevronDown, ChevronUp, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type LancamentoRow = {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  due_date: string | null;
  paid_at: string | null;
  project_id: string | null;
  company_id: string;
  created_at: string;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  conta_bancaria_id: string | null;
  categoria_id: string | null;
  recorrencia: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  numero_documento: string | null;
};

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

type CategoriaFinanceira = {
  id: string;
  nome: string;
  tipo: string;
  pai_id: string | null;
  cor: string | null;
};

type Project = { id: string; name: string };

const EMPTY_FORM = {
  tipo: "expense" as "income" | "expense",
  description: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  status: "realizado" as "previsto" | "realizado",
  data_vencimento: "",
  data_pagamento: new Date().toISOString().slice(0, 10),
  project_id: "",
  conta_bancaria_id: "",
  categoria_id: "",
  recorrencia: "nenhuma",
  observacoes: "",
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function FluxoCaixa() {
  const { companyId, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filterProjeto, setFilterProjeto] = useState("all");
  const [filterConta, setFilterConta] = useState("all");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [contasOpen, setContasOpen] = useState(false);
  const [contaDialogOpen, setContaDialogOpen] = useState(false);
  const [editingContaId, setEditingContaId] = useState<string | null>(null);
  const [contaForm, setContaForm] = useState({ nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0", cor: "#0071E3" });

  const { start, end } = getMonthRange(year, month);

  // Queries
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", companyId],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ["contas_bancarias", companyId],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("contas_bancarias").select("*").eq("company_id", companyId!).eq("ativa", true).order("nome");
      if (error) throw error;
      return data as ContaBancaria[];
    },
  });

  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["categorias_financeiras", companyId],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("categorias_financeiras").select("*").eq("company_id", companyId!).order("nome");
      if (error) throw error;
      if (data && data.length === 0 && companyId) {
        seedDefaultCategories(supabase, companyId).then(() => {
          queryClient.invalidateQueries({ queryKey: ["categorias_financeiras", companyId] });
        });
      }
      return data as CategoriaFinanceira[];
    },
  });

  const { data: lancamentos = [] } = useQuery<LancamentoRow[]>({
    queryKey: ["financial_records_fluxo", companyId, start, end],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .eq("company_id", companyId!)
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        status: r.status ?? "realizado",
        data_vencimento: r.data_vencimento ?? r.due_date,
        data_pagamento: r.data_pagamento ?? r.paid_at,
      }));
    },
  });

  const { data: contasPagar = [] } = useQuery<LancamentoRow[]>({
    queryKey: ["contas_pagar", companyId],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .eq("company_id", companyId!)
        .eq("type", "expense")
        .eq("status", "previsto")
        .order("data_vencimento" as any, { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ ...r, status: r.status ?? "previsto", data_vencimento: r.data_vencimento ?? r.due_date }));
    },
  });

  const { data: contasReceber = [] } = useQuery<LancamentoRow[]>({
    queryKey: ["contas_receber", companyId],
    enabled: !!companyId && !isDemo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .eq("company_id", companyId!)
        .eq("type", "income")
        .eq("status", "previsto")
        .order("data_vencimento" as any, { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ ...r, status: r.status ?? "previsto", data_vencimento: r.data_vencimento ?? r.due_date }));
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.from("financial_records").insert({ ...payload, company_id: companyId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records_fluxo"] });
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["contas_receber"] });
      toast.success("Lançamento criado");
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { error } = await supabase.from("financial_records").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records_fluxo"] });
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["contas_receber"] });
      toast.success("Lançamento atualizado");
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records_fluxo"] });
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["contas_receber"] });
      toast.success("Lançamento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_records").update({ status: "realizado", data_pagamento: new Date().toISOString().slice(0, 10) } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records_fluxo"] });
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["contas_receber"] });
      toast.success("Baixado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createContaMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any).from("contas_bancarias").insert({ ...payload, company_id: companyId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Conta criada");
      setContaDialogOpen(false);
      setContaForm({ nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0", cor: "#0071E3" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateContaMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { error } = await (supabase as any).from("contas_bancarias").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Conta atualizada");
      setContaDialogOpen(false);
      setEditingContaId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteContaMutation = useMutation({
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

  // KPIs
  const saldoAtual = contas.reduce((s, c) => s + c.saldo_atual, 0);
  const receitasMes = lancamentos.filter((l) => l.type === "income" && l.status === "realizado").reduce((s, l) => s + l.amount, 0);
  const despesasMes = lancamentos.filter((l) => l.type === "expense" && l.status === "realizado").reduce((s, l) => s + l.amount, 0);
  const resultado = receitasMes - despesasMes;

  // Chart data — daily running balance
  const chartData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { dia: string; realizado: number | null; previsto: number | null }[] = [];
    let saldoR = saldoAtual - receitasMes + despesasMes; // approximate start
    let saldoP = saldoR;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayLancR = lancamentos.filter((l) => (l.data_vencimento || l.due_date || "").slice(0, 10) === dateStr && l.status === "realizado");
      const dayLancP = lancamentos.filter((l) => (l.data_vencimento || l.due_date || "").slice(0, 10) === dateStr && l.status === "previsto");
      for (const l of dayLancR) saldoR += l.type === "income" ? l.amount : -l.amount;
      for (const l of dayLancP) saldoP += l.type === "income" ? l.amount : -l.amount;
      days.push({ dia: String(d), realizado: saldoR, previsto: saldoP });
    }
    return days;
  }, [lancamentos, year, month, saldoAtual, receitasMes, despesasMes]);

  // Filtered transactions list
  const filtered = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filterProjeto !== "all" && l.project_id !== filterProjeto) return false;
      if (filterConta !== "all" && l.conta_bancaria_id !== filterConta) return false;
      if (filterCategoria !== "all" && l.categoria_id !== filterCategoria) return false;
      if (filterType !== "all" && l.type !== filterType) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      return true;
    });
  }, [lancamentos, filterProjeto, filterConta, filterCategoria, filterType, filterStatus]);

  const PAGE_SIZE = 20;
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  function openNew(tipo?: "income" | "expense") {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tipo: tipo ?? "expense" });
    setDialogOpen(true);
  }

  function openEdit(l: LancamentoRow) {
    setEditingId(l.id);
    setForm({
      tipo: l.type as "income" | "expense",
      description: l.description,
      amount: String(l.amount),
      date: (l.due_date || "").slice(0, 10),
      status: (l.status || "realizado") as "previsto" | "realizado",
      data_vencimento: (l.data_vencimento || "").slice(0, 10),
      data_pagamento: (l.data_pagamento || "").slice(0, 10),
      project_id: l.project_id || "",
      conta_bancaria_id: l.conta_bancaria_id || "",
      categoria_id: l.categoria_id || "",
      recorrencia: l.recorrencia || "nenhuma",
      observacoes: l.observacoes || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const amount = parseFloat(form.amount);
    if (!form.description || isNaN(amount) || amount <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    const payload: any = {
      type: form.tipo,
      description: form.description,
      amount,
      due_date: form.date || null,
      status: form.status,
      data_vencimento: form.status === "previsto" ? form.data_vencimento || form.date : null,
      data_pagamento: form.status === "realizado" ? form.data_pagamento || form.date : null,
      project_id: form.project_id || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      categoria_id: form.categoria_id || null,
      recorrencia: form.recorrencia,
      observacoes: form.observacoes || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleContaSubmit() {
    if (!contaForm.nome) { toast.error("Nome obrigatório"); return; }
    const payload = { ...contaForm, saldo_inicial: parseFloat(contaForm.saldo_inicial || "0"), saldo_atual: parseFloat(contaForm.saldo_inicial || "0") };
    if (editingContaId) {
      updateContaMutation.mutate({ id: editingContaId, payload: { nome: payload.nome, banco: payload.banco, agencia: payload.agencia, conta: payload.conta, tipo: payload.tipo, cor: payload.cor } });
    } else {
      createContaMutation.mutate(payload);
    }
  }

  const isVencido = (d: string | null) => d && isAfter(startOfDay(new Date()), startOfDay(parseISO(d)));

  const getProjetoNome = (id: string | null) => projects.find((p) => p.id === id)?.name || "—";
  const getContaNome = (id: string | null) => contas.find((c) => c.id === id)?.nome || "—";
  const getCategoriaNome = (id: string | null) => categorias.find((c) => c.id === id)?.nome || "—";

  if (isDemo) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Fluxo de Caixa</h1>
        <p className="text-muted-foreground">Funcionalidade disponível para empresas cadastradas.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector */}
          <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium w-32 text-center">{MONTH_NAMES[month]} {year}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {/* Filters */}
          <Select value={filterProjeto} onValueChange={setFilterProjeto}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Obra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterConta} onValueChange={setFilterConta}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => openNew()} className="h-8 text-xs gap-1"><Plus className="h-4 w-4" />Novo Lançamento</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Wallet className="h-4 w-4" />Saldo Atual</div>
            <div className={`text-xl font-bold ${saldoAtual >= 0 ? "text-green-600" : "text-red-500"}`}>{formatBRL(saldoAtual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-4 w-4" />Receitas</div>
            <div className="text-xl font-bold text-green-600">{formatBRL(receitasMes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingDown className="h-4 w-4" />Despesas</div>
            <div className="text-xl font-bold text-red-500">{formatBRL(despesasMes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="h-4 w-4" />Resultado</div>
            <div className={`text-xl font-bold ${resultado >= 0 ? "text-green-600" : "text-red-500"}`}>{formatBRL(resultado)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Saldo Corrido — {MONTH_NAMES[month]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ realizado: { label: "Realizado", color: "#0071E3" }, previsto: { label: "Previsto", color: "#9CA3AF" } }} className="h-52">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBRL(v).replace("R$\u00a0", "R$")} width={80} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatBRL(Number(v))} />} />
              <Line type="monotone" dataKey="realizado" stroke="#0071E3" strokeWidth={2} dot={false} name="Realizado" />
              <Line type="monotone" dataKey="previsto" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Previsto" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Contas a Pagar / Receber */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Contas a Pagar */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-red-600">Contas a Pagar</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openNew("expense")}><Plus className="h-3 w-3" />Nova</Button>
          </CardHeader>
          <CardContent className="p-0">
            {contasPagar.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4">Nenhuma conta a pagar.</p>
            ) : (
              <div className="divide-y">
                {contasPagar.slice(0, 8).map((l) => (
                  <div key={l.id} className={`flex items-center justify-between px-4 py-2 text-sm ${isVencido(l.data_vencimento) ? "bg-red-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{l.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.data_vencimento ? format(parseISO(l.data_vencimento), "dd/MM/yy") : "—"} · {getProjetoNome(l.project_id)}
                        {isVencido(l.data_vencimento) && <span className="ml-1 text-red-500 font-medium">VENCIDO</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-red-600 font-medium text-xs">{formatBRL(l.amount)}</span>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => baixarMutation.mutate(l.id)}>Baixar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contas a Receber */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-green-600">Contas a Receber</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openNew("income")}><Plus className="h-3 w-3" />Nova</Button>
          </CardHeader>
          <CardContent className="p-0">
            {contasReceber.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4">Nenhuma conta a receber.</p>
            ) : (
              <div className="divide-y">
                {contasReceber.slice(0, 8).map((l) => (
                  <div key={l.id} className={`flex items-center justify-between px-4 py-2 text-sm ${isVencido(l.data_vencimento) ? "bg-green-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{l.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.data_vencimento ? format(parseISO(l.data_vencimento), "dd/MM/yy") : "—"} · {getProjetoNome(l.project_id)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-green-600 font-medium text-xs">{formatBRL(l.amount)}</span>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => baixarMutation.mutate(l.id)}>Receber</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">Lançamentos — {MONTH_NAMES[month]} {year}</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Obra</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">Nenhum lançamento no período.</TableCell></TableRow>
                )}
                {paginated.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{l.due_date ? format(parseISO(l.due_date), "dd/MM") : "—"}</TableCell>
                    <TableCell className="text-xs font-medium max-w-[160px] truncate">{l.description}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{getCategoriaNome(l.categoria_id)}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{getProjetoNome(l.project_id)}</TableCell>
                    <TableCell className={`text-xs text-right font-medium ${l.type === "income" ? "text-green-600" : "text-red-500"}`}>
                      {l.type === "income" ? "+" : "-"}{formatBRL(l.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.status === "realizado" ? "default" : "secondary"} className="text-xs">
                        {l.status === "realizado" ? "Realizado" : "Previsto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(l)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => deleteMutation.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
              <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="ghost" size="sm" disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contas Bancárias collapsible */}
      <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setContasOpen(o => !o)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" />Contas Bancárias</CardTitle>
            {contasOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {contasOpen && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
              {contas.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: c.cor || "#0071E3" }} />
                    <span className="text-xs font-medium truncate">{c.nome}</span>
                  </div>
                  {c.banco && <div className="text-xs text-muted-foreground">{c.banco}</div>}
                  <div className={`text-sm font-bold ${c.saldo_atual >= 0 ? "text-green-600" : "text-red-500"}`}>{formatBRL(c.saldo_atual)}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setEditingContaId(null); setContaForm({ nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0", cor: "#0071E3" }); setContaDialogOpen(true); }}>
              <Plus className="h-3 w-3" />Gerenciar contas
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Novo Lançamento Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tipo toggle */}
            <div className="flex gap-2">
              <Button variant={form.tipo === "income" ? "default" : "outline"} className="flex-1 text-sm" onClick={() => setForm(f => ({ ...f, tipo: "income" }))}>
                <TrendingUp className="h-4 w-4 mr-1" />Receita
              </Button>
              <Button variant={form.tipo === "expense" ? "default" : "outline"} className="flex-1 text-sm" onClick={() => setForm(f => ({ ...f, tipo: "expense" }))}>
                <TrendingDown className="h-4 w-4 mr-1" />Despesa
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Descrição *</Label>
                <Input className="h-9 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valor *</Label>
                <Input className="h-9 text-sm" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input className="h-9 text-sm" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="previsto">Previsto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.status === "previsto" && (
                <div>
                  <Label className="text-xs">Data de Vencimento</Label>
                  <Input className="h-9 text-sm" type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
              )}
              {form.status === "realizado" && (
                <div>
                  <Label className="text-xs">Data de Pagamento</Label>
                  <Input className="h-9 text-sm" type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
                </div>
              )}
              <div>
                <Label className="text-xs">Obra</Label>
                <Select value={form.project_id || "none"} onValueChange={v => setForm(f => ({ ...f, project_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Conta Bancária</Label>
                <Select value={form.conta_bancaria_id || "none"} onValueChange={v => setForm(f => ({ ...f, conta_bancaria_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria_id || "none"} onValueChange={v => setForm(f => ({ ...f, categoria_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categorias.filter(c => c.tipo === form.tipo || !c.tipo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Recorrência</Label>
                <Select value={form.recorrencia} onValueChange={v => setForm(f => ({ ...f, recorrencia: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea className="text-sm resize-none" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conta Bancária Dialog */}
      <Dialog open={contaDialogOpen} onOpenChange={setContaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContaId ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da conta *</Label>
              <Input className="h-9 text-sm" value={contaForm.nome} onChange={e => setContaForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Banco</Label>
                <Input className="h-9 text-sm" value={contaForm.banco} onChange={e => setContaForm(f => ({ ...f, banco: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={contaForm.tipo} onValueChange={v => setContaForm(f => ({ ...f, tipo: v }))}>
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
                <Input className="h-9 text-sm" value={contaForm.agencia} onChange={e => setContaForm(f => ({ ...f, agencia: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Conta</Label>
                <Input className="h-9 text-sm" value={contaForm.conta} onChange={e => setContaForm(f => ({ ...f, conta: e.target.value }))} />
              </div>
              {!editingContaId && (
                <div>
                  <Label className="text-xs">Saldo Inicial (R$)</Label>
                  <Input className="h-9 text-sm" type="number" min="0" step="0.01" value={contaForm.saldo_inicial} onChange={e => setContaForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
                </div>
              )}
              <div>
                <Label className="text-xs">Cor</Label>
                <Input className="h-9 text-sm" type="color" value={contaForm.cor} onChange={e => setContaForm(f => ({ ...f, cor: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setContaDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleContaSubmit} disabled={createContaMutation.isPending || updateContaMutation.isPending}>
                {editingContaId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
