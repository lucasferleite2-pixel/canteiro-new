import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HardHat, Loader2, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

type View = "login" | "register" | "forgot";

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const inputClass = "pl-9 h-11 rounded-xl text-sm text-white border-0 focus-visible:ring-0";

const labelClass = "text-xs font-medium text-white/60 uppercase tracking-wide";

export default function Auth() {
  const [view, setView]           = useState<View>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [name, setName]           = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const { user, signIn, signUp } = useAuth();

  if (user) return <Navigate to="/" replace />;

  // ── Login / Register ──────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (view === "login") {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("Erro ao entrar", {
          description:
            error.message === "Invalid login credentials"
              ? "Email ou senha incorretos."
              : error.message,
        });
      }
    } else {
      if (!name.trim()) {
        toast.error("Informe seu nome completo.");
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, name);
      if (error) {
        toast.error("Erro ao cadastrar", { description: error.message });
      } else {
        toast.success("Conta criada!", {
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    }
    setSubmitting(false);
  };

  // ── Forgot password ───────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao enviar email", { description: error.message });
    } else {
      toast.success("Email enviado!", {
        description: "Verifique seu email para redefinir a senha.",
      });
      setForgotEmail("");
      setView("login");
    }
  };

  const subtitle: Record<View, string> = {
    login:    "Acesse sua conta",
    register: "Crie sua conta",
    forgot:   "Recuperar senha",
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.12) 0%, transparent 55%), " +
          "radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.09) 0%, transparent 55%), " +
          "linear-gradient(145deg, #020817 0%, #0d1526 50%, #020617 100%)",
      }}
    >
      {/* Ambient orbs */}
      <div
        className="pointer-events-none fixed top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20 animate-float"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)", filter: "blur(40px)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-15 animate-float"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)", filter: "blur(40px)", animationDelay: "2s" }}
        aria-hidden="true"
      />

      {/* Glass card */}
      <div
        className="w-full max-w-md animate-glass-fade-in"
        style={{
          background: "rgba(255,255,255,0.055)",
          backdropFilter: "blur(64px) saturate(200%)",
          WebkitBackdropFilter: "blur(64px) saturate(200%)",
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: "1.75rem",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.65), " +
            "inset 0 1px 0 rgba(255,255,255,0.12), " +
            "inset 0 -1px 0 rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-5">
            <div
              className="rounded-2xl p-3.5 animate-glow-pulse"
              style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.20) 0%, rgba(139,92,246,0.15) 100%)",
                border: "1px solid rgba(59,130,246,0.35)",
                boxShadow: "0 0 32px rgba(59,130,246,0.20)",
              }}
            >
              <HardHat className="h-8 w-8 text-blue-400" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">ERP Obra Inteligente</h1>
          <p className="mt-1.5 text-sm text-white/45">{subtitle[view]}</p>
        </div>

        {/* Divider */}
        <div className="mx-8 h-px" style={{ background: "rgba(255,255,255,0.07)" }} aria-hidden="true" />

        {/* Forms */}
        <div className="px-8 py-6">

          {/* ── Login / Register ── */}
          {view !== "forgot" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className={labelClass}>Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" aria-hidden="true" />
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelClass}>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className={labelClass}>Senha</Label>
                  {view === "login" && (
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(email); setView("forgot"); }}
                      className="text-[11px] text-blue-400/70 hover:text-blue-300 transition-colors duration-150 cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" aria-hidden="true" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              <Button
                className="w-full h-11 rounded-xl text-sm font-semibold mt-2 cursor-pointer"
                type="submit"
                disabled={submitting}
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.75) 0%, rgba(99,102,241,0.70) 100%)",
                  border: "1px solid rgba(99,130,246,0.50)",
                  boxShadow: "0 4px 20px rgba(59,130,246,0.30), inset 0 1px 0 rgba(255,255,255,0.15)",
                  color: "white",
                }}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {view === "login" ? "Entrar" : "Criar Conta"}
              </Button>

              <p className="text-center text-xs text-white/40 pt-1">
                {view === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button
                  type="button"
                  className="text-blue-400 hover:text-blue-300 transition-colors duration-150 cursor-pointer font-medium"
                  onClick={() => setView(view === "login" ? "register" : "login")}
                >
                  {view === "login" ? "Cadastre-se" : "Faça login"}
                </button>
              </p>
            </form>
          )}

          {/* ── Forgot password ── */}
          {view === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-white/50 leading-relaxed">
                Informe o email da sua conta. Enviaremos um link para você redefinir a senha.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className={labelClass}>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" aria-hidden="true" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              <Button
                className="w-full h-11 rounded-xl text-sm font-semibold cursor-pointer"
                type="submit"
                disabled={submitting}
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.75) 0%, rgba(99,102,241,0.70) 100%)",
                  border: "1px solid rgba(99,130,246,0.50)",
                  boxShadow: "0 4px 20px rgba(59,130,246,0.30), inset 0 1px 0 rgba(255,255,255,0.15)",
                  color: "white",
                }}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link de recuperação
              </Button>

              <button
                type="button"
                onClick={() => setView("login")}
                className="flex items-center gap-1.5 mx-auto text-xs text-white/40 hover:text-white/70 transition-colors duration-150 cursor-pointer pt-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar ao login
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
