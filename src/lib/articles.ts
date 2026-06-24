// TamnaIndex — 권위/SEO 콘텐츠(가이드) 데이터 레이어 (Firestore "articles")
// 서버 전용. /guide 페이지·sitemap·생성 크론에서 사용.
import { adminDb } from "./firebase";

export interface ArticleFaq {
  q: string;
  a: string;
}

export interface Article {
  slug: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  cluster: string;
  intent: string;
  type: "authority" | "auto";
  lead: string; // answer-first 핵심 요약
  bodyMarkdown: string;
  faq: ArticleFaq[];
  related: { regions: string[]; propertyTypes: string[]; themes: string[] };
  sources: string[];
  author: string;
  status: "published" | "draft";
  publishedAt: string; // ISO
  updatedAt: string; // ISO
}

const COL = "articles";

function deserialize(id: string, d: Record<string, unknown>): Article {
  const toIso = (v: unknown): string =>
    v && typeof (v as { toDate?: () => Date }).toDate === "function"
      ? (v as { toDate: () => Date }).toDate().toISOString()
      : typeof v === "string"
        ? v
        : new Date().toISOString();
  return {
    slug: (d.slug as string) ?? id,
    title: (d.title as string) ?? "",
    metaDescription: (d.metaDescription as string) ?? "",
    keywords: Array.isArray(d.keywords) ? (d.keywords as string[]) : [],
    cluster: (d.cluster as string) ?? "",
    intent: (d.intent as string) ?? "",
    type: d.type === "auto" ? "auto" : "authority",
    lead: (d.lead as string) ?? "",
    bodyMarkdown: (d.bodyMarkdown as string) ?? "",
    faq: Array.isArray(d.faq) ? (d.faq as ArticleFaq[]) : [],
    related:
      (d.related as Article["related"]) ?? { regions: [], propertyTypes: [], themes: [] },
    sources: Array.isArray(d.sources) ? (d.sources as string[]) : [],
    author: (d.author as string) ?? "탐라인덱스 편집팀",
    status: d.status === "draft" ? "draft" : "published",
    publishedAt: toIso(d.publishedAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export async function listArticles(limit = 200): Promise<Article[]> {
  const snap = await adminDb.collection(COL).where("status", "==", "published").get();
  const rows = snap.docs.map((doc) => deserialize(doc.id, doc.data() as Record<string, unknown>));
  rows.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return rows.slice(0, limit);
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const doc = await adminDb.collection(COL).doc(slug).get();
  if (!doc.exists) return null;
  const a = deserialize(doc.id, doc.data() as Record<string, unknown>);
  return a.status === "published" ? a : null;
}

export async function slugExists(slug: string): Promise<boolean> {
  const doc = await adminDb.collection(COL).doc(slug).get();
  return doc.exists;
}

export async function createArticle(a: Article): Promise<void> {
  await adminDb.collection(COL).doc(a.slug).set({
    ...a,
    publishedAt: new Date(a.publishedAt),
    updatedAt: new Date(a.updatedAt),
  });
}

export async function existingSlugs(): Promise<Set<string>> {
  const snap = await adminDb.collection(COL).get();
  return new Set(snap.docs.map((d) => d.id));
}

export async function countByType(type: "authority" | "auto"): Promise<number> {
  const snap = await adminDb.collection(COL).where("type", "==", type).get();
  return snap.size;
}

// ── 권위 20개 토픽 시드 (생성 순서 = 우선순위) ──
export interface AuthoritySpec {
  slug: string;
  title: string;
  cluster: string;
  intent: string;
  keywords: string[];
  related: { regions: string[]; propertyTypes: string[]; themes: string[] };
  brief: string; // 생성 가이드(핵심 다룰 내용)
}

export const AUTHORITY_TOPICS: AuthoritySpec[] = [
  { slug: "jeju-real-estate-guide", title: "제주도 부동산 완벽 가이드 — 매매 전 알아야 할 모든 것", cluster: "총론", intent: "정보/허브", keywords: ["제주도 부동산", "제주 부동산", "제주 매물", "제주 부동산 가이드"], related: { regions: [], propertyTypes: [], themes: [] }, brief: "제주 부동산 시장 개요, 유형(토지/주택/상가), 외지인 유의점, 거래 흐름, 지역 특성, 비대면 임장까지 큰 그림. 다른 가이드로 가는 허브." },
  { slug: "jeju-real-estate-transaction-process", title: "제주 부동산 거래 절차 A to Z — 계약부터 등기까지", cluster: "거래절차", intent: "정보/실무", keywords: ["제주 부동산 거래 절차", "제주 부동산 계약", "제주 등기"], related: { regions: [], propertyTypes: [], themes: [] }, brief: "매물 확인→가계약→계약→중도금→잔금→소유권이전등기, 필요서류, 비대면 거래 시 체크." },
  { slug: "jeju-land-buying-checklist", title: "제주 토지 매매 시 반드시 확인할 7가지", cluster: "토지", intent: "정보/주의", keywords: ["제주 토지 매매", "제주 땅 구입", "제주 토지 주의사항", "용도지역", "지목"], related: { regions: [], propertyTypes: ["토지"], themes: [] }, brief: "용도지역·지목·도로(맹지)·경사·지하수·분묘·토지거래허가 7대 체크." },
  { slug: "jeju-farmland-acquisition", title: "제주 농지취득자격증명(농취증) — 외지인도 농지 살 수 있을까", cluster: "토지/규제", intent: "질문/정보", keywords: ["제주 농지취득자격증명", "농취증", "제주 농지 외지인", "제주 농지 구입"], related: { regions: [], propertyTypes: ["토지"], themes: [] }, brief: "농취증 개념·발급 조건·절차·영농계획서·외지인 가능 여부·주의." },
  { slug: "jeju-land-transaction-permit-zone", title: "제주 토지거래허가구역 완전 정리 — 어디가 묶였고 어떻게 사나", cluster: "토지/규제", intent: "정보/주의", keywords: ["제주 토지거래허가구역", "토지거래허가", "제주 부동산 규제"], related: { regions: [], propertyTypes: ["토지"], themes: [] }, brief: "허가구역 개념·대상·허가 요건·실수요·위반 시 불이익. (구역은 변동되므로 출처·갱신 안내)" },
  { slug: "jeju-real-estate-tax", title: "제주 부동산 세금 한눈에 — 취득세·재산세·양도세", cluster: "세금", intent: "정보/실무", keywords: ["제주 부동산 취득세", "제주 양도세", "제주 재산세", "제주 부동산 세금"], related: { regions: [], propertyTypes: [], themes: [] }, brief: "취득세 구조, 다주택·농지·주택 차이, 재산세, 양도세 기본, 세율은 변동되니 출처·확인 안내." },
  { slug: "jeju-house-types-compare", title: "단독 vs 전원 vs 농가주택 — 제주에서 차이와 선택 기준", cluster: "주택", intent: "정보/선택", keywords: ["제주 단독주택", "제주 전원주택", "제주 농가주택", "차이"], related: { regions: [], propertyTypes: ["단독주택", "전원주택"], themes: ["읍면 단독"] }, brief: "정의·입지·인허가·생활편의·가격대 차이와 페르소나별 추천." },
  { slug: "jeju-ocean-view-house", title: "제주 바다뷰 주택의 진실 — 장점·단점·경관/고도 규제", cluster: "주택", intent: "정보/주의", keywords: ["제주 바다뷰", "제주 오션뷰 주택", "제주 경관 규제", "고도제한"], related: { regions: ["애월", "한림", "조천"], propertyTypes: ["단독주택", "전원주택"], themes: ["바다뷰"] }, brief: "바다뷰 가치·염해·강풍·관리·조망 보존(경관/고도) 규제 체크." },
  { slug: "jeju-real-estate-fraud", title: "제주 부동산 사기·분쟁 유형과 예방법", cluster: "주의", intent: "정보/주의", keywords: ["제주 부동산 사기", "기획부동산", "맹지", "분묘기지권"], related: { regions: [], propertyTypes: ["토지"], themes: [] }, brief: "기획부동산·맹지·이중계약·분묘기지권·시세 부풀리기 유형과 예방 수칙." },
  { slug: "jeju-rural-house-infra", title: "제주 시골집 인프라 점검 — 상하수도·지하수·정화조", cluster: "주택/실무", intent: "정보/실무", keywords: ["제주 상수도", "제주 지하수", "제주 정화조", "제주 시골집"], related: { regions: [], propertyTypes: ["단독주택", "전원주택"], themes: ["돌집·구옥"] }, brief: "상수도 인입·지하수 관정·정화조·전기·통신 등 시골집 필수 인프라 점검." },
  { slug: "jeju-old-house-remodeling", title: "제주 빈집·구옥 리모델링 가이드 — 비용과 인허가", cluster: "주택/실무", intent: "정보/실무", keywords: ["제주 구옥 리모델링", "제주 빈집", "돌집 리모델링", "제주 농가주택 수리"], related: { regions: [], propertyTypes: ["단독주택"], themes: ["돌집·구옥"] }, brief: "구옥 상태 점검·리모델링 비용·인허가·돌집 보존·예산 가이드." },
  { slug: "jeju-buildable-land", title: "제주 건축 가능한 땅 고르는 법 — 맹지·도로·개발행위허가", cluster: "토지/실무", intent: "정보/실무", keywords: ["제주 건축 가능한 땅", "맹지", "개발행위허가", "제주 토지 도로"], related: { regions: [], propertyTypes: ["토지"], themes: [] }, brief: "건축 가능 여부 판단(도로·맹지·용도·개발행위허가) 단계별 확인법." },
  { slug: "jeju-price-check", title: "제주 부동산 시세 확인하는 법 — 실거래가·공시지가·영상매물", cluster: "실무", intent: "정보/실무", keywords: ["제주 부동산 시세", "제주 실거래가", "제주 공시지가"], related: { regions: [], propertyTypes: [], themes: [] }, brief: "실거래가 공개시스템·공시지가·호가·영상매물 비교로 시세 잡는 법. 탐라인덱스 활용." },
  { slug: "jeju-broker-fee", title: "제주 중개보수(복비) 요율과 비대면 거래 주의점", cluster: "실무", intent: "정보/실무", keywords: ["제주 중개보수", "제주 복비", "부동산 중개수수료", "비대면 거래"], related: { regions: [], propertyTypes: [], themes: [] }, brief: "중개보수 요율 구조·상한·협의, 비대면/원격 거래 시 검증·계약 주의." },
  { slug: "jeju-second-house", title: "육지인의 제주 세컨하우스 — 지역별 추천과 현실 비용", cluster: "페르소나", intent: "정보/선택", keywords: ["제주 세컨하우스", "제주 별장", "세컨하우스 추천 지역"], related: { regions: ["애월", "조천", "성산"], propertyTypes: ["단독주택", "전원주택"], themes: ["세컨하우스", "바다뷰"] }, brief: "세컨하우스 목적·지역별 특성·취득/보유 비용·관리(공실/원격) 현실." },
  { slug: "jeju-relocation-roadmap", title: "제주 한달살기에서 정착까지 — 이주 로드맵", cluster: "페르소나", intent: "정보/여정", keywords: ["제주 이주", "제주 한달살기", "제주 정착"], related: { regions: [], propertyTypes: [], themes: ["한달살기"] }, brief: "한달살기→임차→매수 단계별 이주 로드맵, 지역 탐색·예산·생활 인프라." },
  { slug: "jeju-retirement-move", title: "제주 은퇴 이주 — 예산별 주거 선택지", cluster: "페르소나", intent: "정보/선택", keywords: ["제주 은퇴 이주", "제주 노후", "제주 전원생활"], related: { regions: [], propertyTypes: ["단독주택", "전원주택"], themes: ["읍면 단독"] }, brief: "은퇴 이주 시 예산대별 주거(매수/전원/타운하우스), 의료·생활 인프라 고려." },
  { slug: "aewol-real-estate", title: "애월 부동산 가이드 — 바다뷰·전원주택 시세와 입지", cluster: "지역", intent: "정보/지역", keywords: ["애월 부동산", "애월 단독주택", "애월 바다뷰", "애월 전원주택"], related: { regions: ["애월"], propertyTypes: ["단독주택", "전원주택"], themes: ["바다뷰"] }, brief: "애월 권역 특성·인기 이유·시세대·입지(해안/중산간)·매물 유형. 애월 매물 연동." },
  { slug: "seogwipo-real-estate", title: "서귀포 부동산 가이드 — 중문·남원·성산 권역별 특징", cluster: "지역", intent: "정보/지역", keywords: ["서귀포 부동산", "중문 부동산", "남원 부동산", "성산 부동산"], related: { regions: ["서귀포", "중문", "남원", "성산"], propertyTypes: [], themes: [] }, brief: "서귀포 권역(원도심·중문·남원·성산) 특성·시세·생활. 권역별 매물 연동." },
  { slug: "jeju-east-vs-west", title: "제주 동부 vs 서부 — 어디를 살까", cluster: "지역", intent: "정보/선택", keywords: ["제주 동부 부동산", "제주 서부 부동산", "구좌", "한림", "대정"], related: { regions: ["구좌", "조천", "성산", "한림", "한경", "대정"], propertyTypes: [], themes: [] }, brief: "동부(구좌·조천·성산) vs 서부(한림·한경·대정) 기후·관광·시세·생활 비교." },
];

// ── 자동 업데이트 글 키워드 풀(지역×유형 + 정보/동향 시드). 라운드로빈 사용. ──
export const AUTO_KEYWORD_POOL: string[] = [
  "애월 바다뷰 단독주택 시세",
  "한림 토지 매매 가이드",
  "조천 전원주택 입지",
  "구좌 농가주택 매매",
  "성산 토지 투자",
  "표선 단독주택",
  "남원 바다뷰 주택",
  "안덕 전원주택",
  "대정 토지 매매",
  "한경 단독주택",
  "제주시 원도심 상가",
  "노형동 아파트 시세",
  "중문 빌라 매매",
  "제주 농지 투자 주의점",
  "제주 펜션 매매 체크리스트",
  "제주 상가주택 수익률",
  "제주 토지 용도지역 보는 법",
  "제주 바다 접한 토지 규제",
  "제주 부동산 계절별 거래 동향",
  "제주 관광지 인근 부동산",
];
