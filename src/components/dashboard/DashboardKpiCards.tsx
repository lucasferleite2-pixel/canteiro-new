import { Building2, ClipboardList, AlertTriangle, DollarSign, TrendingUp, HardHat } from "lucide-react";

interface KpiData {
  activeProjects: number;
  totalProjects: number;
  diaryToday: number;
  unreadAlerts: number;
  totalBudget: number;
  totalRevenue: number;
  totalExpense: number;
  avgProductivity: number;
}

export function DashboardKpiCards({ data }: { data: KpiData }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

  const balance = data.totalRevenue - data.totalExpense;

  const cards = [
    {
      label: "Obras Ativas",
      value: `${data.activeProjects}/${data.totalProjects}`,
      icon: Building2,
      glowColor: "rgba(59,130,246,0.35)",
      iconBg: "rgba(59,130,246,0.15)",
      iconColor: "rgb(96,165,250)",
      borderColor: "rgba(59,130,246,0.25)",
    },
    {
      label: "Alertas Pendentes",
      value: String(data.unreadAlerts),
      icon: AlertTriangle,
      glowColor: data.unreadAlerts > 0 ? "rgba(239,68,68,0.30)" : "rgba(34,197,94,0.30)",
      iconBg: data.unreadAlerts > 0 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
      iconColor: data.unreadAlerts > 0 ? "rgb(248,113,113)" : "rgb(74,222,128)",
      borderColor: data.unreadAlerts > 0 ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.22)",
    },
    {
      label: "Registros Hoje",
      value: String(data.diaryToday),
      icon: ClipboardList,
      glowColor: "rgba(14,165,233,0.30)",
      iconBg: "rgba(14,165,233,0.12)",
      iconColor: "rgb(56,189,248)",
      borderColor: "rgba(14,165,233,0.22)",
    },
    {
      label: "Orçamento Total",
      value: formatCurrency(data.totalBudget),
      icon: DollarSign,
      glowColor: "rgba(59,130,246,0.30)",
      iconBg: "rgba(59,130,246,0.12)",
      iconColor: "rgb(96,165,250)",
      borderColor: "rgba(59,130,246,0.22)",
    },
    {
      label: "Saldo Financeiro",
      value: formatCurrency(balance),
      icon: TrendingUp,
      glowColor: balance >= 0 ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)",
      iconBg: balance >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
      iconColor: balance >= 0 ? "rgb(74,222,128)" : "rgb(248,113,113)",
      borderColor: balance >= 0 ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)",
    },
    {
      label: "Produtividade Média",
      value: `${data.avgProductivity}%`,
      icon: HardHat,
      glowColor:
        data.avgProductivity >= 70 ? "rgba(34,197,94,0.30)" :
        data.avgProductivity >= 50 ? "rgba(245,158,11,0.30)" :
        "rgba(239,68,68,0.30)",
      iconBg:
        data.avgProductivity >= 70 ? "rgba(34,197,94,0.12)" :
        data.avgProductivity >= 50 ? "rgba(245,158,11,0.12)" :
        "rgba(239,68,68,0.12)",
      iconColor:
        data.avgProductivity >= 70 ? "rgb(74,222,128)" :
        data.avgProductivity >= 50 ? "rgb(251,191,36)" :
        "rgb(248,113,113)",
      borderColor:
        data.avgProductivity >= 70 ? "rgba(34,197,94,0.22)" :
        data.avgProductivity >= 50 ? "rgba(245,158,11,0.22)" :
        "rgba(239,68,68,0.22)",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-2xl p-4 transition-all duration-250 cursor-default"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(40px) saturate(160%)",
            WebkitBackdropFilter: "blur(40px) saturate(160%)",
            border: `1px solid ${c.borderColor}`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)`,
            animationDelay: `${i * 0.06}s`,
          }}
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute -top-4 -right-4 w-16 h-16 rounded-full"
            style={{
              background: `radial-gradient(circle, ${c.glowColor} 0%, transparent 70%)`,
              filter: "blur(12px)",
            }}
            aria-hidden="true"
          />

          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium text-white/45 uppercase tracking-wide leading-tight">
              {c.label}
            </p>
            <div
              className="rounded-xl p-1.5"
              style={{ background: c.iconBg, border: `1px solid ${c.borderColor}` }}
            >
              <c.icon className="h-3.5 w-3.5" style={{ color: c.iconColor }} aria-hidden="true" />
            </div>
          </div>

          <p
            className="text-xl font-bold tracking-tight"
            style={{ color: c.iconColor }}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
