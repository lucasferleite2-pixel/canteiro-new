import { useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Bell, LogOut, HardHat } from "lucide-react";
import { AppDock } from "@/components/AppDock";
import { supabase } from "@/integrations/supabase/client";
import { startSyncService } from "@/lib/photoSyncService";

export function AppLayout() {
  const { profile, companyId, signOut, user } = useAuth();

  useEffect(() => {
    if (user) {
      startSyncService(supabase, user.id);
    }
  }, [user]);

  if (user && !companyId && profile) {
    return <Navigate to="/empresa" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* ── Floating glass top bar ──────────────────── */}
      <header
        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full animate-glass-fade-in"
        style={{
          background: "rgba(10, 16, 32, 0.68)",
          backdropFilter: "blur(48px) saturate(180%)",
          WebkitBackdropFilter: "blur(48px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09)",
        }}
      >
        {/* Logo mark */}
        <div
          className="flex items-center gap-2 mr-2 pr-3"
          style={{ borderRight: "1px solid rgba(255,255,255,0.10)" }}
        >
          <div
            className="rounded-xl p-1"
            style={{
              background: "rgba(59,130,246,0.18)",
              border: "1px solid rgba(59,130,246,0.30)",
              boxShadow: "0 0 10px rgba(59,130,246,0.20)",
            }}
          >
            <HardHat className="h-4 w-4 text-blue-400" aria-hidden="true" />
          </div>
          <span className="text-xs font-semibold text-white/80 hidden sm:inline tracking-tight">
            ERP Obra Inteligente
          </span>
        </div>

        {/* User name */}
        <span className="text-xs text-white/50 hidden sm:inline max-w-[140px] truncate">
          {profile?.full_name || profile?.email || ""}
        </span>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer group"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
          aria-label="Notificações"
        >
          <span
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: "rgba(255,255,255,0.07)" }}
            aria-hidden="true"
          />
          <Bell className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer group"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
          aria-label="Sair"
        >
          <span
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: "rgba(239,68,68,0.12)" }}
            aria-hidden="true"
          />
          <LogOut className="h-3.5 w-3.5 text-white/60 group-hover:text-red-400 transition-colors duration-200" aria-hidden="true" />
        </button>
      </header>

      {/* ── Main content ────────────────────────────── */}
      <main
        className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-8 pb-32 animate-glass-fade-in"
        style={{ animationDelay: "0.05s" }}
      >
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ── Floating bottom dock ─────────────────── */}
      <AppDock />
    </div>
  );
}
