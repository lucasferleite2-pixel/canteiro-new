import { DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface FinancialByProject {
  name: string;
  receita: number;
  despesa: number;
}

export function DashboardFinancialChart({ data }: { data: FinancialByProject[] }) {
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
          <DollarSign className="h-4 w-4 text-blue-400" aria-hidden="true" />
          Receitas vs Despesas por Obra
        </h3>
      </div>

      <div className="px-5 py-4">
        {data.length === 0 ? (
          <p className="text-sm text-white/35 py-6 text-center">Sem registros financeiros.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barGap={2}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.40)" }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 14,
                  background: "rgba(10,16,32,0.92)",
                  backdropFilter: "blur(40px)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                  color: "rgba(255,255,255,0.85)",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.55)", marginBottom: 4 }}
                itemStyle={{ color: "rgba(255,255,255,0.75)" }}
                formatter={(v: number, name: string) => [formatCurrency(v), name === "receita" ? "Receita" : "Despesa"]}
              />
              <Legend
                formatter={(value) => (value === "receita" ? "Receita" : "Despesa")}
                wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.50)" }}
              />
              <Bar dataKey="receita" fill="rgba(74,222,128,0.75)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="despesa" fill="rgba(248,113,113,0.75)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
