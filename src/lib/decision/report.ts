// TamnaIndex 결정 레이어 — 자금계획서 보고서 HTML 빌더 (거래객체 → 양식 매핑, 순수함수)
// 인쇄(브라우저 Save as PDF)용 자기완결 HTML 문서를 만든다. 한국어 폰트는 페이지 폰트 사용.

export interface ReportRow {
  label: string;
  value: string;
  sub?: string;
}
export interface ReportData {
  title: string; // 보고서 제목
  createdAt: string; // 작성일 표시 문자열
  listingTitle: string;
  listingMeta: string; // "단독주택 · 매매 · 애월 · 30평"
  kind: "buy" | "rent";
  inputs: ReportRow[]; // 입력 정보
  results: ReportRow[]; // 계산 결과
  contextLine: string; // "지역 비규제 · LTV 70% · DSR 40% · 기준 2024-01"
  brief?: { summary: string; points: { level: string; text: string }[] } | null;
  disclaimer: string;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsTable(rows: ReportRow[]): string {
  return rows
    .map(
      (r) => `<tr>
        <th>${esc(r.label)}</th>
        <td><b>${esc(r.value)}</b>${r.sub ? ` <span class="sub">${esc(r.sub)}</span>` : ""}</td>
      </tr>`,
    )
    .join("");
}

export function buildReportHtml(d: ReportData): string {
  const briefHtml = d.brief
    ? `<section class="brief">
        <h2>AI 종합 의견</h2>
        <p class="summary">${esc(d.brief.summary)}</p>
        <ul>${d.brief.points
          .map((p) => `<li><span class="mk ${p.level}">${p.level === "good" ? "✓" : p.level === "warn" ? "⚠" : "·"}</span>${esc(p.text)}</li>`)
          .join("")}</ul>
      </section>`
    : "";

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(d.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
  * { box-sizing: border-box; }
  body { font-family: Pretendard, -apple-system, sans-serif; color: #1c2522; margin: 0; padding: 28px 32px; font-size: 13px; line-height: 1.5; }
  .head { display:flex; align-items:flex-end; justify-content:space-between; border-bottom: 2px solid #176b6b; padding-bottom: 10px; }
  .head h1 { font-size: 20px; margin: 0; color:#176b6b; }
  .head .brand { font-size: 11px; color:#5d665f; }
  .listing { margin: 14px 0 6px; }
  .listing .t { font-size: 15px; font-weight: 700; }
  .listing .m { font-size: 12px; color:#5d665f; }
  h2 { font-size: 13px; margin: 18px 0 6px; color:#176b6b; border-left: 3px solid #176b6b; padding-left: 7px; }
  table { width:100%; border-collapse: collapse; }
  th, td { text-align:left; padding: 6px 8px; border-bottom: 1px solid #e6e9e7; vertical-align: top; }
  th { width: 38%; color:#5d665f; font-weight: 500; }
  td b { font-variant-numeric: tabular-nums; }
  .sub { color:#9aa3a0; font-size: 11px; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .brief .summary { background:#f1f6f5; border-left:3px solid #176b6b; padding:8px 10px; border-radius:4px; }
  .brief ul { list-style:none; padding:0; margin:6px 0 0; }
  .brief li { display:flex; gap:6px; padding:2px 0; }
  .mk.good { color:#176b6b; } .mk.warn { color:#e2702a; } .mk { font-weight:700; }
  .ctx { margin-top: 14px; font-size: 11px; color:#5d665f; }
  .disc { margin-top: 8px; font-size: 10px; color:#8b938f; line-height:1.45; border-top:1px solid #e6e9e7; padding-top:8px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body onload="window.print()">
  <div class="head">
    <h1>${esc(d.title)}</h1>
    <div class="brand">탐라인덱스 · ${esc(d.createdAt)}</div>
  </div>

  <div class="listing">
    <div class="t">${esc(d.listingTitle)}</div>
    <div class="m">${esc(d.listingMeta)}</div>
  </div>

  <div class="grid">
    <div>
      <h2>입력 정보</h2>
      <table>${rowsTable(d.inputs)}</table>
    </div>
    <div>
      <h2>분석 결과</h2>
      <table>${rowsTable(d.results)}</table>
    </div>
  </div>

  ${briefHtml}

  <div class="ctx">${esc(d.contextLine)}</div>
  <div class="disc">${esc(d.disclaimer)}</div>
</body></html>`;
}

// ── 상담일지(실장님 수첩) 보고서 ──
export interface ConsultReportData {
  createdAt: string;
  customerName: string;
  contact: string;
  consultType: string;
  region: string;
  propertyType: string;
  dealType: string;
  budgetText: string;
  conditions: string[];
  interested: string[];
  nextActions: string[];
  summary: string;
  disclaimer: string;
}

function listBlock(title: string, items: string[]): string {
  if (!items || items.length === 0) return "";
  return `<section><h2>${esc(title)}</h2><ul class="bul">${items
    .map((x) => `<li>${esc(x)}</li>`)
    .join("")}</ul></section>`;
}

export function buildConsultReportHtml(d: ConsultReportData): string {
  const info: ReportRow[] = [
    { label: "고객명", value: d.customerName || "-" },
    { label: "연락처", value: d.contact || "-" },
    { label: "상담유형", value: d.consultType || "-" },
    { label: "관심지역", value: d.region || "-" },
    { label: "유형·거래", value: [d.propertyType, d.dealType].filter(Boolean).join(" · ") || "-" },
    { label: "예산·자금", value: d.budgetText || "-" },
  ];
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>상담일지</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
  *{box-sizing:border-box}
  body{font-family:Pretendard,-apple-system,sans-serif;color:#1c2522;margin:0;padding:28px 32px;font-size:13px;line-height:1.5}
  .head{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #176b6b;padding-bottom:10px}
  .head h1{font-size:20px;margin:0;color:#176b6b}.head .brand{font-size:11px;color:#5d665f}
  h2{font-size:13px;margin:16px 0 6px;color:#176b6b;border-left:3px solid #176b6b;padding-left:7px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e6e9e7;vertical-align:top}
  th{width:30%;color:#5d665f;font-weight:500}
  .summary{background:#f1f6f5;border-left:3px solid #176b6b;padding:8px 10px;border-radius:4px}
  ul.bul{margin:4px 0 0;padding-left:18px} ul.bul li{padding:2px 0}
  .disc{margin-top:14px;font-size:10px;color:#8b938f;border-top:1px solid #e6e9e7;padding-top:8px}
  @media print{body{padding:0}@page{margin:16mm}}
</style></head>
<body onload="window.print()">
  <div class="head"><h1>상담일지</h1><div class="brand">탐라인덱스 · ${esc(d.createdAt)}</div></div>
  <h2>고객 정보</h2>
  <table>${rowsTable(info)}</table>
  ${d.summary ? `<h2>상담 요약</h2><p class="summary">${esc(d.summary)}</p>` : ""}
  ${listBlock("희망 조건", d.conditions)}
  ${listBlock("관심 매물", d.interested)}
  ${listBlock("다음 액션", d.nextActions)}
  <div class="disc">${esc(d.disclaimer)}</div>
</body></html>`;
}
