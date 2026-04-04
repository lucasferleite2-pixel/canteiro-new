import { Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function DemoBanner() {
  const { isDemo } = useAuth();
  if (!isDemo) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      role="alert"
      style={{
        background: "rgba(245,158,11,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(245,158,11,0.22)",
        boxShadow: "0 4px 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="rounded-xl p-1.5 shrink-0"
        style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}
      >
        <Eye className="h-4 w-4" style={{ color: "rgb(251,191,36)" }} aria-hidden="true" />
      </div>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
        Você está no{" "}
        <strong style={{ color: "rgb(251,191,36)" }}>modo demonstração</strong>
        {" "}— os dados exibidos são fictícios e servem apenas para apresentação.
      </p>
    </div>
  );
}
