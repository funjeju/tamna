// TamnaIndex 결정 레이어 — AI 브리핑 로직 (프롬프트 + 후검증 + 결정론 폴백)
// 원칙: AI는 금액·세액 숫자를 생성하지 않는다. 의미·행동만 해석.
//       출력에 '금액(억/만원/원)'이 있으면 무효, '%'는 엔진이 준 값만 허용 → 검증 실패 시 폴백.

export interface BriefMetrics {
  kind: "buy" | "rent";
  region?: string;
  propertyType?: string;
  // buy
  affordable?: boolean;
  limitedBy?: "dsr" | "cash_ltv";
  dsr?: number;
  dsrLimit?: number;
  acqRatePct?: number;
  surcharged?: boolean;
  feeRatePct?: number;
  ltvCapPct?: number;
  // rent
  feeRentRatePct?: number;
}

export interface BriefPoint {
  level: "good" | "warn" | "tip";
  text: string;
}
export interface Brief {
  summary: string;
  points: BriefPoint[];
}

// 출력에서 허용되는 % 값 (엔진이 준 것만)
export function allowedPercents(m: BriefMetrics): number[] {
  return [m.dsr, m.dsrLimit, m.acqRatePct, m.feeRatePct, m.ltvCapPct, m.feeRentRatePct].filter(
    (x): x is number => typeof x === "number",
  );
}

// 후검증: 금액 숫자 금지 + % 는 허용값만 (±0.6)
export function validateBrief(b: Brief, m: BriefMetrics): boolean {
  const text = [b.summary, ...(b.points ?? []).map((p) => p.text)].join(" ");
  if (/\d[\d,.]*\s*(억|만원|원)/.test(text)) return false; // 금액 생성 금지
  const allowed = allowedPercents(m);
  const pcts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((x) => parseFloat(x[1]));
  for (const p of pcts) {
    if (!allowed.some((a) => Math.abs(a - p) <= 0.6)) return false;
  }
  return true;
}

export function buildBriefPrompt(m: BriefMetrics): string {
  return `너는 부동산 자금 코치다. 아래는 '결정론 엔진'이 이미 계산한 수치다(화면에 표시됨).
너의 역할은 숫자를 새로 만드는 게 아니라, 이 상황의 의미와 행동을 한국어로 짚어주는 것이다.

[상황] kind=${m.kind}, 지역=${m.region ?? "-"}, 유형=${m.propertyType ?? "-"}
${m.kind === "buy"
  ? `가능여부=${m.affordable ? "가능" : "한도초과"}, 한도사유=${m.limitedBy ?? "-"}, DSR=${m.dsr}%(한도 ${m.dsrLimit}%), 취득세율=${m.acqRatePct}%${m.surcharged ? "(다주택 중과)" : ""}`
  : `전월세 매물(보증금·월세). 환산보증금·중개보수 기준.`}

규칙:
- 금액(억/만원/원) 숫자를 절대 쓰지 마라(이미 화면에 있음).
- %는 위에 제시된 값만 그대로 인용 가능(새 % 만들기 금지).
- summary는 2~3문장. points는 3~4개, 각 level은 good|warn|tip.
- 의미(좋은가/위험한가)와 행동(무엇을 하면 되는지)을 구체적으로. 과장·단정 금지, 불확실하면 확인 권장.

JSON만 출력: {"summary":str,"points":[{"level":"good|warn|tip","text":str}]}`;
}

// ── 결정론 폴백 (AI 실패/검증탈락 시) ──
export function fallbackBrief(m: BriefMetrics): Brief {
  if (m.kind === "rent") {
    return {
      summary: "보증금·월세 기준 분석입니다. 계약 전 권리관계와 보증보험 가능 여부를 확인하세요.",
      points: [
        { level: "tip", text: "환산보증금·중개보수는 상한 기준이며 협의 가능합니다." },
        { level: "warn", text: "등기부등본의 근저당·선순위, 신탁등기 여부를 반드시 확인하세요." },
        { level: "tip", text: "전세보증보험 가입 가능 여부를 미리 확인하면 안전망이 됩니다." },
      ],
    };
  }
  const points: BriefPoint[] = [];
  points.push(
    m.affordable
      ? { level: "good", text: "입력하신 자금 범위 안의 매물입니다. 세부 비용까지 포함해 계획을 점검하세요." }
      : { level: "warn", text: "현재 자금으로는 한도를 초과합니다. 예산을 조정하거나 자금 계획을 재검토하세요." },
  );
  points.push(
    m.limitedBy === "dsr"
      ? { level: "warn", text: "소득 대비 대출한도(DSR)가 한도입니다. 기존 대출 정리·소득 증빙 보강으로 여력을 키울 수 있습니다." }
      : { level: "tip", text: "보유현금과 LTV가 한도입니다. 현금 여력 또는 담보비율이 관건입니다." },
  );
  if (typeof m.dsr === "number" && typeof m.dsrLimit === "number" && m.dsr >= m.dsrLimit - 3) {
    points.push({ level: "warn", text: "DSR이 규제 한도에 근접합니다. 안 쓰는 마이너스통장·카드론 한도를 정리하면 여력이 늘어납니다." });
  }
  if (m.surcharged) {
    points.push({ level: "warn", text: "다주택 취득세 중과 대상으로 보입니다. 보유주택 수·세대·특례 요건을 세무사와 확인하세요." });
  }
  points.push({ level: "tip", text: "취득세·중개보수·필요현금까지 합산해 자금계획을 세우고, 정확한 세액은 전문가 확인을 권장합니다." });
  return {
    summary: m.affordable
      ? "입력하신 소득·현금 기준으로 이 매물은 자금 범위 안입니다. 세부 비용과 대출 조건을 함께 점검해 보세요."
      : "입력하신 자금으로는 한도를 넘습니다. 무엇이 한도였는지 보고 예산·대출·현금 계획을 조정해 보세요.",
    points: points.slice(0, 4),
  };
}
