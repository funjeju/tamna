// 읍면동 로테이션 수집 — 매 실행마다 다음 N개 읍면동을 순서대로 처리
// 광역 쿼리(collect.ts)와 독립 실행, videoId 중복은 기존 로직으로 자동 스킵
import { adminDb } from "./firebase";
import { runCollection } from "./collect";
import { REGION_NAMES } from "./regions";

// 한 번에 처리할 읍면동 수. cron이 4시간마다(하루 6회) 돌아 3×6=18 슬롯 → 15개 매일 1바퀴.
const REGIONS_PER_RUN = 3;
const STATE_DOC = "settings/rotationState";

interface RotationState {
  nextIndex: number;
  lastRunAt: string | null;
}

async function getState(): Promise<RotationState> {
  const doc = await adminDb.doc(STATE_DOC).get();
  if (!doc.exists) return { nextIndex: 0, lastRunAt: null };
  return doc.data() as RotationState;
}

async function saveState(state: RotationState): Promise<void> {
  await adminDb.doc(STATE_DOC).set(state, { merge: true });
}

export async function runRotationCollection() {
  const regions = REGION_NAMES; // 한라산 제외 15개
  const state = await getState();

  const start = state.nextIndex % regions.length;
  const batch = regions
    .slice(start, start + REGIONS_PER_RUN)
    // 끝에서 wrap-around
    .concat(regions.slice(0, Math.max(0, start + REGIONS_PER_RUN - regions.length)));
  const nextIndex = (start + REGIONS_PER_RUN) % regions.length;

  const results: any[] = [];
  for (const region of batch) {
    try {
      const job = await runCollection({
        region,
        periodDays: 90,
        keyword: "매물",
        trigger: "cron",
        light: true, // 지역당 3쿼리×1페이지로 쿼터 절약
      });
      results.push({ region, found: job.found, processed: job.processed, failed: job.failed });
    } catch (e: any) {
      results.push({ region, error: String(e?.message || e) });
    }
  }

  await saveState({ nextIndex, lastRunAt: new Date().toISOString() });

  return {
    processedRegions: batch,
    nextRegion: regions[nextIndex],
    progress: `${nextIndex}/${regions.length}`,
    results,
  };
}
