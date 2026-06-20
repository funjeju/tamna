// TamnaIndex — Firestore 기반 데이터 어댑터.
// 기존 Prisma 호출부(라우트/seed)를 수정하지 않도록, 사용 중인 Prisma API 형태를
// 그대로 흉내 낸다. 데이터가 작아 컬렉션 전량 로드 후 메모리에서 필터/정렬한다.
import { adminDb } from "./firebase";

type Row = Record<string, any>;
type Where = Record<string, any>;
type OrderBy = Record<string, "asc" | "desc">;

const COL = {
  listing: "listings",
  agent: "agents",
  collectionJob: "collectionJobs",
  optOut: "optOuts",
  favorite: "favorites",
  savedSearch: "savedSearches",
} as const;

// ── Firestore 문서 → Prisma 유사 row (Timestamp → Date) ──
function deserialize(id: string, data: Row): Row {
  const out: Row = { id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === "function" ? v.toDate() : v;
  }
  return out;
}

// ── 컬렉션 전량 로드 캐시 (warm 인스턴스 내 짧은 TTL + 동시요청 dedupe) ──
// 한 요청이 같은 컬렉션을 여러 번(예: dashboard의 count 16회) 읽거나
// 짧은 시간 내 반복 요청 시 Firestore 전체 읽기를 줄인다. 쓰기 시 무효화.
const LOADALL_TTL_MS = 15_000;
const _cache = new Map<string, { at: number; rows: Row[] }>();
const _inflight = new Map<string, Promise<Row[]>>();

function bustCache(coll: string): void {
  _cache.delete(coll);
  _inflight.delete(coll);
}

async function loadAll(coll: string): Promise<Row[]> {
  const hit = _cache.get(coll);
  if (hit && Date.now() - hit.at < LOADALL_TTL_MS) return hit.rows;

  let p = _inflight.get(coll);
  if (!p) {
    p = adminDb
      .collection(coll)
      .get()
      .then((snap) => {
        const rows = snap.docs.map((d) => deserialize(d.id, d.data() as Row));
        _cache.set(coll, { at: Date.now(), rows });
        _inflight.delete(coll);
        return rows;
      })
      .catch((e) => {
        _inflight.delete(coll);
        throw e;
      });
    _inflight.set(coll, p);
  }
  return p;
}

async function getById(coll: string, id: string): Promise<Row | null> {
  const doc = await adminDb.collection(coll).doc(id).get();
  return doc.exists ? deserialize(doc.id, doc.data() as Row) : null;
}

// ── where 평가기 ──
function matchWhere(row: Row, where?: Where): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!Array.isArray(cond) || !cond.some((c) => matchWhere(row, c)))
        return false;
      continue;
    }
    if (key === "AND") {
      if (!Array.isArray(cond) || !cond.every((c) => matchWhere(row, c)))
        return false;
      continue;
    }
    const val = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      for (const [op, opv] of Object.entries(cond)) {
        if (op === "in") {
          if (!Array.isArray(opv) || !opv.includes(val)) return false;
        } else if (op === "notIn") {
          if (Array.isArray(opv) && opv.includes(val)) return false;
        } else if (op === "gte") {
          if (!(val != null && val >= opv)) return false;
        } else if (op === "lte") {
          if (!(val != null && val <= opv)) return false;
        } else if (op === "gt") {
          if (!(val != null && val > opv)) return false;
        } else if (op === "lt") {
          if (!(val != null && val < opv)) return false;
        } else if (op === "not") {
          if (val === opv) return false;
        } else if (op === "equals") {
          if (val !== opv) return false;
        } else if (op === "contains") {
          if (!String(val ?? "").includes(String(opv))) return false;
        }
      }
    } else if (val !== cond) {
      return false;
    }
  }
  return true;
}

function cmp(a: any, b: any, dir: "asc" | "desc"): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av < bv) return dir === "asc" ? -1 : 1;
  if (av > bv) return dir === "asc" ? 1 : -1;
  return 0;
}

function applyOrder(rows: Row[], orderBy?: OrderBy): Row[] {
  if (!orderBy) return rows;
  const [field, dir] = Object.entries(orderBy)[0];
  return [...rows].sort((a, b) => cmp(a[field], b[field], dir));
}

function newId(coll: string): string {
  return adminDb.collection(coll).doc().id;
}

// ── 관계(include) 부착 ──
async function attachAgentToListings(listings: Row[]): Promise<Row[]> {
  const agents = await loadAll(COL.agent);
  const byChannel = new Map(agents.map((a) => [a.channelId, a]));
  return listings.map((l) => ({ ...l, agent: byChannel.get(l.channelId) ?? null }));
}

async function listingCountByChannel(): Promise<Map<string, number>> {
  const listings = await loadAll(COL.listing);
  const m = new Map<string, number>();
  for (const l of listings) m.set(l.channelId, (m.get(l.channelId) ?? 0) + 1);
  return m;
}

// ── 모델별 API ──
const listing = {
  async findMany(args: {
    where?: Where;
    include?: { agent?: boolean };
    orderBy?: OrderBy;
    take?: number;
  } = {}) {
    let rows = (await loadAll(COL.listing)).filter((r) =>
      matchWhere(r, args.where),
    );
    rows = applyOrder(rows, args.orderBy);
    if (args.take != null) rows = rows.slice(0, args.take);
    if (args.include?.agent) rows = await attachAgentToListings(rows);
    return rows;
  },
  async findUnique(args: { where: { id: string }; include?: { agent?: boolean } }) {
    const row = await getById(COL.listing, args.where.id);
    if (!row) return null;
    if (args.include?.agent) return (await attachAgentToListings([row]))[0];
    return row;
  },
  async update(args: {
    where: { id: string };
    data: Row;
    include?: { agent?: boolean };
  }) {
    const data = { ...args.data, updatedAt: new Date() };
    await adminDb.collection(COL.listing).doc(args.where.id).set(data, { merge: true });
    bustCache(COL.listing);
    const row = await getById(COL.listing, args.where.id);
    if (args.include?.agent && row)
      return (await attachAgentToListings([row]))[0];
    return row;
  },
  async updateMany(args: { where?: Where; data: Row }) {
    const rows = (await loadAll(COL.listing)).filter((r) =>
      matchWhere(r, args.where),
    );
    const batch = adminDb.batch();
    for (const r of rows)
      batch.set(adminDb.collection(COL.listing).doc(r.id), args.data, {
        merge: true,
      });
    await batch.commit();
    bustCache(COL.listing);
    return { count: rows.length };
  },
  async count(args: { where?: Where } = {}) {
    return (await loadAll(COL.listing)).filter((r) => matchWhere(r, args.where))
      .length;
  },
  async create(args: { data: Row }) {
    const id = args.data.id ?? newId(COL.listing);
    const { id: _omit, ...rest } = args.data;
    await adminDb.collection(COL.listing).doc(id).set(rest);
    bustCache(COL.listing);
    return (await getById(COL.listing, id))!;
  },
};

const agent = {
  async findMany(args: {
    where?: Where;
    include?: { _count?: any };
    orderBy?: OrderBy;
  } = {}) {
    let rows = (await loadAll(COL.agent)).filter((r) =>
      matchWhere(r, args.where),
    );
    rows = applyOrder(rows, args.orderBy);
    if (args.include?._count) {
      const counts = await listingCountByChannel();
      rows = rows.map((a) => ({
        ...a,
        _count: { listings: counts.get(a.channelId) ?? 0 },
      }));
    }
    return rows;
  },
  async findUnique(args: { where: { id: string } }) {
    return getById(COL.agent, args.where.id);
  },
  async update(args: { where: { id: string }; data: Row; include?: { _count?: any } }) {
    await adminDb.collection(COL.agent).doc(args.where.id).set(args.data, {
      merge: true,
    });
    bustCache(COL.agent);
    const row = await getById(COL.agent, args.where.id);
    if (args.include?._count && row) {
      const counts = await listingCountByChannel();
      return { ...row, _count: { listings: counts.get(row.channelId) ?? 0 } };
    }
    return row;
  },
  async count(args: { where?: Where } = {}) {
    return (await loadAll(COL.agent)).filter((r) => matchWhere(r, args.where))
      .length;
  },
  async create(args: { data: Row }) {
    const id = args.data.id ?? newId(COL.agent);
    const { id: _omit, ...rest } = args.data;
    await adminDb.collection(COL.agent).doc(id).set(rest);
    bustCache(COL.agent);
    return (await getById(COL.agent, id))!;
  },
};

const collectionJob = {
  async findMany(args: { where?: Where; orderBy?: OrderBy; take?: number } = {}) {
    let rows = (await loadAll(COL.collectionJob)).filter((r) =>
      matchWhere(r, args.where),
    );
    rows = applyOrder(rows, args.orderBy);
    if (args.take != null) rows = rows.slice(0, args.take);
    return rows;
  },
  async count(args: { where?: Where } = {}) {
    return (await loadAll(COL.collectionJob)).filter((r) =>
      matchWhere(r, args.where),
    ).length;
  },
  async aggregate(args: { _sum?: Record<string, boolean> }) {
    const rows = await loadAll(COL.collectionJob);
    const _sum: Row = {};
    if (args._sum)
      for (const f of Object.keys(args._sum))
        _sum[f] = rows.reduce((s, r) => s + (r[f] ?? 0), 0);
    return { _sum };
  },
  async create(args: { data: Row }) {
    const id = args.data.id ?? newId(COL.collectionJob);
    const { id: _omit, ...rest } = args.data;
    await adminDb.collection(COL.collectionJob).doc(id).set(rest);
    bustCache(COL.collectionJob);
    return (await getById(COL.collectionJob, id))!;
  },
};

const optOut = {
  async upsert(args: { where: { key: string }; update: Row; create: Row }) {
    const snap = await adminDb
      .collection(COL.optOut)
      .where("key", "==", args.where.key)
      .limit(1)
      .get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      await doc.ref.set(args.update, { merge: true });
      bustCache(COL.optOut);
      return deserialize(doc.id, (await doc.ref.get()).data() as Row);
    }
    const id = newId(COL.optOut);
    await adminDb.collection(COL.optOut).doc(id).set(args.create);
    bustCache(COL.optOut);
    return (await getById(COL.optOut, id))!;
  },
  async count(args: { where?: Where } = {}) {
    return (await loadAll(COL.optOut)).filter((r) => matchWhere(r, args.where))
      .length;
  },
  async create(args: { data: Row }) {
    const id = args.data.id ?? newId(COL.optOut);
    const { id: _omit, ...rest } = args.data;
    await adminDb.collection(COL.optOut).doc(id).set(rest);
    bustCache(COL.optOut);
    return (await getById(COL.optOut, id))!;
  },
};

const favorite = {
  async findMany(args: {
    where?: Where;
    include?: { listing?: { include?: { agent?: boolean } } };
    orderBy?: OrderBy;
  } = {}) {
    let rows = (await loadAll(COL.favorite)).filter((r) =>
      matchWhere(r, args.where),
    );
    rows = applyOrder(rows, args.orderBy);
    if (args.include?.listing) {
      const listings = await loadAll(COL.listing);
      const withAgent = args.include.listing.include?.agent
        ? await attachAgentToListings(listings)
        : listings;
      const byId = new Map(withAgent.map((l) => [l.id, l]));
      rows = rows
        .map((f) => ({ ...f, listing: byId.get(f.listingId) ?? null }))
        .filter((f) => f.listing); // 매물 삭제된 찜은 제외
    }
    return rows;
  },
  async findUnique(args: {
    where: { userId_listingId: { userId: string; listingId: string } };
  }) {
    const { userId, listingId } = args.where.userId_listingId;
    const snap = await adminDb
      .collection(COL.favorite)
      .where("userId", "==", userId)
      .where("listingId", "==", listingId)
      .limit(1)
      .get();
    return snap.empty ? null : deserialize(snap.docs[0].id, snap.docs[0].data() as Row);
  },
  async delete(args: {
    where: { userId_listingId: { userId: string; listingId: string } };
  }) {
    const { userId, listingId } = args.where.userId_listingId;
    const snap = await adminDb
      .collection(COL.favorite)
      .where("userId", "==", userId)
      .where("listingId", "==", listingId)
      .limit(1)
      .get();
    if (!snap.empty) await snap.docs[0].ref.delete();
    bustCache(COL.favorite);
    return { count: snap.size };
  },
  async create(args: { data: Row }) {
    const id = args.data.id ?? newId(COL.favorite);
    const { id: _omit, ...rest } = args.data;
    if (!rest.savedAt) rest.savedAt = new Date();
    if (rest.userId == null) rest.userId = "guest";
    await adminDb.collection(COL.favorite).doc(id).set(rest);
    bustCache(COL.favorite);
    return (await getById(COL.favorite, id))!;
  },
  async count(args: { where?: Where } = {}) {
    return (await loadAll(COL.favorite)).filter((r) => matchWhere(r, args.where))
      .length;
  },
};

export const db = { listing, agent, collectionJob, optOut, favorite };
