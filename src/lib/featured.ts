// TamnaIndex — "주목할 매물" 설정 (Firestore settings/featured)
// 운영자가 특정 매물(listingIds) 또는 특정 부동산/채널(agentQuery)을 배너에 배치할 수 있다.
import { adminDb } from "./firebase";

export interface FeaturedConfig {
  mode: "agent" | "ids";
  agentQuery: string; // 채널/사무소/제목에 포함될 문자열 (mode=agent)
  listingIds: string[]; // 고정 노출할 매물 id 목록 (mode=ids)
}

const DOC = "settings/featured";

// 기본값 — 헤이부동산 매물을 주목 배너에 노출
const DEFAULT: FeaturedConfig = {
  mode: "agent",
  agentQuery: "헤이부동산",
  listingIds: [],
};

export async function getFeaturedConfig(): Promise<FeaturedConfig> {
  const doc = await adminDb.doc(DOC).get();
  if (!doc.exists) return DEFAULT;
  const d = doc.data() as Record<string, unknown>;
  return {
    mode: d.mode === "ids" ? "ids" : "agent",
    agentQuery: typeof d.agentQuery === "string" ? d.agentQuery : DEFAULT.agentQuery,
    listingIds: Array.isArray(d.listingIds)
      ? (d.listingIds.filter((x) => typeof x === "string") as string[])
      : [],
  };
}

export async function saveFeaturedConfig(cfg: Partial<FeaturedConfig>): Promise<void> {
  await adminDb.doc(DOC).set(cfg, { merge: true });
}
