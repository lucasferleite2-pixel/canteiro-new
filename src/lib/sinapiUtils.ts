export type SinapiComposicao = {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  custo_total: number;
  custo_mao_obra: number | null;
  custo_material: number | null;
  custo_equipamento: number | null;
  estado: string;
  mes_referencia: string;
  ano_referencia: number;
  tipo: string | null;
  onerado: boolean | null;
};

export type OrcamentoItem = {
  id?: string;
  project_id?: string;
  company_id?: string;
  fase?: string | null;
  codigo?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total?: number;
  bdi?: number;
  preco_total_com_bdi?: number;
  origem?: string;
};

export type ParsedOrcamentoRow = {
  fase?: string;
  codigo?: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  bdi?: number;
};

export async function searchSinapi(
  supabase: any,
  query: string,
  estado: string = "NACIONAL",
  limit: number = 20
): Promise<SinapiComposicao[]> {
  if (!query.trim()) return [];

  const isCode = /^\d/.test(query.trim());

  let q = supabase
    .from("sinapi_composicoes")
    .select("*")
    .eq("estado", estado)
    .limit(limit);

  if (isCode) {
    q = q.ilike("codigo", `${query.trim()}%`);
  } else {
    q = q.ilike("descricao", `%${query.trim()}%`);
  }

  const { data, error } = await q.order("codigo");
  if (error) throw error;
  return (data || []) as SinapiComposicao[];
}

export function calcularTotalOrcamento(itens: OrcamentoItem[]): {
  subtotal: number;
  totalComBdi: number;
  porFase: { fase: string; total: number }[];
  curvaABC: { descricao: string; valor: number; percentual: number; acumulado: number }[];
} {
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const totalComBdi = itens.reduce(
    (s, i) => s + i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100),
    0
  );

  const faseMap: Record<string, number> = {};
  for (const i of itens) {
    const f = i.fase || "Sem fase";
    faseMap[f] = (faseMap[f] || 0) + i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100);
  }
  const porFase = Object.entries(faseMap).map(([fase, total]) => ({ fase, total }));

  const sorted = [...itens]
    .map((i) => ({
      descricao: i.descricao,
      valor: i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100),
    }))
    .sort((a, b) => b.valor - a.valor);

  let acum = 0;
  const curvaABC = sorted.map((item) => {
    const percentual = totalComBdi > 0 ? (item.valor / totalComBdi) * 100 : 0;
    acum += percentual;
    return { descricao: item.descricao, valor: item.valor, percentual, acumulado: acum };
  });

  return { subtotal, totalComBdi, porFase, curvaABC };
}

export async function parseOrcamentoFile(file: File): Promise<ParsedOrcamentoRow[]> {
  const { read, utils } = await import("xlsx");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = utils.sheet_to_json(sheet, { defval: "" });

        const normalize = (key: string) => key.toLowerCase().trim().replace(/\s+/g, "_");

        const parsed: ParsedOrcamentoRow[] = rows
          .map((row) => {
            const n: Record<string, any> = {};
            for (const k of Object.keys(row)) {
              n[normalize(k)] = row[k];
            }

            const descricao =
              String(n["descricao"] || n["description"] || n["desc"] || "").trim();
            const unidade = String(n["unidade"] || n["un"] || n["unit"] || "un").trim();
            const quantidade = parseFloat(String(n["quantidade"] || n["qtd"] || n["qty"] || "1")) || 1;
            const preco_unitario =
              parseFloat(
                String(n["preco_unitario"] || n["preco"] || n["p_unit"] || n["unit_price"] || "0")
                  .replace(",", ".")
              ) || 0;
            const bdi = parseFloat(String(n["bdi"] || n["bdi_percent"] || "0")) || 0;
            const fase = String(n["fase"] || n["phase"] || n["etapa"] || "").trim();
            const codigo = String(n["codigo"] || n["code"] || n["sinapi"] || "").trim();

            if (!descricao) return null;

            return { fase: fase || undefined, codigo: codigo || undefined, descricao, unidade, quantidade, preco_unitario, bdi };
          })
          .filter(Boolean) as ParsedOrcamentoRow[];

        resolve(parsed);
      } catch (err: any) {
        reject(new Error("Erro ao processar arquivo: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
