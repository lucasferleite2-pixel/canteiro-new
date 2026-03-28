import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportPayload {
  export_version: string;
  exported_at?: string;
  source_company_id?: string;
  company?: Record<string, unknown>;
  projects?: Record<string, unknown>[];
  diary_entries?: Record<string, unknown>[];
  contracts?: Record<string, unknown>[];
  financial_records?: Record<string, unknown>[];
  bids?: Record<string, unknown>[];
  alerts?: Record<string, unknown>[];
  rdo_dia?: Record<string, unknown>[];
  rdo_atividade?: Record<string, unknown>[];
  rdo_material?: Record<string, unknown>[];
  rdo_despesa_item?: Record<string, unknown>[];
  rdo_ocorrencia?: Record<string, unknown>[];
  rdo_foto?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface RecordError {
  id?: string;
  error: string;
}

export interface TableResult {
  table: string;
  label: string;
  total: number;
  success: number;
  skipped: number;
  errors: RecordError[];
}

export interface ImportSummary {
  results: TableResult[];
  totalSuccess: number;
  totalErrors: number;
}

export type ProgressCallback = (table: string, processed: number, total: number) => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

/**
 * Replace company_id and any user reference field in every record.
 */
function normalizeRecords(
  records: Record<string, unknown>[],
  companyId: string,
  userId: string,
  userFields: string[] = []
): Record<string, unknown>[] {
  return records.map((rec) => {
    const out: Record<string, unknown> = { ...rec };
    // Always replace company_id
    if ("company_id" in out) out.company_id = companyId;
    // Replace user reference fields
    for (const field of userFields) {
      if (field in out && out[field] !== null && out[field] !== undefined) {
        out[field] = userId;
      }
    }
    return out;
  });
}

/**
 * Upsert a batch of records into a Supabase table.
 * Returns list of errors for this batch.
 */
async function upsertBatch(
  table: string,
  records: Record<string, unknown>[]
): Promise<RecordError[]> {
  const errors: RecordError[] = [];
  // Try batch first
  const { error } = await (supabase.from(table as never) as ReturnType<typeof supabase.from>)
    .upsert(records as never, { onConflict: "id" });

  if (!error) return errors;

  // Batch failed — fall back to individual upserts for granular error reporting
  for (const record of records) {
    const { error: recErr } = await (supabase.from(table as never) as ReturnType<typeof supabase.from>)
      .upsert(record as never, { onConflict: "id" });
    if (recErr) {
      errors.push({
        id: String(record.id ?? "unknown"),
        error: recErr.message,
      });
    }
  }
  return errors;
}

/**
 * Import a full table with progress reporting.
 */
async function importTable(
  table: string,
  label: string,
  records: Record<string, unknown>[],
  onProgress?: ProgressCallback
): Promise<TableResult> {
  const result: TableResult = { table, label, total: records.length, success: 0, skipped: 0, errors: [] };

  if (records.length === 0) {
    onProgress?.(table, 0, 0);
    return result;
  }

  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchErrors = await upsertBatch(table, batch);
    const succeeded = batch.length - batchErrors.length;
    result.success += succeeded;
    result.errors.push(...batchErrors);
    processed += batch.length;
    onProgress?.(table, processed, records.length);
  }

  return result;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validatePayload(raw: unknown): { valid: boolean; error?: string; payload?: ImportPayload } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Arquivo JSON inválido: esperado um objeto na raiz." };
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.export_version) {
    return { valid: false, error: "Campo export_version ausente. Este arquivo não é um export válido do ERP." };
  }
  if (typeof obj.export_version !== "string") {
    return { valid: false, error: "Campo export_version deve ser uma string." };
  }
  return { valid: true, payload: obj as ImportPayload };
}

// ── Preview ───────────────────────────────────────────────────────────────────

export interface PreviewCounts {
  company: boolean;
  projects: number;
  diary_entries: number;
  contracts: number;
  financial_records: number;
  bids: number;
  alerts: number;
  rdo_dia: number;
  rdo_atividade: number;
  rdo_material: number;
  rdo_despesa_item: number;
  rdo_ocorrencia: number;
  rdo_foto: number;
}

export function getPreviewCounts(payload: ImportPayload): PreviewCounts {
  return {
    company: !!payload.company,
    projects: payload.projects?.length ?? 0,
    diary_entries: payload.diary_entries?.length ?? 0,
    contracts: payload.contracts?.length ?? 0,
    financial_records: payload.financial_records?.length ?? 0,
    bids: payload.bids?.length ?? 0,
    alerts: payload.alerts?.length ?? 0,
    rdo_dia: payload.rdo_dia?.length ?? 0,
    rdo_atividade: payload.rdo_atividade?.length ?? 0,
    rdo_material: payload.rdo_material?.length ?? 0,
    rdo_despesa_item: payload.rdo_despesa_item?.length ?? 0,
    rdo_ocorrencia: payload.rdo_ocorrencia?.length ?? 0,
    rdo_foto: payload.rdo_foto?.length ?? 0,
  };
}

// ── Main import function ──────────────────────────────────────────────────────

export async function importData(
  payload: ImportPayload,
  companyId: string,
  userId: string,
  onProgress?: ProgressCallback
): Promise<ImportSummary> {
  const results: TableResult[] = [];

  // ── Step 1: Update current company metadata ──────────────────────────────
  if (payload.company) {
    // Keep only columns that exist in the current schema
    const COMPANY_ALLOWED = ["name", "cnpj"] as const;
    const companyData: Record<string, unknown> = {};
    for (const key of COMPANY_ALLOWED) {
      if (key in payload.company) companyData[key] = payload.company[key];
    }

    const { error } = await supabase
      .from("companies")
      .update({ ...companyData, owner_id: userId, updated_at: new Date().toISOString() })
      .eq("id", companyId);

    results.push({
      table: "companies",
      label: "Empresa",
      total: 1,
      success: error ? 0 : 1,
      skipped: 0,
      errors: error ? [{ id: companyId, error: error.message }] : [],
    });
    onProgress?.("companies", 1, 1);
  }

  // ── Step 2: Projects ─────────────────────────────────────────────────────
  const projects = normalizeRecords(payload.projects ?? [], companyId, userId);
  results.push(await importTable("projects", "Obras / Projetos", projects, onProgress));

  // ── Step 3: Diary entries ────────────────────────────────────────────────
  const diaryEntries = normalizeRecords(
    payload.diary_entries ?? [],
    companyId,
    userId,
    ["author_id"]
  );
  results.push(await importTable("diary_entries", "Diário de Obra", diaryEntries, onProgress));

  // ── Step 4: Contracts ────────────────────────────────────────────────────
  const contracts = normalizeRecords(payload.contracts ?? [], companyId, userId);
  results.push(await importTable("contracts", "Contratos", contracts, onProgress));

  // ── Step 5: Bids ─────────────────────────────────────────────────────────
  const bids = normalizeRecords(payload.bids ?? [], companyId, userId);
  results.push(await importTable("bids", "Licitações", bids, onProgress));

  // ── Step 6: Alerts ───────────────────────────────────────────────────────
  const alerts = normalizeRecords(payload.alerts ?? [], companyId, userId, ["user_id"]);
  results.push(await importTable("alerts", "Alertas", alerts, onProgress));

  // ── Step 7: RDO Dia ──────────────────────────────────────────────────────
  const rdoDia = normalizeRecords(payload.rdo_dia ?? [], companyId, userId, ["criado_por"]);
  results.push(await importTable("rdo_dia", "RDO — Dias", rdoDia, onProgress));

  // ── Step 8: rdo_despesa_item — must come before financial_records ─────────
  // Strip 'valor_total': it is a GENERATED ALWAYS column and cannot be inserted.
  const rdoDespesaItem = normalizeRecords(
    (payload.rdo_despesa_item ?? []).map(({ valor_total: _vt, ...rest }) => rest),
    companyId,
    userId,
    ["created_by"]
  );
  results.push(await importTable("rdo_despesa_item", "RDO — Despesas", rdoDespesaItem, onProgress));

  // ── Step 9: Financial records (after rdo_despesa_item) ───────────────────
  // Collect successfully imported rdo_despesa_item IDs to avoid FK violations.
  const importedDespesaIds = new Set(
    rdoDespesaItem.map((r) => r.id as string)
  );
  const financialRecords = normalizeRecords(
    (payload.financial_records ?? []).map((r) => ({
      ...r,
      // Null out the FK if the referenced despesa wasn't imported
      rdo_despesa_item_id:
        r.rdo_despesa_item_id && importedDespesaIds.has(r.rdo_despesa_item_id as string)
          ? r.rdo_despesa_item_id
          : null,
    })),
    companyId,
    userId
  );
  results.push(await importTable("financial_records", "Registros Financeiros", financialRecords, onProgress));

  // ── Step 10: Remaining RDO sub-tables (parallel) ─────────────────────────
  const rdoAtividade = normalizeRecords(payload.rdo_atividade ?? [], companyId, userId);
  const rdoMaterial = normalizeRecords(payload.rdo_material ?? [], companyId, userId);
  const rdoOcorrencia = normalizeRecords(payload.rdo_ocorrencia ?? [], companyId, userId);
  // rdo_foto: import metadata/URLs only — strip any raw binary "data" field
  const rdoFoto = normalizeRecords(
    (payload.rdo_foto ?? []).map((r) => {
      const { data: _data, base64: _b64, binary: _bin, ...rest } = r as Record<string, unknown>;
      return rest;
    }),
    companyId,
    userId,
    ["uploaded_by"]
  );

  const parallelResults = await Promise.all([
    importTable("rdo_atividade", "RDO — Atividades", rdoAtividade, onProgress),
    importTable("rdo_material", "RDO — Materiais", rdoMaterial, onProgress),
    importTable("rdo_ocorrencia", "RDO — Ocorrências", rdoOcorrencia, onProgress),
    importTable("rdo_foto", "RDO — Fotos (metadados)", rdoFoto, onProgress),
  ]);
  results.push(...parallelResults);

  const totalSuccess = results.reduce((acc, r) => acc + r.success, 0);
  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0);

  return { results, totalSuccess, totalErrors };
}
