import { Building2 } from "lucide-react";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  rdo_count: number;
  avg_productivity: number;
  last_rdo_date: string | null;
  risk_score: string;
}

const statusConfig: Record<string, { label: string; bg: string; color: string; border: string }> = {
  planning:    { label: "Planejamento", bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", border: "rgba(255,255,255,0.12)" },
  in_progress: { label: "Em Andamento", bg: "rgba(59,130,246,0.15)", color: "rgb(96,165,250)",        border: "rgba(59,130,246,0.30)" },
  paused:      { label: "Pausada",      bg: "rgba(239,68,68,0.12)",  color: "rgb(248,113,113)",       border: "rgba(239,68,68,0.25)" },
  completed:   { label: "Concluída",    bg: "rgba(34,197,94,0.12)",  color: "rgb(74,222,128)",        border: "rgba(34,197,94,0.25)" },
};

const riskConfig: Record<string, { label: string; bg: string; color: string; border: string }> = {
  alto:  { label: "Alto",  bg: "rgba(239,68,68,0.12)",  color: "rgb(248,113,113)", border: "rgba(239,68,68,0.28)" },
  medio: { label: "Médio", bg: "rgba(245,158,11,0.12)", color: "rgb(251,191,36)",  border: "rgba(245,158,11,0.28)" },
  baixo: { label: "Baixo", bg: "rgba(34,197,94,0.12)",  color: "rgb(74,222,128)",  border: "rgba(34,197,94,0.28)" },
};

export function DashboardProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(40px) saturate(160%)",
        WebkitBackdropFilter: "blur(40px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="text-sm font-semibold text-white/85 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
          Resumo por Obra
        </h3>
      </div>

      <div className="px-5 py-4">
        {projects.length === 0 ? (
          <p className="text-sm text-white/35 py-4">Nenhuma obra cadastrada.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Obra", "Status", "Orçamento", "RDOs", "Produtividade", "Risco"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-2 text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const st = statusConfig[p.status] || statusConfig.planning;
                  const risk = riskConfig[p.risk_score] || riskConfig.baixo;
                  const prodColor =
                    p.avg_productivity >= 70 ? "rgb(74,222,128)" :
                    p.avg_productivity >= 50 ? "rgb(251,191,36)" :
                    "rgb(248,113,113)";
                  const prodBg =
                    p.avg_productivity >= 70 ? "rgba(34,197,94,0.35)" :
                    p.avg_productivity >= 50 ? "rgba(245,158,11,0.35)" :
                    "rgba(239,68,68,0.35)";

                  return (
                    <tr
                      key={p.id}
                      className="transition-all duration-150 group"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td className="py-2.5 px-2">
                        <span className="font-medium text-white/80 max-w-[180px] truncate block group-hover:text-white transition-colors duration-150">
                          {p.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-white/60">
                        {formatCurrency(p.budget || 0)}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-white/60">
                        {p.rdo_count}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {/* Progress bar */}
                          <div
                            className="flex-1 h-1.5 rounded-full overflow-hidden"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(p.avg_productivity, 100)}%`,
                                background: `linear-gradient(90deg, ${prodBg}, ${prodColor})`,
                                boxShadow: `0 0 6px ${prodColor}55`,
                              }}
                            />
                          </div>
                          <span
                            className="text-xs tabular-nums w-8 text-right font-medium"
                            style={{ color: prodColor }}
                          >
                            {p.avg_productivity}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium"
                          style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}
                        >
                          {risk.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
