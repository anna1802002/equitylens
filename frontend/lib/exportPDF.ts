/**
 * Export research report as a professionally formatted PDF.
 * Uses jsPDF and jspdf-autotable for layout and tables.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatLargeNum(num: number | null | undefined): string {
  if (num == null || Number.isNaN(num)) return "N/A";
  const n = Number(num);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export function exportResearchPDF(data: any): void {
  const doc = new jsPDF();
  const company = data?.company_name || data?.ticker || "Company";
  const ticker = data?.ticker || "N/A";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateFile = new Date().toISOString().slice(0, 10);

  // PAGE 1 - HEADER
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, 220, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(company, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`${ticker} · AI Research Report · ${date}`, 14, 30);

  const rec = data?.report?.recommendation ?? data?.recommendation ?? "HOLD";
  const recColor: [number, number, number] =
    rec === "BUY" ? [34, 197, 94] : rec === "SELL" ? [239, 68, 68] : [245, 158, 11];
  doc.setFillColor(...recColor);
  doc.roundedRect(150, 10, 40, 15, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(rec, 170, 20, { align: "center" });

  doc.setTextColor(30, 30, 30);

  // SECTION 1 - KEY METRICS TABLE
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Key Financial Metrics", 14, 55);

  const fin = data?.financials || {};
  const pe = Number(fin.pe_ratio ?? 0);

  autoTable(doc, {
    startY: 60,
    head: [["Metric", "Value", "What it means"]],
    body: [
      [
        "Current Price",
        `$${Number(fin.current_price ?? 0).toFixed(2)}`,
        "Current market price per share",
      ],
      [
        "P/E Ratio",
        `${Number(fin.pe_ratio ?? 0).toFixed(2)}x`,
        `Investors pay $${pe.toFixed(0)} per $1 of earnings`,
      ],
      [
        "EPS",
        `$${Number(fin.eps ?? 0).toFixed(2)}`,
        "Profit earned per share of stock",
      ],
      ["Revenue", formatLargeNum(fin.revenue), "Total annual sales"],
      [
        "Profit Margin",
        `${(Number(fin.profit_margin ?? 0) * 100).toFixed(1)}%`,
        "Profit kept from every $100 in sales",
      ],
      [
        "Risk Score",
        `${data?.report?.risk_score ?? data?.risk_score ?? 50}/100`,
        "Higher = more risky investment",
      ],
    ],
    headStyles: {
      fillColor: [30, 30, 46],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    styles: { fontSize: 10 },
  });

  const yPos = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("AI Analysis", 14, yPos);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const summary =
    data?.report?.plain_summary ??
    data?.plain_english_summary ??
    data?.plain_summary ??
    "No summary available.";
  const lines = doc.splitTextToSize(summary, 180);
  doc.text(lines, 14, yPos + 8);

  const yPos2 = yPos + 8 + lines.length * 6 + 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Why We Recommend " + rec, 14, yPos2);

  const reasons: string[] = data?.report?.reasons ?? data?.recommendation_reasons ?? [];
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  reasons.slice(0, 5).forEach((reason: string, i: number) => {
    doc.text(`• ${reason}`, 14, yPos2 + 8 + i * 7);
  });

  const yPos3 = yPos2 + 8 + Math.min(reasons.length, 5) * 7 + 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Market Sentiment", 14, yPos3);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const sentLabel = data?.sentiment_label ?? "Neutral";
  const sentScore = Number(data?.sentiment_score ?? data?.overall_sentiment_score ?? 0).toFixed(2);
  doc.text(`Overall: ${sentLabel} (${sentScore})`, 14, yPos3 + 8);

  const sentSummary = data?.sentiment_summary ?? "";
  if (sentSummary) {
    const sentLines = doc.splitTextToSize(sentSummary, 180);
    doc.text(sentLines, 14, yPos3 + 16);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "AI-generated research for educational purposes only. Not financial advice.",
      14,
      285
    );
    doc.text(`Page ${i} of ${pageCount} · Generated ${date}`, 196, 285, { align: "right" });
  }

  doc.save(`${ticker}-research-report-${dateFile}.pdf`);
}
