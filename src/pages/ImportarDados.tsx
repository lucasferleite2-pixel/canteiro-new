import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileJson,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import {
  importData,
  validatePayload,
  getPreviewCounts,
  type ImportPayload,
  type TableResult,
  type PreviewCounts,
} from "@/lib/importData";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "preview" | "importing" | "done";

interface TableProgress {
  processed: number;
  total: number;
}

// ── Label map ─────────────────────────────────────────────────────────────────

const PREVIEW_LABELS: { key: keyof PreviewCounts; label: string }[] = [
  { key: "company", label: "Empresa" },
  { key: "projects", label: "Obras / Projetos" },
  { key: "diary_entries", label: "Diário de Obra" },
  { key: "contracts", label: "Contratos" },
  { key: "financial_records", label: "Registros Financeiros" },
  { key: "bids", label: "Licitações" },
  { key: "alerts", label: "Alertas" },
  { key: "rdo_dia", label: "RDO — Dias" },
  { key: "rdo_atividade", label: "RDO — Atividades" },
  { key: "rdo_material", label: "RDO — Materiais" },
  { key: "rdo_despesa_item", label: "RDO — Despesas" },
  { key: "rdo_ocorrencia", label: "RDO — Ocorrências" },
  { key: "rdo_foto", label: "RDO — Fotos (metadados)" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportarDados() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [preview, setPreview] = useState<PreviewCounts | null>(null);
  const [progress, setProgress] = useState<Record<string, TableProgress>>({});
  const [results, setResults] = useState<TableResult[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const [totalSuccess, setTotalSuccess] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);

  // Admin check
  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ["is_admin", companyId, user?.id],
    queryFn: async () => {
      if (!companyId || !user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!companyId && !!user?.id,
  });

  // ── File handling ──────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json")) {
      toast({ title: "Arquivo inválido", description: "Apenas arquivos .json são aceitos.", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const { valid, error, payload: parsed } = validatePayload(raw);
        if (!valid || !parsed) {
          toast({ title: "Arquivo inválido", description: error, variant: "destructive" });
          return;
        }
        setPayload(parsed);
        setPreview(getPreviewCounts(parsed));
        setPhase("preview");
      } catch {
        toast({ title: "Erro ao ler arquivo", description: "O arquivo não é um JSON válido.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!payload || !companyId || !user?.id) return;

    setPhase("importing");
    setProgress({});
    setResults([]);

    const onProgress = (table: string, processed: number, total: number) => {
      setProgress((prev) => ({ ...prev, [table]: { processed, total } }));
    };

    try {
      const summary = await importData(payload, companyId, user.id, onProgress);
      setResults(summary.results);
      setTotalSuccess(summary.totalSuccess);
      setTotalErrors(summary.totalErrors);
      setPhase("done");

      if (summary.totalErrors === 0) {
        toast({ title: "Importação concluída!", description: `${summary.totalSuccess} registros importados com sucesso.` });
      } else {
        toast({
          title: "Importação concluída com erros",
          description: `${summary.totalSuccess} sucesso, ${summary.totalErrors} erro(s).`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Erro inesperado", description: String(err), variant: "destructive" });
      setPhase("preview");
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setPayload(null);
    setPreview(null);
    setFileName("");
    setProgress({});
    setResults([]);
    setExpandedErrors({});
    setTotalSuccess(0);
    setTotalErrors(0);
  };

  // ── Access guard ───────────────────────────────────────────────────────────

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <ShieldAlert className="h-12 w-12 text-destructive opacity-70" />
            <h2 className="text-lg font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground text-center">
              Apenas administradores podem importar dados. Fale com o responsável da empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalPreviewRecords = preview
    ? PREVIEW_LABELS.reduce((acc, { key }) => {
        const val = preview[key];
        return acc + (typeof val === "boolean" ? (val ? 1 : 0) : (val as number));
      }, 0)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Dados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe um arquivo de export do ERP para restaurar ou migrar dados entre empresas.
        </p>
      </div>

      {/* Upload Zone */}
      {phase === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Selecionar arquivo
            </CardTitle>
            <CardDescription>Apenas arquivos .json exportados pelo ERP Obra Inteligente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all",
                dragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-primary/5",
              ].join(" ")}
            >
              <FileJson className={`h-10 w-10 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center">
                <p className="text-sm font-medium">Arraste o arquivo aqui</p>
                <p className="text-xs text-muted-foreground mt-0.5">ou clique para selecionar</p>
              </div>
              <Badge variant="outline" className="text-xs">.json</Badge>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {(phase === "preview" || phase === "importing" || phase === "done") && preview && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-primary" />
                  {fileName}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {payload?.export_version && (
                    <span className="mr-3">versão: <strong>{payload.export_version}</strong></span>
                  )}
                  {payload?.exported_at && (
                    <span>exportado em: <strong>{new Date(payload.exported_at).toLocaleString("pt-BR")}</strong></span>
                  )}
                </CardDescription>
              </div>
              {phase !== "importing" && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Novo arquivo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Conteúdo detectado — {totalPreviewRecords} registros no total
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PREVIEW_LABELS.map(({ key, label }) => {
                const val = preview[key];
                const count = typeof val === "boolean" ? (val ? 1 : 0) : (val as number);
                if (count === 0) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.4)" }}
                  >
                    <span className="text-muted-foreground truncate">{label}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0 tabular-nums">
                      {typeof val === "boolean" ? "✓" : count}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {phase === "preview" && (
              <div className="pt-4">
                <Button onClick={handleImport} className="w-full rounded-xl" size="lg">
                  <Upload className="h-4 w-4 mr-2" />
                  Iniciar Importação
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Os dados existentes com o mesmo ID serão atualizados (upsert). Novos registros serão criados.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {(phase === "importing" || phase === "done") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {phase === "importing" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : totalErrors === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
              {phase === "importing" ? "Importando..." : "Resultado da importação"}
            </CardTitle>
            {phase === "done" && (
              <CardDescription>
                <span className="text-success font-medium">{totalSuccess} sucesso</span>
                {totalErrors > 0 && (
                  <span className="text-destructive font-medium ml-3">{totalErrors} erro(s)</span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Per-table progress while importing */}
            {phase === "importing" &&
              Object.entries(progress).map(([table, p]) => {
                const label = PREVIEW_LABELS.find((x) => x.key === table || x.label.toLowerCase().includes(table.replace("_", "").slice(0, 6)))?.label ?? table;
                const pct = p.total > 0 ? Math.round((p.processed / p.total) * 100) : 100;
                return (
                  <div key={table} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span>{p.processed}/{p.total}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}

            {/* Summary results after done */}
            {phase === "done" &&
              results
                .filter((r) => r.total > 0)
                .map((r) => {
                  const hasErrors = r.errors.length > 0;
                  const expanded = expandedErrors[r.table] ?? false;
                  return (
                    <div
                      key={r.table}
                      className="rounded-xl border p-3 space-y-2"
                      style={{ borderColor: hasErrors ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.35)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {hasErrors ? (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          )}
                          <span className="text-sm font-medium">{r.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs tabular-nums">
                            {r.success}/{r.total}
                          </Badge>
                          {hasErrors && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setExpandedErrors((prev) => ({ ...prev, [r.table]: !expanded }))
                              }
                            >
                              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                      </div>

                      {hasErrors && expanded && (
                        <div className="space-y-1 pt-1 border-t" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
                          {r.errors.map((e, idx) => (
                            <div key={idx} className="text-xs text-destructive bg-destructive/5 rounded-lg px-2.5 py-1.5">
                              {e.id && <span className="font-mono mr-1.5 opacity-70">[{e.id.slice(0, 8)}]</span>}
                              {e.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

            {phase === "done" && (
              <div className="pt-2">
                <Button variant="outline" onClick={handleReset} className="w-full rounded-xl">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Nova Importação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
