import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileBarChart, Calculator, DollarSign, HardHat, TrendingUp, Loader2, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ReportId = "orcamento" | "financeiro" | "andamento" | "crm";

const REPORTS = [
  { id: "orcamento" as ReportId, title: "Orçamento", description: "Tabela completa de itens por fase com totais e BDI.", icon: Calculator },
  { id: "financeiro" as ReportId, title: "Financeiro", description: "Receitas x Despesas, saldo por período.", icon: DollarSign },
  { id: "andamento" as ReportId, title: "Andamento de Obras", description: "Resumo de obras ativas: status, % físico, produtividade.", icon: HardHat },
  { id: "crm" as ReportId, title: "CRM / Funil de Vendas", description: "Leads por estágio, conversão, pipeline total.", icon: TrendingUp },
];

export default function Relatorios() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [params, setParams] = useState({ project_id: "", periodo: "month" });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name, status, budget").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const generateOrcamentoPDF = async () => {
    if (!params.project_id) { toast({ variant: "destructive", title: "Selecione um projeto." }); return; }
    const { data: items } = await supabase.from("obra_budget_items").select("*").eq("project_id", params.project_id).order("phase").order("description");
    const project = projects.find((p: any) => p.id === params.project_id);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Relatório de Orçamento — ${project?.name}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    const rows = (items || []).map((i: any) => [
      i.sinapi_code || "", i.description, i.phase || "", i.unit,
      Number(i.quantity).toFixed(2), `R$ ${Number(i.unit_price).toFixed(2)}`,
      `${Number(i.bdi_percent).toFixed(1)}%`,
      `R$ ${Number(i.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["SINAPI", "Descrição", "Fase", "Un", "Qtd", "P.Unit.", "BDI", "Total"]],
      body: rows, styles: { fontSize: 8 }, columnStyles: { 1: { cellWidth: 45 } },
    });
    const total = (items || []).reduce((s: number, i: any) => s + Number(i.total_price || 0), 0);
    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(11);
    doc.text(`Total Geral: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, finalY + 10);
    doc.save(`orcamento-${project?.name}.pdf`);
  };

  const generateFinanceiroPDF = async () => {
    const { data: records } = await supabase.from("financial_records").select("*").eq("company_id", companyId!).order("due_date");
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório Financeiro", 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    const rows = (records || []).map((r: any) => [
      r.description, r.type === "receita" || r.type === "income" ? "Receita" : "Despesa",
      r.category || "", r.due_date || "",
      `R$ ${Number(r.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["Descrição", "Tipo", "Categoria", "Vencimento", "Valor"]],
      body: rows, styles: { fontSize: 9 },
    });
    const totalReceitas = (records || []).filter((r: any) => r.type === "receita" || r.type === "income").reduce((s: number, r: any) => s + Number(r.amount), 0);
    const totalDespesas = (records || []).filter((r: any) => r.type === "despesa" || r.type === "expense").reduce((s: number, r: any) => s + Number(r.amount), 0);
    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(10);
    doc.text(`Receitas: R$ ${totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, finalY + 10);
    doc.text(`Despesas: R$ ${totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, finalY + 18);
    doc.setFontSize(11);
    doc.text(`Saldo: R$ ${(totalReceitas - totalDespesas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, finalY + 28);
    doc.save("relatorio-financeiro.pdf");
  };

  const generateAndamentoPDF = async () => {
    const activeProjects = projects.filter((p: any) => p.status === "in_progress");
    const { data: rdos } = await supabase.from("rdo_dia").select("obra_id, produtividade_percentual, percentual_fisico_acumulado, data").eq("company_id", companyId!).limit(500);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório de Andamento de Obras", 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    const rows = activeProjects.map((p: any) => {
      const pRdos = (rdos || []).filter((r: any) => r.obra_id === p.id);
      const avgProd = pRdos.length > 0 ? Math.round(pRdos.reduce((s: number, r: any) => s + Number(r.produtividade_percentual || 0), 0) / pRdos.length) : 0;
      const lastRdo = pRdos.sort((a: any, b: any) => b.data.localeCompare(a.data))[0];
      const lastFisico = lastRdo?.percentual_fisico_acumulado || 0;
      return [p.name, p.status, `${lastFisico}%`, `${avgProd}%`, lastRdo?.data || "—"];
    });
    autoTable(doc, {
      startY: 30,
      head: [["Obra", "Status", "% Físico", "Prod. Média", "Último RDO"]],
      body: rows, styles: { fontSize: 10 },
    });
    doc.save("andamento-obras.pdf");
  };

  const generateCrmPDF = async () => {
    const { data: leads } = await supabase.from("crm_leads").select("*").eq("company_id", companyId!).order("stage");
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório de CRM — Funil de Vendas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    const rows = (leads || []).map((l: any) => [
      l.client_name, l.client_company || "", l.stage, `${l.probability_percent}%`,
      `R$ ${Number(l.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
      l.assigned_to || "",
    ]);
    autoTable(doc, {
      startY: 30,
      head: [["Cliente", "Empresa", "Estágio", "Prob.", "Valor", "Responsável"]],
      body: rows, styles: { fontSize: 9 },
    });
    const pipeline = (leads || []).filter((l: any) => !["ganho", "perdido"].includes(l.stage)).reduce((s: number, l: any) => s + Number(l.estimated_value || 0), 0);
    const won = (leads || []).filter((l: any) => l.stage === "ganho").length;
    const total = (leads || []).length;
    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(10);
    doc.text(`Pipeline total: R$ ${pipeline.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, 14, finalY + 10);
    doc.text(`Conversão: ${total > 0 ? ((won / total) * 100).toFixed(1) : 0}% (${won} de ${total} leads ganhos)`, 14, finalY + 18);
    doc.save("relatorio-crm.pdf");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      if (activeReport === "orcamento") await generateOrcamentoPDF();
      else if (activeReport === "financeiro") await generateFinanceiroPDF();
      else if (activeReport === "andamento") await generateAndamentoPDF();
      else if (activeReport === "crm") await generateCrmPDF();
      setActiveReport(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao gerar relatório", description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Central de relatórios do sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map(report => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:ring-1 hover:ring-primary/50 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => setActiveReport(report.id)}>
                  <FileDown className="mr-2 h-4 w-4" /> Gerar Relatório
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!activeReport} onOpenChange={v => { if (!v) setActiveReport(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {REPORTS.find(r => r.id === activeReport)?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(activeReport === "orcamento") && (
              <div className="space-y-2">
                <Label>Projeto *</Label>
                <Select value={params.project_id} onValueChange={v => setParams(p => ({ ...p, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(activeReport === "financeiro") && (
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={params.periodo} onValueChange={v => setParams(p => ({ ...p, periodo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mês atual</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(activeReport === "andamento" || activeReport === "crm") && (
              <p className="text-sm text-muted-foreground">Clique em Download PDF para gerar o relatório com todos os dados disponíveis.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveReport(null)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileDown className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
