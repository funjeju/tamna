// 일회성: 더미(시드) 매물 제거 + 수집된 실제 매물 게시
// 실행: node scripts/golive.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("./sa.json", import.meta.url)));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function run() {
  // 1) 모든 중개사 verified 처리 (게시 게이트 통과)
  const agents = await db.collection("agents").get();
  let av = 0;
  for (const d of agents.docs) {
    await d.ref.set({ verified: true }, { merge: true });
    av++;
  }
  console.log(`✓ agents verified: ${av}`);

  // 2) 시드(더미) 매물 삭제 — unsplash 썸네일은 전부 시드
  const listings = await db.collection("listings").get();
  let deleted = 0;
  let published = 0;
  for (const d of listings.docs) {
    const l = d.data();
    const isSeed =
      typeof l.thumbnailUrl === "string" &&
      l.thumbnailUrl.includes("images.unsplash.com");
    if (isSeed) {
      await d.ref.delete();
      deleted++;
      continue;
    }
    // 3) 수집된 실제 매물 게시
    if (l.status === "draft" && l.lat && l.lng) {
      await d.ref.set(
        {
          status: "published",
          reviewedBy: "auto",
          publishedAt2: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      published++;
    }
  }
  console.log(`✓ seed deleted: ${deleted}`);
  console.log(`✓ collected published: ${published}`);
}

run()
  .then(() => console.log("완료"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
