import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  CalendarDays,
  DollarSign,
  FileText,
  Bell,
  MoreHorizontal,
  X,
  BarChart3,
  Target,
  CheckSquare,
  Package,
  FolderOpen,
  Gavel,
  Calculator,
  Ruler,
  ShoppingCart,
  TrendingUp,
  Globe,
  Shield,
  FileBarChart,
  Users,
  Upload,
  Settings,
} from "lucide-react";

const dockItems = [
  { title: "Dashboard",  url: "/",           icon: LayoutDashboard },
  { title: "Obras",      url: "/obras",       icon: Building2 },
  { title: "Diário",     url: "/diario",      icon: ClipboardList },
  { title: "Cronograma", url: "/cronograma",  icon: CalendarDays },
  { title: "Financeiro", url: "/financeiro",  icon: DollarSign },
  { title: "Contratos",  url: "/contratos",   icon: FileText },
  { title: "Alertas",    url: "/alertas",     icon: Bell },
];

const moreGroups = [
  {
    group: "Gestão",
    items: [
      { title: "Comparativo",  url: "/comparativo",  icon: BarChart3 },
      { title: "Planejamento", url: "/planejamento",  icon: Target },
      { title: "Tarefas",      url: "/tarefas",       icon: CheckSquare },
    ],
  },
  {
    group: "Projetos",
    items: [
      { title: "Biblioteca",   url: "/biblioteca",    icon: Package },
      { title: "Arquivos",     url: "/arquivos",      icon: FolderOpen },
      { title: "Orçamento",    url: "/orcamento",     icon: Calculator },
      { title: "Medições",     url: "/medicoes",      icon: Ruler },
    ],
  },
  {
    group: "Controle",
    items: [
      { title: "Licitações",   url: "/licitacoes",    icon: Gavel },
      { title: "Compras",      url: "/compras",       icon: ShoppingCart },
    ],
  },
  {
    group: "Vendas & Clientes",
    items: [
      { title: "Funil de Vendas", url: "/crm",           icon: TrendingUp },
      { title: "Portal Cliente",  url: "/portal-config", icon: Globe },
    ],
  },
  {
    group: "Sistema",
    items: [
      { title: "Auditoria RDO",  url: "/auditoria",      icon: Shield },
      { title: "Relatórios",     url: "/relatorios",     icon: FileBarChart },
      { title: "Usuários",       url: "/usuarios",       icon: Users },
      { title: "Importar Dados", url: "/importar-dados", icon: Upload },
      { title: "Empresa",        url: "/empresa/config", icon: Settings },
    ],
  },
];

export function AppDock() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const allMoreUrls = moreGroups.flatMap((g) => g.items.map((i) => i.url));
  const moreIsActive = allMoreUrls.some((url) => location.pathname.startsWith(url));

  return (
    <>
      {/* ── More overlay panel ──────────────────────────── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowMore(false)}
          />

          {/* Panel */}
          <div
            className="fixed bottom-28 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4 animate-more-panel"
            role="navigation"
            aria-label="More navigation"
          >
            <div
              className="rounded-3xl p-5 overflow-y-auto max-h-[60vh]"
              style={{
                background: "rgba(8, 14, 30, 0.82)",
                backdropFilter: "blur(64px) saturate(200%)",
                WebkitBackdropFilter: "blur(64px) saturate(200%)",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  Mais
                </span>
                <button
                  onClick={() => setShowMore(false)}
                  className="rounded-full p-1.5 cursor-pointer transition-all duration-150"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                  aria-label="Fechar menu"
                >
                  <X className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>

              {moreGroups.map((group) => (
                <div key={group.group} className="mb-4 last:mb-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2 px-1">
                    {group.group}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {group.items.map((item) => {
                      const active = isActive(item.url);
                      return (
                        <Link
                          key={item.url}
                          to={item.url}
                          onClick={() => setShowMore(false)}
                          className="flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all duration-200 cursor-pointer"
                          style={{
                            background: active
                              ? "rgba(59,130,246,0.18)"
                              : "rgba(255,255,255,0.04)",
                            border: `1px solid ${active ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.07)"}`,
                            boxShadow: active ? "0 0 14px rgba(59,130,246,0.25)" : "none",
                          }}
                          aria-current={active ? "page" : undefined}
                        >
                          <item.icon
                            className="h-5 w-5"
                            style={{ color: active ? "rgb(96,165,250)" : "rgba(255,255,255,0.65)" }}
                            aria-hidden="true"
                          />
                          <span
                            className="text-[10px] font-medium text-center leading-tight"
                            style={{ color: active ? "rgb(147,197,253)" : "rgba(255,255,255,0.55)" }}
                          >
                            {item.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Dock ────────────────────────────────────────── */}
      <nav
        className="fixed bottom-5 left-1/2 z-50 animate-dock-in"
        style={{ transform: showMore ? "translateX(-50%)" : undefined }}
        aria-label="Main navigation dock"
      >
        <div
          className="flex items-center gap-1 px-3 py-2"
          style={{
            background: "rgba(10, 16, 32, 0.72)",
            backdropFilter: "blur(48px) saturate(200%)",
            WebkitBackdropFilter: "blur(48px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "9999px",
            boxShadow:
              "0 16px 64px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          {dockItems.map((item) => {
            const active = isActive(item.url);
            return (
              <DockItem
                key={item.url}
                to={item.url}
                icon={item.icon}
                label={item.title}
                active={active}
              />
            );
          })}

          {/* Separator */}
          <div
            className="w-px self-stretch mx-1"
            style={{ background: "rgba(255,255,255,0.12)" }}
            aria-hidden="true"
          />

          {/* More button */}
          <button
            onClick={() => setShowMore((v) => !v)}
            className="flex flex-col items-center gap-0.5 w-14 h-14 justify-center rounded-full transition-all duration-200 cursor-pointer group"
            style={{
              background: showMore || moreIsActive
                ? "rgba(59,130,246,0.20)"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${showMore || moreIsActive ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.08)"}`,
              boxShadow: showMore || moreIsActive ? "0 0 16px rgba(59,130,246,0.35)" : "none",
            }}
            aria-label="Mais opções de navegação"
            aria-expanded={showMore}
          >
            <MoreHorizontal
              className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
              style={{
                color: showMore || moreIsActive ? "rgb(96,165,250)" : "rgba(255,255,255,0.60)",
              }}
              aria-hidden="true"
            />
            <span
              className="text-[9px] font-medium"
              style={{
                color: showMore || moreIsActive ? "rgb(147,197,253)" : "rgba(255,255,255,0.40)",
              }}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

interface DockItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}

function DockItem({ to, icon: Icon, label, active }: DockItemProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-0.5 w-14 h-14 justify-center rounded-full transition-all duration-200 cursor-pointer group relative"
      style={{
        background: active ? "rgba(59,130,246,0.20)" : "transparent",
        border: `1px solid ${active ? "rgba(59,130,246,0.45)" : "transparent"}`,
        boxShadow: active ? "0 0 16px rgba(59,130,246,0.35)" : "none",
      }}
      aria-current={active ? "page" : undefined}
    >
      {/* Hover bg */}
      <span
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: "rgba(255,255,255,0.07)" }}
        aria-hidden="true"
      />

      {/* Active dot */}
      {active && (
        <span
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{ background: "rgb(96,165,250)", boxShadow: "0 0 6px rgba(59,130,246,0.8)" }}
          aria-hidden="true"
        />
      )}

      <Icon
        className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5 relative z-10"
        style={{ color: active ? "rgb(96,165,250)" : "rgba(255,255,255,0.65)" }}
        aria-hidden="true"
      />
      <span
        className="text-[9px] font-medium relative z-10"
        style={{ color: active ? "rgb(147,197,253)" : "rgba(255,255,255,0.42)" }}
      >
        {label}
      </span>
    </Link>
  );
}
