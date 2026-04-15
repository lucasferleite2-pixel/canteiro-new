import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { OrcamentoItem, calcularTotalOrcamento } from "./sinapiUtils";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function gerarPropostaComercialPDF(
  projeto: { name: string; id?: string },
  itens: OrcamentoItem[],
  empresa: { name?: string; cnpj?: string } = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape" });
  const { subtotal, totalComBdi, porFase } = calcularTotalOrcamento(itens);
  const bdiTotal = totalComBdi - subtotal;
  const bdiMedio = subtotal > 0 ? (bdiTotal / subtotal) * 100 : 0;
  const now = new Date().toLocaleDateString("pt-BR");

  // ── Page 1: Cover ──────────────────────────────────────────────────────────
  doc.setFillColor(0, 113, 227);
  doc.rect(0, 0, 297, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("PROPOSTA COMERCIAL", 20, 20);
  doc.setFontSize(12);
  doc.text(empresa.name || "Construtora", 20, 30);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(projeto.name, 20, 60);
  doc.setFontSize(11);
  doc.text(`Data: ${now}`, 20, 72);
  if (empresa.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, 20, 80);

  doc.setFontSize(13);
  doc.text("Resumo Financeiro", 20, 100);
  autoTable(doc, {
    startY: 106,
    head: [["Item", "Valor"]],
    body: [
      ["Subtotal sem BDI", fmt(subtotal)],
      [`BDI (${bdiMedio.toFixed(1)}%)`, fmt(bdiTotal)],
      ["TOTAL COM BDI", fmt(totalComBdi)],
    ],
    styles: { fontSize: 11 },
    headStyles: { fillColor: [0, 113, 227] },
    columnStyles: { 1: { halign: "right" } },
  });

  // ── Page 2+: Budget table ──────────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(14);
  doc.text(`Orçamento Detalhado — ${projeto.name}`, 14, 16);

  const groups = new Map<string, OrcamentoItem[]>();
  for (const i of itens) {
    const k = i.fase || "Sem fase";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }

  let startY = 24;
  for (const [fase, rows] of groups.entries()) {
    const faseTotal = rows.reduce(
      (s, i) => s + i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100),
      0
    );
    autoTable(doc, {
      startY,
      head: [[{ content: `${fase} — ${fmt(faseTotal)}`, colSpan: 7, styles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" } }],
             ["Código", "Descrição", "Un", "Qtd", "P.Unit.", "BDI%", "Total"]],
      body: rows.map((i) => [
        i.codigo || "—",
        i.descricao,
        i.unidade,
        i.quantidade.toFixed(2),
        fmt(i.preco_unitario),
        `${(i.bdi || 0).toFixed(1)}%`,
        fmt(i.quantidade * i.preco_unitario * (1 + (i.bdi || 0) / 100)),
      ]),
      styles: { fontSize: 8, overflow: "linebreak" },
      headStyles: { fillColor: [0, 113, 227], fontSize: 8 },
      columnStyles: { 1: { cellWidth: 70 }, 3: { halign: "right" }, 4: { halign: "right" }, 6: { halign: "right" } },
      didDrawPage: (_data: any) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`${empresa.name || "Proposta"} — Pág. ${doc.getNumberOfPages()}`, 14, doc.internal.pageSize.height - 8);
        doc.setTextColor(0);
      },
    });
    startY = (doc as any).lastAutoTable?.finalY + 8 || startY + 40;
  }

  // ── Last section: totals ───────────────────────────────────────────────────
  autoTable(doc, {
    startY,
    head: [["Fase", "Subtotal"]],
    body: porFase.map((f) => [f.fase, fmt(f.total)]),
    foot: [["TOTAL COM BDI", fmt(totalComBdi)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 113, 227] },
    footStyles: { fontStyle: "bold", fillColor: [230, 230, 230] },
    columnStyles: { 1: { halign: "right" } },
  });

  doc.save(`proposta-${projeto.name.replace(/\s+/g, "-")}.pdf`);
}
