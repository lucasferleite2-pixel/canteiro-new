import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, ArrowLeftRight } from "lucide-react";
import { labelTipoMovimentacao, formatBRL } from "@/lib/estoqueUtils";

const TIPO_BADGE: Record<string, string> = {
  entrada: "bg-green-100 text-green-700 border-green-200",
  saida: "bg-red-100 text-red-700 border-red-200",
  transferencia: "bg-blue-100 text-blue-700 border-blue-200",
  ajuste: "bg-orange-100 text-orange-700 border-orange-200",
  inventario: "bg-purple-100 text-purple-700 border-purple-200",
  retorno: "bg-teal-100 text-teal-700 border-teal-200",
};

export default function EstoqueMovimentacoes() {
  const { companyId } = useAuth();
  const [searchParams] = useSearchParams();
  const [tipoFilter, setTipoFilter] = useState("all");
  const [produtoFilter, setProdutoFilter] = useState(searchParams.get("produto") || "all");
  const [depositoFilter, setDepositoFilter] = useState("all");
  const [obraFilter, setObraFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: depositos = [] } = useQuery({
    queryKey: ["depositos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("depositos").select("id, nome").eq("company_id", companyId).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_estoque", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("produtos_estoque").select("id, nome").eq("company_id", companyId).order("nome");
      return data || [];
    },
    enabled: !!companyId,
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

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["estoque_movimentacoes", companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("estoque_movimentacoes")
        .select(`
          id, tipo, quantidade, preco_unitario, preco_total, motivo, documento_referencia, created_at,
          produto_id, produtos_estoque(nome, unidade),
          deposito_origem_id, deposito_origem:deposito_origem_id(nome),
          deposito_destino_id, deposito_destino:deposito_destino_id(nome),
          project_id, projects(name),
          criado_por
        `)
        .eq("company_id", companyId)
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const allMovs: any[] = movs as any[];

  const filtered = allMovs.filter((m: any) => {
    if (tipoFilter !== "all" && m.tipo !== tipoFilter) return false;
    if (produtoFilter !== "all" && m.produto_id !== produtoFilter) return false;
    if (depositoFilter !== "all" && m.deposito_origem_id !== depositoFilter && m.deposito_destino_id !== depositoFilter) return false;
    if (obraFilter !== "all" && m.project_id !== obraFilter) return false;
    return true;
  });

  const totalEntradas = filtered.filter((m: any) => m.tipo === "entrada").reduce((s: number, m: any) => s + Number(m.preco_total || 0), 0);
  const totalSaidas = filtered.filter((m: any) => m.tipo === "saida").reduce((s: number, m: any) => s + Number(m.preco_total || 0), 0);
  const saldoPeriodo = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimentações de Estoque</h1>
          <p className="text-muted-foreground text-sm">Histórico completo de movimentações com rastreabilidade.</p>
        </div>
        <Button asChild>
          <Link to="/estoque/nova"><Plus className="mr-2 h-4 w-4" /> Nova Movimentação</Link>
        </Button>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">De:</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Até:</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {["entrada","saida","transferencia","ajuste","inventario","retorno"].map(t => (
              <SelectItem key={t} value={t}>{labelTipoMovimentacao(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={produtoFilter} onValueChange={setProdutoFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {(produtos as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={depositoFilter} onValueChange={setDepositoFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Depósito" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os depósitos</SelectItem>
            {(depositos as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={obraFilter} onValueChange={setObraFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Obra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as obras</SelectItem>
            {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhuma movimentação encontrada.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>De / Para</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => {
                  const tipoCfg = TIPO_BADGE[m.tipo] || "";
                  const origem = m.deposito_origem?.nome;
                  const destino = m.deposito_destino?.nome;
                  const fluxo = origem && destino ? `${origem} → ${destino}` : origem || destino || "—";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${tipoCfg}`}>{labelTipoMovimentacao(m.tipo)}</Badge></TableCell>
                      <TableCell className="font-medium">{m.produtos_estoque?.nome || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fluxo}</TableCell>
                      <TableCell className="text-right font-mono">{Number(m.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</TableCell>
                      <TableCell className="text-right">{m.preco_unitario > 0 ? formatBRL(Number(m.preco_unitario)) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{m.preco_total > 0 ? formatBRL(Number(m.preco_total)) : "—"}</TableCell>
                      <TableCell className="text-sm">{m.projects?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{m.motivo || m.documento_referencia || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Summary footer */}
          <div className="flex gap-6 text-sm border-t pt-3">
            <span>Total entradas: <span className="font-semibold text-green-600">{formatBRL(totalEntradas)}</span></span>
            <span>Total saídas: <span className="font-semibold text-red-600">{formatBRL(totalSaidas)}</span></span>
            <span>Saldo do período: <span className={`font-semibold ${saldoPeriodo >= 0 ? "text-green-600" : "text-red-600"}`}>{formatBRL(saldoPeriodo)}</span></span>
          </div>
        </>
      )}
    </div>
  );
}
