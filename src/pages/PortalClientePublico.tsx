import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, HardHat, AlertCircle } from "lucide-react";

export default function PortalClientePublico() {
  const { token } = useParams<{ token: string }>();

  const { data: share, isLoading: shareLoading } = useQuery({
    queryKey: ["portal_share", token],
    queryFn: async () => {
      if (!token) return null;
      const { data } = await supabase.from("client_portal_shares").select("*, projects(id, name, company_id)").eq("access_token", token).maybeSingle();
      return data;
    },
    enabled: !!token,
  });

  const recordAccess = useMutation({
    mutationFn: async () => {
      if (!share?.id) return;
      await supabase.from("client_portal_shares").update({ last_accessed_at: new Date().toISOString() }).eq("id", share.id);
    },
  });

  useEffect(() => {
    if (share?.id) recordAccess.mutate();
  }, [share?.id]);

  const isExpired = share?.expires_at && new Date(share.expires_at) < new Date();
  const isValid = share && share.is_active && !isExpired;
  const permissions = share?.permissions || {};
  const project = (share as any)?.projects;

  const { data: phases = [] } = useQuery({
    queryKey: ["portal_phases", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data } = await supabase.from("project_phases").select("*").eq("project_id", project.id).order("order_index");
      return data || [];
    },
    enabled: !!project?.id && !!permissions.cronograma,
  });

  const { data: fotos = [] } = useQuery({
    queryKey: ["portal_fotos", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data } = await supabase.from("rdo_dia").select("id, data, foto_urls").eq("obra_id", project.id).order("data", { ascending: false }).limit(20);
      return (data || []).flatMap((r: any) => (r.foto_urls || []).map((url: string) => ({ url, data: r.data })));
    },
    enabled: !!project?.id && !!permissions.fotos,
  });

  const { data: financeiro = [] } = useQuery({
    queryKey: ["portal_financeiro", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data } = await supabase.from("financial_records").select("amount, type, description, due_date").eq("project_id", project.id).order("due_date");
      return data || [];
    },
    enabled: !!project?.id && !!permissions.financeiro,
  });

  const { data: arquivos = [] } = useQuery({
    queryKey: ["portal_arquivos", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const { data } = await supabase.from("project_files").select("*").eq("project_id", project.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!project?.id && !!permissions.documentos,
  });

  if (shareLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Link inválido ou expirado</h1>
        <p className="text-muted-foreground max-w-sm">
          {!share ? "Este link não existe." : !share.is_active ? "Este acesso foi desativado." : "Este link expirou."}
        </p>
      </div>
    );
  }

  const totalReceitas = financeiro.filter((f: any) => f.type === "receita" || f.type === "income").reduce((s: number, f: any) => s + Number(f.amount), 0);
  const totalDespesas = financeiro.filter((f: any) => f.type === "despesa" || f.type === "expense").reduce((s: number, f: any) => s + Number(f.amount), 0);

  const tabs = [
    permissions.cronograma && { id: "cronograma", label: "Cronograma" },
    permissions.fotos && { id: "fotos", label: "Fotos" },
    permissions.financeiro && { id: "financeiro", label: "Financeiro" },
    permissions.documentos && { id: "documentos", label: "Documentos" },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <HardHat className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-bold text-lg">ERP Obra Inteligente</h1>
            <p className="text-sm text-muted-foreground">{project?.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <Tabs defaultValue={tabs[0]?.id}>
          <TabsList>
            {tabs.map(t => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
          </TabsList>

          {permissions.cronograma && (
            <TabsContent value="cronograma" className="space-y-4 mt-4">
              {phases.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma fase cadastrada.</p>
              ) : phases.map((p: any) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant={p.status === "completed" ? "outline" : p.status === "delayed" ? "destructive" : "default"}>
                        {p.status === "pending" ? "Pendente" : p.status === "in_progress" ? "Em andamento" : p.status === "completed" ? "Concluída" : "Atrasada"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso</span><span>{p.progress_percent}%</span>
                      </div>
                      <Progress value={p.progress_percent} className="h-2" />
                    </div>
                    {(p.start_date || p.end_date) && (
                      <p className="text-xs text-muted-foreground mt-2">{p.start_date} — {p.end_date}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {permissions.fotos && (
            <TabsContent value="fotos" className="mt-4">
              {fotos.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma foto disponível.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fotos.map((f: any, i: number) => (
                    <div key={i} className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <img src={f.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {permissions.financeiro && (
            <TabsContent value="financeiro" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Receitas</p>
                  <p className="text-lg font-bold text-green-600">R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Despesas</p>
                  <p className="text-lg font-bold text-red-600">R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className={`text-lg font-bold ${totalReceitas - totalDespesas >= 0 ? "text-green-600" : "text-red-600"}`}>
                    R$ {(totalReceitas - totalDespesas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent></Card>
              </div>
            </TabsContent>
          )}

          {permissions.documentos && (
            <TabsContent value="documentos" className="space-y-3 mt-4">
              {arquivos.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum documento disponível.</p>
              ) : arquivos.map((f: any) => (
                <Card key={f.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.category} · {new Date(f.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex-shrink-0">
                      Download
                    </a>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
