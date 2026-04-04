import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, ShieldAlert, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertItem {
  id: string;
  title: string;
  message: string | null;
  severity: string;
  created_at: string;
  project_name?: string;
}

const severityConfig: Record<string, { icon: typeof AlertTriangle; iconColor: string; bg: string; borderColor: string; label: string }> = {
  critical: { icon: ShieldAlert, iconColor: "rgb(248,113,113)", bg: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", label: "Crítico" },
  high:     { icon: AlertTriangle, iconColor: "rgb(248,113,113)", bg: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.22)", label: "Alto" },
  warning:  { icon: AlertTriangle, iconColor: "rgb(251,191,36)", bg: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.22)", label: "Atenção" },
  info:     { icon: Info, iconColor: "rgb(56,189,248)", bg: "rgba(14,165,233,0.12)", borderColor: "rgba(14,165,233,0.22)", label: "Info" },
};

export function DashboardAlerts({ alerts }: { alerts: AlertItem[] }) {
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/85 flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: "rgb(251,191,36)" }} aria-hidden="true" />
            Alertas Pendentes
          </h3>
          {alerts.length > 0 && (
            <Badge
              className="text-xs px-2 py-0.5"
              style={{
                background: "rgba(239,68,68,0.18)",
                border: "1px solid rgba(239,68,68,0.30)",
                color: "rgb(248,113,113)",
              }}
            >
              {alerts.length}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <Bell className="h-8 w-8 mb-2 text-white/15" aria-hidden="true" />
            <p className="text-sm text-white/35">Nenhum alerta pendente.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const sev = severityConfig[alert.severity] || severityConfig.info;
              const Icon = sev.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-xl transition-all duration-150"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${sev.borderColor}`,
                  }}
                >
                  <div
                    className="rounded-xl p-1.5 mt-0.5 shrink-0"
                    style={{ background: sev.bg, border: `1px solid ${sev.borderColor}` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: sev.iconColor }} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{alert.title}</p>
                    {alert.message && (
                      <p className="text-xs text-white/45 mt-0.5 line-clamp-2">{alert.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {alert.project_name && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
                        >
                          {alert.project_name}
                        </span>
                      )}
                      <span className="text-[10px] text-white/30">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
