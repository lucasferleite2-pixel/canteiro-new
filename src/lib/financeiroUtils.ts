export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

export function calcularSaldoCorrido(
  lancamentos: Array<{ date: string; amount: number; type: string; status: string }>,
  saldoInicial: number
): { date: string; saldo: number }[] {
  const sorted = [...lancamentos]
    .filter((l) => l.status === "realizado")
    .sort((a, b) => a.date.localeCompare(b.date));

  let saldo = saldoInicial;
  const result: { date: string; saldo: number }[] = [];

  for (const l of sorted) {
    saldo += l.type === "income" ? l.amount : -l.amount;
    result.push({ date: l.date, saldo });
  }

  return result;
}

export function agruparPorCategoria(
  lancamentos: Array<{ categoria?: string | null; amount: number; type: string }>
): { categoria: string; total: number; percentual: number }[] {
  const totals: Record<string, number> = {};
  let grand = 0;

  for (const l of lancamentos) {
    const cat = l.categoria || "Sem categoria";
    totals[cat] = (totals[cat] || 0) + l.amount;
    grand += l.amount;
  }

  return Object.entries(totals).map(([categoria, total]) => ({
    categoria,
    total,
    percentual: grand > 0 ? (total / grand) * 100 : 0,
  }));
}

export function gerarDRE(
  lancamentos: Array<{ amount: number; type: string; status: string }>
): { receitas: number; despesas: number; resultado: number; margem: number } {
  const realizados = lancamentos.filter((l) => l.status === "realizado");
  const receitas = realizados.filter((l) => l.type === "income").reduce((s, l) => s + l.amount, 0);
  const despesas = realizados.filter((l) => l.type === "expense").reduce((s, l) => s + l.amount, 0);
  const resultado = receitas - despesas;
  const margem = receitas > 0 ? (resultado / receitas) * 100 : 0;
  return { receitas, despesas, resultado, margem };
}
