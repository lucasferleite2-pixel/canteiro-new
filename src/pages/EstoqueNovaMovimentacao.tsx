import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

type TipoMov = "entrada" | "saida" | "transferencia" | "inventario" | "retorno" | "ajuste";

const TIPOS: { value: TipoMov; label: string; icon: string }[] = [
  { value: "entrada", label: "Entrada", icon: "📦" },
  { value: "saida", label: "Saída", icon: "📤" },
  { value: "transferencia", label: "Transferência", icon: "🔄" },
  { value: "inventario", label: "Inventário", icon: "📋" },
  { value: "retorno", label: "Retorno", icon: "↩️" },
  { value: "ajuste", label: "Ajuste", icon: "⚙️" },
];

export default function EstoqueNovaMovimentacao() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [tipo, setTipo] = useState<TipoMov>((searchParams.get("tipo") as TipoMov) || "entrada");
  const [produtoId, setProdutoId] = useState(searchParams.get("produto") || "");
  const [depositoOrigemId, setDepositoOrigemId] = useState(searchParams.get("deposito") || "");
  const [depositoDestinoId, setDepositoDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [docRef, setDocRef] = useState(searchParams.get("doc_ref") || "");
  const [projectId, setProjectId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [inventarioRows, setInventarioRows] = useState<{ produto_id: string; nome: string; unidade: string; qtd_sistema: number; qtd_real: string }[]>([]);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_estoque", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("produtos_estoque").select("id, nome, unidade, codigo").eq("company_id", companyId).order("nome");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: depositos = [] } = useQuery({
    queryKey: ["depositos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("depositos").select("id, nome, tipo").eq("company_id", companyId).eq("ativo", true).order("nome");
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

  // Current balance for selected product+deposit
  const { data: saldoAtual } = useQuery({
    queryKey: ["saldo_atual", produtoId, depositoOrigemId],
    queryFn: async () => {
      if (!produtoId || !depositoOrigemId) return null;
      const { data } = await (supabase as any)
        .from("estoque_saldos")
        .select("quantidade, custo_medio")
        .eq("produto_id", produtoId)
        .eq("deposito_id", depositoOrigemId)
        .single();
      return data;
    },
    enabled: !!produtoId && !!depositoOrigemId,
  });

  // Load inventory rows when deposito selected for inventario type
  const { data: saldosDeposito = [] } = useQuery({
    queryKey: ["saldos_deposito_inventario", depositoOrigemId],
    queryFn: async () => {
      if (!depositoOrigemId) return [];
      const { data } = await (supabase as any)
        .from("estoque_saldos")
        .select("produto_id, quantidade, custo_medio, produtos_estoque(nome, unidade)")
        .eq("deposito_id", depositoOrigemId);
      return data || [];
    },
    enabled: !!depositoOrigemId && tipo === "inventario",
  });

  useEffect(() => {
    if (tipo === "inventario" && (saldosDeposito as any[]).length > 0) {
      setInventarioRows(
        (saldosDeposito as any[]).map((s: any) => ({
          produto_id: s.produto_id,
          nome: s.produtos_estoque?.nome || "",
          unidade: s.produtos_estoque?.unidade || "",
          qtd_sistema: Number(s.quantidade),
          qtd_real: String(Number(s.quantidade)),
        }))
      );
    }
  }, [tipo, depositoOrigemId, (saldosDeposito as any[]).length]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");

      if (tipo === "inventario") {
        // Insert one movement per product
        const inserts = inventarioRows
          .filter(r => r.qtd_real !== "" && Number(r.qtd_real) !== r.qtd_sistema)
          .map(r => ({
            company_id: companyId,
            deposito_destino_id: depositoOrigemId || null,
            produto_id: r.produto_id,
            tipo: "inventario" as const,
            quantidade: Number(r.qtd_real),
            preco_unitario: 0,
            motivo: motivo || "Inventário físico",
            criado_por: user?.id,
          }));
        if (inserts.length === 0) throw new Error("Nenhuma divergência encontrada no inventário.");
        const { error } = await (supabase as any).from("estoque_movimentacoes").insert(inserts);
        if (error) throw error;
        return;
      }

      if (!produtoId) throw new Error("Produto obrigatório");
      const qtd = parseFloat(quantidade);
      if (!qtd || qtd <= 0) throw new Error("Quantidade inválida");

      // Validate balance for saida/transferencia
      if ((tipo === "saida" || tipo === "transferencia") && saldoAtual) {
        if (qtd > Number((saldoAtual as any).quantidade)) {
          throw new Error(`Quantidade insuficiente. Saldo atual: ${Number((saldoAtual as any).quantidade).toLocaleString("pt-BR")} ${(produtos as any[]).find((p: any) => p.id === produtoId)?.unidade || ""}`);
        }
      }

      const insert: Record<string, any> = {
        company_id: companyId,
        produto_id: produtoId,
        tipo,
        quantidade: qtd,
        preco_unitario: parseFloat(precoUnitario) || 0,
        motivo: motivo || null,
        documento_referencia: docRef || null,
        project_id: projectId || null,
        criado_por: user?.id,
      };

      if (tipo === "entrada" || tipo === "retorno") {
        if (!depositoDestinoId) throw new Error("Depósito destino obrigatório");
        insert.deposito_destino_id = depositoDestinoId;
      } else if (tipo === "saida") {
        if (!depositoOrigemId) throw new Error("Depósito origem obrigatório");
        insert.deposito_origem_id = depositoOrigemId;
      } else if (tipo === "transferencia") {
        if (!depositoOrigemId) throw new Error("Depósito origem obrigatório");
        if (!depositoDestinoId) throw new Error("Depósito destino obrigatório");
        if (depositoOrigemId === depositoDestinoId) throw new Error("Depósitos de origem e destino devem ser diferentes");
        insert.deposito_origem_id = depositoOrigemId;
        insert.deposito_destino_id = depositoDestinoId;
      } else if (tipo === "ajuste") {
        insert.deposito_destino_id = depositoOrigemId || null;
        insert.deposito_origem_id = depositoOrigemId || null;
      }

      const { error } = await (supabase as any).from("estoque_movimentacoes").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque_saldos"] });
      qc.invalidateQueries({ queryKey: ["estoque_movimentacoes"] });
      toast({ title: "Movimentação registrada com sucesso!" });
      navigate("/estoque/movimentacoes");
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const selectedProduto: any = (produtos as any[]).find((p: any) => p.id === produtoId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nova Movimentação</h1>
          <p className="text-muted-foreground text-sm">Registre entradas, saídas, transferências e ajustes de estoque.</p>
        </div>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {TIPOS.map(t => (
          <Button
            key={t.value}
            variant={tipo === t.value ? "default" : "outline"}
            className="flex flex-col h-16 gap-1"
            onClick={() => setTipo(t.value)}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="text-xs">{t.label}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da Movimentação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {tipo === "inventario" ? (
            <>
              <div className="space-y-2">
                <Label>Depósito</Label>
                <Select value={depositoOrigemId} onValueChange={setDepositoOrigemId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
                  <SelectContent>
                    {(depositos as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {inventarioRows.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd Sistema</TableHead>
                        <TableHead className="text-right">Qtd Real</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventarioRows.map((r, i) => {
                        const diff = Number(r.qtd_real || 0) - r.qtd_sistema;
                        return (
                          <TableRow key={r.produto_id}>
                            <TableCell className="font-medium">{r.nome}</TableCell>
                            <TableCell className="text-right">{r.qtd_sistema.toLocaleString("pt-BR")} {r.unidade}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                className="w-24 h-7 text-xs ml-auto"
                                value={r.qtd_real}
                                onChange={e => {
                                  const newRows = [...inventarioRows];
                                  newRows[i] = { ...newRows[i], qtd_real: e.target.value };
                                  setInventarioRows(newRows);
                                }}
                              />
                            </TableCell>
                            <TableCell className={`text-right text-sm font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {diff !== 0 ? (diff > 0 ? `+${diff.toLocaleString("pt-BR")}` : diff.toLocaleString("pt-BR")) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Produto */}
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select value={produtoId} onValueChange={setProdutoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {(produtos as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Deposito origem */}
              {(tipo === "saida" || tipo === "transferencia" || tipo === "ajuste") && (
                <div className="space-y-2">
                  <Label>Depósito Origem *</Label>
                  <Select value={depositoOrigemId} onValueChange={setDepositoOrigemId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o depósito de origem" /></SelectTrigger>
                    <SelectContent>
                      {(depositos as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {saldoAtual && selectedProduto && (
                    <p className="text-xs text-muted-foreground">
                      Saldo atual: <span className="font-semibold">{Number((saldoAtual as any).quantidade).toLocaleString("pt-BR")} {selectedProduto.unidade}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Deposito destino */}
              {(tipo === "entrada" || tipo === "transferencia" || tipo === "retorno") && (
                <div className="space-y-2">
                  <Label>Depósito Destino *</Label>
                  <Select value={depositoDestinoId} onValueChange={setDepositoDestinoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o depósito de destino" /></SelectTrigger>
                    <SelectContent>
                      {(depositos as any[]).filter((d: any) => d.id !== depositoOrigemId).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantidade */}
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    placeholder="0"
                    className="w-40"
                  />
                  {selectedProduto && <span className="text-sm text-muted-foreground">{selectedProduto.unidade}</span>}
                </div>
                {(tipo === "saida" || tipo === "transferencia") && saldoAtual && quantidade && Number(quantidade) > Number((saldoAtual as any).quantidade) && (
                  <p className="text-xs text-red-600">Quantidade excede o saldo disponível ({Number((saldoAtual as any).quantidade).toLocaleString("pt-BR")})</p>
                )}
              </div>

              {/* Preco */}
              {(tipo === "entrada" || tipo === "retorno") && (
                <div className="space-y-2">
                  <Label>Preço Unitário</Label>
                  <Input type="number" step="0.01" value={precoUnitario} onChange={e => setPrecoUnitario(e.target.value)} placeholder="0,00" className="w-40" />
                </div>
              )}

              {/* Documento */}
              {(tipo === "entrada" || tipo === "retorno") && (
                <div className="space-y-2">
                  <Label>Documento de Referência</Label>
                  <Input value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="NF, pedido, etc." />
                </div>
              )}

              {/* Obra */}
              <div className="space-y-2">
                <Label>Obra (opcional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem obra</SelectItem>
                    {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>{tipo === "ajuste" ? "Motivo *" : "Observações"}</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Descreva o motivo ou observações..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Movimentação
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
