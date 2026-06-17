// SQLite(custom.db) → Firestore 일회성 데이터 이전
// 실행: node scripts/migrate.mjs
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("./sa.json", import.meta.url)));
initializeApp({ credential: cert(sa) });
const fdb = getFirestore();
const prisma = new PrismaClient();

const MAP = [
  ["listing", "listings"],
  ["agent", "agents"],
  ["collectionJob", "collectionJobs"],
  ["optOut", "optOuts"],
  ["favorite", "favorites"],
  ["savedSearch", "savedSearches"],
];

async function run() {
  for (const [model, coll] of MAP) {
    const rows = await prisma[model].findMany();
    let n = 0;
    // 500개 단위 배치 (데이터 적지만 안전하게)
    for (let i = 0; i < rows.length; i += 400) {
      const batch = fdb.batch();
      for (const r of rows.slice(i, i + 400)) {
        const { id, ...rest } = r; // Date는 firebase-admin이 Timestamp로 변환
        batch.set(fdb.collection(coll).doc(id), rest);
        n++;
      }
      await batch.commit();
    }
    console.log(`✓ ${coll}: ${n} docs`);
  }
  await prisma.$disconnect();
  console.log("완료");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
