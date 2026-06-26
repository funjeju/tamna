// 확장 엔진 골든케이스 — `npx tsx src/lib/decision/engine-extra.test.ts`
import { capitalGainsTax, giftTax, propertyTax, rentIncreaseCap, purchaseExtraCosts, ltSpecialDeductPct } from "./engine-extra";

let pass = 0, fail = 0;
const approx = (a: number, b: number, t: number, l: string) => (Math.abs(a - b) <= t ? pass++ : (fail++, console.log(`✗ ${l}: ${a} ~!= ${b}`)));
const eq = (a: number, b: number, l: string) => (a === b ? pass++ : (fail++, console.log(`✗ ${l}: ${a} !== ${b}`)));

eq(ltSpecialDeductPct(2), 0, "장특공제 2년");
eq(ltSpecialDeductPct(10), 20, "장특공제 10년");

const cg = capitalGainsTax({ acquireManwon: 30000, transferManwon: 50000, holdYears: 5 });
eq(cg.gainManwon, 20000, "양도차익");
eq(cg.ltsdManwon, 2000, "장특공제액");
approx(cg.totalManwon, 5226, 3, "양도세 총액");

const g = giftTax(20000, "lineal");
eq(g.taxableManwon, 15000, "증여 과세표준");
eq(g.taxManwon, 2000, "증여세");

const pt = propertyTax(60000);
eq(pt.baseManwon, 36000, "재산세 과표");
eq(pt.taxManwon, 81, "재산세");

const ri = rentIncreaseCap(30000);
eq(ri.capManwon, 31500, "전세 5% 인상상한");

const ex = purchaseExtraCosts(50000);
eq(ex.totalManwon, 155, "부대비용 합");

console.log(`\n결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
