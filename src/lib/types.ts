// TamnaIndex — 공통 타입 정의 (Prisma 모델과 1:1, JSON 필드는 파싱된 형태로)

// 공개(유저) 화면에서 노출할 매물의 최대 업로드 경과일.
// 유튜브/블로그 원본 업로드일(publishedAt) 기준 이 일수를 넘긴 매물은
// 공개 목록·배너에서 순차적으로 숨김 (DB 삭제 아님, 관리자/상세는 영향 없음).
export const PUBLIC_MAX_AGE_DAYS = 14;

export type PropertyType =
  | "단독주택"
  | "토지"
  | "상가"
  | "아파트"
  | "전원주택"
  | "상가주택"
  | "빌라"
  | "기타";

export type DealType = "매매" | "전세" | "월세" | "임대" | "경매";

export type ListingStatus =
  | "collected"
  | "structuring"
  | "draft"
  | "published"
  | "rejected"
  | "opted_out"
  | "error";

export type ExtractionSource = "ai" | "fallback";

export type Theme =
  | "세컨하우스"
  | "한달살기"
  | "돌집·구옥"
  | "바다뷰"
  | "읍면 단독"
  | "급매";

export type AgentPlan = "free" | "featured" | "premium";

export interface PriceHistoryEntry {
  manwon: number;
  at: string; // ISO date
}

export interface Listing {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  channelId: string;
  publishedAt: string;
  collectedAt: string;
  // structured
  propertyType: PropertyType;
  dealType: DealType;
  priceText: string;
  priceManwon: number; // 매매가(매매) 또는 보증금(전월세)
  monthlyRentManwon: number | null; // 월세(전월세) — 만원, 없으면 null
  priceHistory: PriceHistoryEntry[];
  areaM2: number | null;
  areaPyeong: number | null;
  zoning: string | null;
  addressText: string;
  region: string;
  lat: number;
  lng: number;
  geohash: string | null;
  summary: string;
  highlights: string[];
  keywords: string[];
  themes: Theme[];
  extractionSource: ExtractionSource;
  confidence: number;
  status: ListingStatus;
  reviewedBy: string | null;
  publishedAt2: string | null;
  takedownAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceType?: "youtube" | "blog";
  images?: string[];
  sourceUrl?: string;
  agent?: Agent | null;
  isFavorited?: boolean;
}

export interface Agent {
  id: string;
  channelId: string;
  channelName: string;
  channelUrl: string | null;
  name: string | null;
  regNo: string | null;
  office: string | null;
  expertise: string | null;
  phone: string | null;
  verified: boolean;
  optedOut: boolean;
  plan: AgentPlan;
  createdAt: string;
  listingCount?: number;
}

export interface CollectionJobItem {
  videoId: string;
  step: string;
  source: string;
  status: "ok" | "skip" | "fail";
  detail?: string;
}

export interface CollectionJob {
  id: string;
  trigger: "cron" | "manual";
  region: string | null;
  found: number;
  processed: number;
  failed: number;
  items: CollectionJobItem[];
  startedAt: string;
  finishedAt: string | null;
}

export interface ListingFilters {
  q?: string;
  sourceType?: "youtube" | "blog";
  propertyTypes?: PropertyType[];
  dealTypes?: DealType[];
  priceMin?: number; // 만원
  priceMax?: number; // 만원
  areaMin?: number; // 평
  areaMax?: number; // 평
  regions?: string[];
  themes?: Theme[];
  keywords?: string[];
  sort?:
    | "latest"
    | "price_asc"
    | "price_desc"
    | "area"
    | "price_drop"
    | "just_published";
  status?: ListingStatus;
}

export const PROPERTY_TYPES: PropertyType[] = [
  "단독주택",
  "전원주택",
  "빌라",
  "아파트",
  "상가",
  "상가주택",
  "토지",
  "기타",
];

export const DEAL_TYPES: DealType[] = ["매매", "전세", "월세", "임대", "경매"];

export const THEMES: Theme[] = [
  "세컨하우스",
  "한달살기",
  "돌집·구옥",
  "바다뷰",
  "읍면 단독",
  "급매",
];

export const KEYWORD_CHIPS = [
  "바다뷰",
  "돌담",
  "주차2대",
  "신축",
  "구옥",
  "리모델링",
  "마당",
  "한라산뷰",
  "통유리",
  "온수",
  "급매",
  "전원주택",
  "오션뷰",
  "해변도보",
  "다락",
  "내부사진",
];

export const STATUS_LABEL: Record<ListingStatus, string> = {
  collected: "수집됨",
  structuring: "구조화중",
  draft: "검수대기",
  published: "게시중",
  rejected: "반려",
  opted_out: "노출중단",
  error: "에러",
};

export const STATUS_COLOR: Record<ListingStatus, string> = {
  collected: "#5d665f",
  structuring: "#176b6b",
  draft: "#e2702a",
  published: "#176b6b",
  rejected: "#c0392b",
  opted_out: "#9aa3a0",
  error: "#c0392b",
};
