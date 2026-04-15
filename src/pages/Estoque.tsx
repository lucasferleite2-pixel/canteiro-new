import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Package, Warehouse, Box, AlertTriangle, Loader2, FileText } from "lucide-react";
import { calcularStatusEstoque, calcularValorTotalEstoque, formatBRL } from "@/lib/estoqueUtils";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  critico: { label: "Crítico", className: "bg-red-100 text-red-700 border-red-200" },
  baixo: { label: "Baixo", className: "bg-orange-100 text-orange-700 border-orange-200" },
  normal: { label: "Normal", className: "bg-green-100 text-green-700 border-green-200" },
  alto: { label: "Alto", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

export default function Estoque() {
  const { companyId } = useAuth();
  const [search, setSearch] = useState("");
  const [depositoFilter, setDepositoFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"produto" | "deposito" | "obra">("produto");

  const { data: depositos = [] } = useQuery({
    queryKey: ["depositos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("depositos" as any).select("id, nome, tipo").eq("company_id", companyId).eq("ativo", true).order("nome");
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

  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ["estoque_saldos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("estoque_saldos")
        .select(`
          id, quantidade, custo_medio,
          deposito_id,
          depositos(id, nome, tipo, project_id),
          produto_id,
          produtos_estoque(id, codigo, nome, unidade, categoria, estoque_minimo, estoque_maximo)
        `)
        .eq("company_id", companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const allSaldos: any[] = saldos as any[];

  const filtered = allSaldos.filter((s: any) => {
    const prod = s.produtos_estoque;
    const dep = s.depositos;
    if (!prod) return false;
    if (search && !prod.nome.toLowerCase().includes(search.toLowerCase()) && !(prod.codigo || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (depositoFilter !== "all" && s.deposito_id !== depositoFilter) return false;
    if (projectFilter !== "all" && dep?.project_id !== projectFilter) return false;
    if (categoryFilter !== "all" && prod.categoria !== categoryFilter) return false;
    const status = calcularStatusEstoque(Number(s.quantidade), Number(prod.estoque_minimo), prod.estoque_maximo ? Number(prod.estoque_maximo) : undefined);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    return true;
  });

  const alertas = allSaldos.filter((s: any) => {
    const prod = s.produtos_estoque;
    if (!prod) return false;
    const status = calcularStatusEstoque(Number(s.quantidade), Number(prod.estoque_minimo), prod.estoque_maximo ? Number(prod.estoque_maximo) : undefined);
    return status === "critico" || status === "baixo";
  });

  const totalValue = calcularValorTotalEstoque(allSaldos.map((s: any) => ({ quantidade: Number(s.quantidade), custo_medio: Number(s.custo_medio) })));
  const produtosCount = new Set(allSaldos.map((s: any) => s.produto_id)).size;
  const depositosAtivos = depositos.length;

  const categories = [...new Set(allSaldos.map((s: any) => s.produtos_estoque?.categoria).filter(Boolean))];

  const groupedByDeposito = viewMode === "deposito"
    ? (depositos as any[]).reduce((acc: Record<string, any[]>, dep: any) => {
        acc[dep.nome] = filtered.filter((s: any) => s.deposito_id === dep.id);
        return acc;
      }, {})
    : null;

  const groupedByObra = viewMode === "obra"
    ? (projects as any[]).reduce((acc: Record<string, any[]>, proj: any) => {
        acc[proj.name] = filtered.filter((s: any) => s.depositos?.project_id === proj.id);
        return acc;
      }, {})
    : null;

  const renderRows = (rows: any[]) =>
    rows.map((s: any) => {
      const prod = s.produtos_estoque;
      const dep = s.depositos;
      if (!prod) return null;
      const status = calcularStatusEstoque(Number(s.quantidade), Number(prod.estoque_minimo), prod.estoque_maximo ? Number(prod.estoque_maximo) : undefined);
      const badgeCfg = STATUS_BADGE[status];
      const valorTotal = Number(s.quantidade) * Number(s.custo_medio);
      return (
        <TableRow key={s.id}>
          <TableCell className="font-medium">{prod.nome}</TableCell>
          <TableCell className="text-muted-foreground text-sm">{prod.codigo || "—"}</TableCell>
          <TableCell>{prod.unidade}</TableCell>
          <TableCell>{dep?.nome || "—"}</TableCell>
          <TableCell className="text-right font-mono">{Number(s.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</TableCell>
          <TableCell className="text-right">{formatBRL(Number(s.custo_medio))}</TableCell>
          <TableCell className="text-right font-semibold">{formatBRL(valorTotal)}</TableCell>
          <TableCell>
            <Badge variant="outline" className={`text-xs ${badgeCfg.className}`}>{badgeCfg.label}</Badge>
          </TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                <Link to={`/estoque/nova?tipo=entrada&produto=${prod.id}`}>Entrada</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                <Link to={`/estoque/nova?tipo=saida&produto=${prod.id}&deposito=${s.deposito_id}`}>Saída</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                <Link to={`/estoque/nova?tipo=transferencia&produto=${prod.id}&deposito=${s.deposito_id}`}>Transferir</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                <Link to={`/estoque/movimentacoes?produto=${prod.id}`}>Histórico</Link>
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Estoque</h1>
          <p className="text-muted-foreground text-sm">Valor total em estoque: <span className="font-semibold text-foreground">{formatBRL(totalValue)}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild>
            <Link to="/estoque/nova"><Plus className="mr-2 h-4 w-4" /> Nova Movimentação</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/estoque/produtos"><Box className="mr-2 h-4 w-4" /> Novo Produto</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/estoque/depositos"><Warehouse className="mr-2 h-4 w-4" /> Depósitos</Link>
          </Button>
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" /> Relatório PDF
          </Button>
        </div>
      </div>

      {/* Alert banner */}
      {alertas.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700">
            <strong>{alertas.length} produto(s)</strong> com estoque crítico ou abaixo do mínimo:{" "}
            {alertas.slice(0, 3).map((s: any) => s.produtos_estoque?.nome).join(", ")}
            {alertas.length > 3 && ` e mais ${alertas.length - 3}...`}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total em Estoque</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatBRL(totalValue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Produtos Cadastrados</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{produtosCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Depósitos Ativos</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{depositosAtivos}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Alertas de Estoque</CardTitle></CardHeader>
          <CardContent><p className={`text-xl font-bold ${alertas.length > 0 ? "text-orange-600" : ""}`}>{alertas.length}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
        />
        <Select value={depositoFilter} onValueChange={setDepositoFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Depósito" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os depósitos</SelectItem>
            {(depositos as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Obra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as obras</SelectItem>
            {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="alto">Alto</SelectItem>
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-1 ml-auto">
          {(["produto", "deposito", "obra"] as const).map(mode => (
            <Button key={mode} variant={viewMode === mode ? "default" : "outline"} size="sm" onClick={() => setViewMode(mode)}>
              {mode === "produto" ? "Por Produto" : mode === "deposito" ? "Por Depósito" : "Por Obra"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum produto em estoque encontrado.</p>
          <Button asChild variant="outline"><Link to="/estoque/produtos"><Plus className="mr-2 h-4 w-4" /> Cadastrar Produto</Link></Button>
        </CardContent></Card>
      ) : viewMode === "produto" ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead className="text-right">Qtd Disponível</TableHead>
                <TableHead className="text-right">Custo Médio</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows(filtered)}</TableBody>
          </Table>
        </div>
      ) : viewMode === "deposito" ? (
        <div className="space-y-4">
          {Object.entries(groupedByDeposito || {}).filter(([, rows]) => rows.length > 0).map(([depNome, rows]) => (
            <div key={depNome}>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">{depNome}</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead className="text-right">Qtd Disponível</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderRows(rows)}</TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByObra || {}).filter(([, rows]) => rows.length > 0).map(([projName, rows]) => (
            <div key={projName}>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">{projName}</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead className="text-right">Qtd Disponível</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderRows(rows)}</TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
