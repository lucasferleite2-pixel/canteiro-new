import { SupabaseClient } from "@supabase/supabase-js";

const RECEITAS = [
  "Medição de Obra",
  "Adiantamento de Contrato",
  "Retenção Liberada",
  "Outros Recebimentos",
];

const DESPESAS = [
  "Mão de Obra",
  "Materiais",
  "Equipamentos",
  "Subcontratados",
  "Administrativo",
  "Impostos",
  "Outros",
];

export async function seedDefaultCategories(
  supabase: SupabaseClient,
  companyId: string
): Promise<void> {
  const { count } = await (supabase as any)
    .from("categorias_financeiras")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if ((count ?? 0) > 0) return;

  const rows = [
    ...RECEITAS.map((nome) => ({ nome, tipo: "receita", company_id: companyId })),
    ...DESPESAS.map((nome) => ({ nome, tipo: "despesa", company_id: companyId })),
  ];

  await (supabase as any).from("categorias_financeiras").insert(rows);
}
