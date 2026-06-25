// TamnaIndex 결정 레이어 — 정책값 저장소 (Firestore 캐시 over 시드)
import { adminDb } from "../firebase";
import { RULES } from "./rules";
import type { PolicySnapshot } from "./policy-rag";

const DOC = "settings/policyRules";

export interface EffectivePolicy {
  ltvNonRegulatedPct: number;
  ltvRegulatedPct: number;
  ltvFirstTimePct: number;
  dsrLimitPct: number;
  stressAddRatePct: number;
  jeonseWolseConvCapPct: number;
  asOf: string;
  sources: string[];
  refreshed: boolean; // RAG로 갱신됐는지 (false면 시드 = 확인필요)
}

export async function savePolicy(snap: PolicySnapshot): Promise<void> {
  await adminDb.doc(DOC).set({ ...snap, refreshedAt: new Date() }, { merge: true });
}

export async function getEffectivePolicy(): Promise<EffectivePolicy> {
  let d: Record<string, unknown> | null = null;
  try {
    const doc = await adminDb.doc(DOC).get();
    if (doc.exists) d = doc.data() as Record<string, unknown>;
  } catch {
    /* noop */
  }
  if (d && typeof d.dsrLimitPct === "number") {
    return {
      ltvNonRegulatedPct: d.ltvNonRegulatedPct as number,
      ltvRegulatedPct: d.ltvRegulatedPct as number,
      ltvFirstTimePct: d.ltvFirstTimePct as number,
      dsrLimitPct: d.dsrLimitPct as number,
      stressAddRatePct: d.stressAddRatePct as number,
      jeonseWolseConvCapPct: d.jeonseWolseConvCapPct as number,
      asOf: (d.asOf as string) ?? "",
      sources: Array.isArray(d.sources) ? (d.sources as string[]) : [],
      refreshed: true,
    };
  }
  // 시드 폴백 (확인필요)
  return {
    ltvNonRegulatedPct: RULES.ltv.nonRegulated.value,
    ltvRegulatedPct: RULES.ltv.regulated.value,
    ltvFirstTimePct: RULES.ltv.firstTime.value,
    dsrLimitPct: RULES.dsrLimitPct.value,
    stressAddRatePct: RULES.stressAddRatePct.value,
    jeonseWolseConvCapPct: RULES.jeonseWolseConvCapPct.value,
    asOf: RULES.ltv.nonRegulated.asOf,
    sources: [],
    refreshed: false,
  };
}
