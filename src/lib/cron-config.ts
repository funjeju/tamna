// Firestore 기반 크론 설정 — 어드민에서 수정, 크론 실행 시 참조
import { adminDb } from "./firebase";

export interface SourceCronConfig {
  enabled: boolean;
  intervalDays: number;   // 몇 일에 한 번
  hourKST: number;        // 몇 시 (표시용, 실제 실행 시각은 vercel.json 기준)
  lastRunAt: string | null; // ISO string
}

export interface CronConfig {
  youtube: SourceCronConfig;
  blog: SourceCronConfig;
  rotation: { enabled: boolean; lastRunAt: string | null };
}

const DOC = "settings/cronConfig";

const DEFAULT: CronConfig = {
  youtube:  { enabled: true,  intervalDays: 1, hourKST: 1, lastRunAt: null },
  blog:     { enabled: true,  intervalDays: 2, hourKST: 2, lastRunAt: null },
  rotation: { enabled: false, lastRunAt: null },
};

export async function getCronConfig(): Promise<CronConfig> {
  const doc = await adminDb.doc(DOC).get();
  if (!doc.exists) return DEFAULT;
  const d = doc.data() as any;
  return {
    youtube:  { ...DEFAULT.youtube,  ...(d.youtube  ?? {}) },
    blog:     { ...DEFAULT.blog,     ...(d.blog     ?? {}) },
    rotation: { ...DEFAULT.rotation, ...(d.rotation ?? {}) },
  };
}

export async function saveCronConfig(cfg: CronConfig): Promise<void> {
  await adminDb.doc(DOC).set(cfg, { merge: true });
}

// 현재 크론이 실행되어야 하는지 판단
export function shouldRun(cfg: SourceCronConfig): boolean {
  if (!cfg.enabled) return false;
  if (!cfg.lastRunAt) return true;
  const last = new Date(cfg.lastRunAt).getTime();
  const elapsed = Date.now() - last;
  const interval = cfg.intervalDays * 24 * 60 * 60 * 1000;
  return elapsed >= interval;
}

// lastRunAt 갱신
export async function markRan(source: "youtube" | "blog"): Promise<void> {
  await adminDb.doc(DOC).set(
    { [source]: { lastRunAt: new Date().toISOString() } },
    { merge: true },
  );
}
