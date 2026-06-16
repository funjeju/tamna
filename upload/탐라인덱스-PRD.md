# 탐라인덱스 (TamnaIndex) — 제품 요구사항 명세서 (PRD)

> 제주 부동산 유튜브 매물 영상을 수집·표준화·지도화해 한 곳에서 검색·비교하게 만드는 플랫폼
> "지도가 곧 인덱스"

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 (MVP 스펙) |
| 작성 관점 | PM / 그로스 + 부동산 중개 |
| 대상 스택 | Vercel (Next.js) + Firebase (Auth · Firestore · Functions · Storage) |
| 1차 시장 | 제주 전역 (제주시·서귀포시 읍면동) |
| 핵심 외주 | SocialKit (유튜브 검색·자막·요약), 카카오맵 (지도·지오코딩), Claude (표준 구조화) |
| 상태 | 개발 착수 전 스펙 확정 단계 |

---

## 1. 제품 정의

### 1.1 한 줄 정의
제주의 흩어진 유튜브 매물 영상을 **수집 → 자막 추출 → 부동산 표준 구조화 → 지오코딩 → 검수 → 게시**의 파이프라인으로 색인화하고, 지도 한 장과 직관적 검색으로 일원화한다.

### 1.2 핵심 베팅 (Thesis)
- **가치는 검색이 아니라 색인(structured corpus)에 있다.** 유튜브가 영상 내용을 텍스트로 색인하지 않기 때문에 매물이 안 보이는 것이지, 검색 알고리즘이 부족한 게 아니다.
- **해자 = 색인의 완전성 · 신선도 · 추출 정확도 · 중개사 공급망.** LLM·지도는 누구나 쓰므로 차별점이 아니다.
- **첫 시장은 제주, 첫 수요자는 육지인(외지인).** 영상으로만 매물이 도는 시장 + 비대면으로 사야 하는 수요자가 겹치는 지점.

### 1.3 비전 (확장)
제주에서 검증 → 강원·남해·경주 등 "영상 중심 + 외지인 수요" 지역으로 동일 엔진 확장.

---

## 2. 배경 / 문제 정의

| # | 문제 | 영향 받는 주체 |
|---|---|---|
| P1 | 유튜브는 영상 기반이라 키워드 검색으로 매물 정보를 놓침 (자막·발화는 색인 안 됨) | 수요자 |
| P2 | 매물 정보가 채널·영상·블로그·스레드로 파편화, 표준 포맷 없음 → 비교 불가 | 수요자 |
| P3 | 지도로 모아 보는 경험 부재 | 수요자(특히 외지인) |
| P4 | 신규·로컬 채널은 노출 구조상 불리 (대형 채널·애그리게이터 우위) | 공급자(중개사) |
| P5 | 외지인은 현장 방문이 어려워 비대면 의사결정 정보가 부족 | 수요자(육지인) |

> 근거: 외지인 제주 주택 매입 반등(읍면 단독·세컨하우스 선호), 한달살기 시장 성숙, 유튜브 부동산 콘텐츠 의존 심화 등은 시장 리서치에서 확인됨. (상세 수치·출처는 별도 리서치 노트 참조)

---

## 3. 타깃 사용자 / 페르소나

### 3.1 수요자 (Primary)
- **육지인 세컨하우스/이주 검토자** — 서울·수도권 거주, 제주 읍면 단독·전원주택·구옥 관심, 현장 방문 어려움. 비대면 정보·원격 임장·이주 맥락이 필요.
- **제주 실거주/투자자** — 토지·상가·아파트. 매물 비교와 신선도가 중요.

### 3.2 공급자
- **제주 중개사 / 부동산 유튜브 채널** — 영상은 올리지만 노출·전환이 약함. 추가 노출 채널을 원함. (동의 기반 노출, 옵트아웃 가능해야 참여)

### 3.3 운영자 (Admin) — 본 문서 핵심
- 수집·검수·게시·정산을 관리. 신뢰(허위·과장 차단)와 신선도(매일 자동수집)를 책임.

---

## 4. 성공 지표 (KPI)

| 단계 | 지표 | 목표(예시) |
|---|---|---|
| 색인 품질 | 표준 구조화 정확도(가격·면적·위치·용도) | ≥ 90% (Phase 0 채점) |
| 색인 규모 | 게시 매물 수 / 신선도(7일내 신규 비율) | 제주 ≥ 300건 / ≥ 20% |
| 수요 | 저장검색·찜·알림 활성 사용자, 매물 상세 조회 | — |
| 전환 | 원격 임장 예약 수, 중개사 문의(리드) 수 | — |
| 공급 | 참여 중개사·채널 수, 옵트아웃율 | 옵트아웃 < 5% |
| 운영 | 드래프트→게시 처리 시간, 수집 실패율 | 실패율 < 5% |

---

## 5. 시스템 아키텍처

### 5.1 구성 (Vercel + Firebase)
```
[스케줄러] Cloud Functions (Scheduled, 매일 08:00 KST)
     │  ① 수집 트리거 (가벼움: videoId 목록만)
     ▼
[소스] SocialKit YouTube Search  /  YouTube Data API search.list(order=date, publishedAfter)
     │  → 후보 videoId + 메타
     ▼
[큐] Cloud Tasks  (건별 비동기, 재시도·실패격리)
     ▼
[워커] Cloud Functions (background)
     │  ② SocialKit /youtube/transcript → 자막
     │  ③ Claude 구조화 (tool use, 스키마 강제) → 표준 JSON
     │  ④ 카카오 지오코딩 → 좌표(geohash)
     │  ⑤ Firestore 저장 (status=draft)
     ▼
[DB] Firestore  +  Cloud Storage(썸네일)
     ▼
[프런트] Next.js @ Vercel
     ├─ 공개(사용자) : 지도·검색·테마·마이·원격임장
     ├─ 운영(어드민) : 수집콘솔·검수큐·게시관리·중개사관리
     └─ 중개사 포털(2차)
[인증] Firebase Auth (어드민/중개사/사용자 role)
```

### 5.2 스택 결정 노트 (Firebase 트레이드오프 — 반드시 설계 반영)
- **반경검색 없음** → `geohash` 필드 + geofire 방식 또는 MVP는 `region`/bounding-box로 단순화. draw-search는 geohash 전제.
- **복합 정렬 제약** → 정렬키(`priceManwon`, `publishedAt`, `priceDropAt`)별 복합 인덱스 사전 설계.
- **전문검색 약함** → 1차는 `keywords[]` `array-contains` + 필터. 2차 본격 검색은 Algolia/Typesense 연동 전제.
- **무거운 작업 분리** → 수집(가벼움)과 구조화(LLM·비동기)를 반드시 큐로 분리. 동기 호출 금지(한 건 실패가 전체를 막음).

---

## 6. 데이터 모델 (Firestore)

### 6.1 `listings` (매물 = 영상 1건)
```
listings/{listingId}
  videoId            string   // unique, 중복수집 차단키
  videoUrl           string
  thumbnailUrl       string   // 유튜브 thumbnail (i.ytimg.com) — 핫링크/캐시
  channelId          ref → agents
  publishedAt        timestamp// 영상 게시일 (정렬·기간필터)
  collectedAt        timestamp
  // ── 표준 구조화 결과 ──
  propertyType       enum     // 단독주택|토지|상가|아파트|전원주택|상가주택|빌라|기타
  dealType           enum     // 매매|전세|월세|임대|경매
  priceText          string   // "6억 8,000만원"
  priceManwon        number   // 정렬·필터용 (매매가 또는 보증금)
  priceHistory       array    // [{manwon, at}] 가격인하 추적
  areaM2             number|null
  areaPyeong         number|null
  zoning             string|null
  addressText        string   // 추출 주소(부정확할 수 있음)
  region             string   // 정규화 읍면동
  lat,lng            number
  geohash            string
  summary            string   // 표준 2~3문장
  highlights         array    // ["주차2대","바다뷰","신축"]
  keywords           array    // 검색 키워드
  extractionSource   enum     // ai|fallback
  confidence         number   // 추출 신뢰도(0~1), 낮으면 검수 우선
  // ── 운영 ──
  status             enum     // collected|structuring|draft|published|rejected|opted_out|error
  reviewedBy         string|null
  publishedAt2       timestamp|null
  takedownAt         timestamp|null
  themes             array    // 세컨하우스|한달살기|구옥|바다뷰|급매 (자동+수동 태깅)
  createdAt, updatedAt
```

### 6.2 `agents` (중개사 / 채널)
```
agents/{agentId}
  channelId, channelName, channelUrl
  name, regNo(등록번호), office, expertise, phone
  verified           bool     // 게시 전 신원·자격 게이트 (컴플라이언스)
  optedOut           bool     // true면 수집·게시 영구 제외
  plan               enum     // free|featured|premium (수익단계)
  createdAt
```

### 6.3 `savedSearches` / `favorites` / `alerts`
```
savedSearches/{id}  userId, query(filters json), alertFreq(instant|daily|off), lastNotifiedAt
favorites/{id}      userId, listingId, savedAt, notifyPriceDrop(bool)
alerts/{id}         userId, type(new_listing|price_drop|status_change), listingId|searchId, sentAt, read
```

### 6.4 `collectionJobs` (수집 로그 / 운영 가시성)
```
collectionJobs/{id}  trigger(cron|manual), from, to, region, found, processed, failed,
                     items[{videoId, step, source, status}], startedAt, finishedAt
```

### 6.5 `optOutList`
```
optOutList/{videoId|channelId}  reason, requestedBy, at   // 재수집 제외 블랙리스트
```

---

## 7. 핵심 플로우 / 상태머신

```
collected ──▶ structuring ──┬─(성공)─▶ draft ──승인──▶ published ──노출중단──▶ opted_out
                            └─(실패)─▶ error ──재시도──▶ structuring
draft ──반려──▶ rejected
published ──가격변동 감지──▶ priceHistory 갱신 + price_drop 알림
opted_out / rejected ──▶ 재수집 시 자동 제외 (optOutList 조회)
```

- **게시 게이트(컴플라이언스)**: `published`로 가려면 `agents.verified == true` + 필수필드(가격·면적·위치·등록번호) 충족.
- **신뢰 우선순위**: `confidence` 낮거나 `extractionSource==fallback`이면 검수 큐 상단 정렬.

---

## 8. 기능 명세 — 어드민 (★ 핵심)

> 운영자가 "매일 적은 노력으로 신선하고 믿을 수 있는 색인"을 유지하는 게 목표. 운영 효율과 신뢰 통제가 1순위.

### 8.1 대시보드
- 오늘 수집/검수/게시 카운트, 신선도 게이지, 수집 실패 알림, 옵트아웃 추이.
- 최근 `collectionJobs` 타임라인 (크론 실행 결과 한눈에).

### 8.2 수집 콘솔
- **입력**: 기간(publishedAfter/Before), 지역 키워드(읍면동 멀티선택), 매물유형 프리셋.
- **액션**: `매물 수집`(수동 실행), `크론 설정`(스케줄·키워드 세트 관리).
- **실시간 로그**: 검색 N건 → 자막(SocialKit) → AI 구조화 → 드래프트 생성, 단계별 표시. 실패 건은 사유 노출 + 재시도 버튼.
- **중복/옵트아웃 자동 스킵** 표시.

### 8.3 검수 큐 (드래프트) — 운영 핵심 화면
- 카드 = 썸네일 + 표준필드 + 원본영상 링크 + `AI구조화/폴백` 배지 + `confidence`.
- **인라인 수정**: 가격·면적·위치·요약·키워드·테마 즉시 편집(추출 오류 교정).
- **지도 핀 위치 보정**: 지오코딩이 부정확하면 핀 드래그로 좌표 수정.
- 액션: `승인·게시` / `반려` / `중개사 미검증 → 검증요청`.
- **배치 처리**: 다중 선택 후 일괄 승인/반려. 정렬: 신뢰도↓ / 신규순 / 지역.
- 필수필드 미충족 시 게시 버튼 비활성 + 사유 표시.

### 8.4 게시 매물 관리
- 게시 목록 검색·필터, `노출 중단·삭제(옵트아웃)` → 즉시 takedown + `optOutList` 등록 → 재수집 제외.
- 가격변동 수동 갱신, 테마 재태깅, 중복 병합.

### 8.5 중개사 / 채널 관리
- 채널 등록·`verified` 토글(등록번호·자격 확인), 채널 단위 옵트아웃, plan(free/featured/premium) 설정.

### 8.6 정산·광고 (수익 단계)
- 유료노출 슬롯 관리, 리드 카운트·과금 내역, 노출 우선순위 규칙.

### 8.7 권한 (RBAC)
- `superadmin`(전체) / `editor`(검수·게시) / `viewer`(읽기). Firebase Auth custom claims.

---

## 9. 기능 명세 — 공개(사용자)

### 9.1 홈 / 지도
- 카카오맵 풀스크린, 게시 매물 핀(유형별 색/아이콘), 클러스터링.
- **draw search**: 지도에 영역 그려 그 안 매물만 필터(geohash).
- 핀 클릭 → 미니 카드(썸네일·가격·유형·중개사) → 상세.

### 9.2 매물 검색 / 리스트
- **정렬**: 최신순 · 가격↑ · 가격↓ · 면적순 · **가격인하순** · 방금 게시.
- **필터**: 유형 / 거래유형 / 가격대 / 면적 / 읍면동 / 용도지역 + **영상 키워드 칩**(바다뷰·돌담·주차·신축·급매).
- **자연어 검색**: "애월 바다 보이는 2억대 구옥" → 색인된 자막·키워드 의미 매칭.

### 9.3 매물 상세
- 유튜브 임베드(재호스팅 금지) + 표준 요약·필드·하이라이트 + 지도 위치 + **중개사 소개 일원화**(채널·등록번호·전문분야·연락) + `원격 임장 예약` CTA + 찜/공유.

### 9.4 마이 (재방문 엔진)
- 저장검색(필터 저장) + 알림 주기(즉시·일간·끔), 찜 목록 + 가격인하 추적, 알림함.

### 9.5 테마 컬렉션
- 세컨하우스 / 한달살기 / 돌집·구옥 / 바다뷰 / 읍면 단독 / 급매 — 큐레이션 진입점.

### 9.6 중개사 디렉토리
- 채널별 소개·매물 모음·`verified` 배지.

### 9.7 이주/정착 가이드 (육지인 특화)
- 학교·병원·교통·생활 인프라 등 영상에 안 나오는 맥락 콘텐츠.

---

## 10. 기능 명세 — 중개사 포털 (Phase 2)
- 셀프 채널 등록·동의(옵트인/아웃), 내 매물 현황, 유료노출 구매, 리드 확인.

---

## 11. UX / UI 설계

### 11.1 디자인 토큰 (제주 — 현무암·바다·감귤)
```
--basalt   #20282b   (텍스트/다크)
--paper    #eef0ec   (배경, 바다안개)
--sea      #176b6b   (인터랙션 1차)
--tangerine#e2702a   (게시·라이브·시그니처, 절제 사용)
--stone    #b9c2bd   (하어라인/돌담)
--muted    #5d665f
폰트: 본문 Pretendard / 데이터·가격·좌표 모노스페이스(정형 인덱스 톤)
```

### 11.2 썸네일 카드 (수집물의 핵심 표현 — 요청 반영)
- 16:9 유튜브 썸네일 상단 + 좌상단 유형 배지 + 우상단 가격인하 뱃지(있을 때).
- 본문: 제목 1~2줄 · `가격(모노, 강조)` · 유형/거래 pill · 위치(감귤색) · 키워드 해시.
- 하단: 중개사 한 줄 + 게시일 + `▶ 영상` · 찜.
- 상태별 시각 신호: 드래프트(점선 테두리) / 게시(감귤 좌측 바) / 가격인하(뱃지).
- 호버: 살짝 떠오르며 그림자, 클릭 → 상세. 지도 카드 ↔ 핀 연동(카드 클릭 시 핀 포커스).

### 11.3 화면 인벤토리
| 영역 | 화면 |
|---|---|
| 공개 | 홈/지도 · 검색리스트 · 매물상세 · 테마 · 마이(저장검색/찜/알림) · 중개사디렉토리 · 원격임장예약 · 이주가이드 · 로그인 |
| 어드민 | 대시보드 · 수집콘솔 · 검수큐 · 게시관리 · 중개사관리 · 정산(2차) · 설정/권한 |
| 중개사(2차) | 채널등록 · 내매물 · 유료노출 · 리드 |

### 11.4 품질 바닥선
- 모바일 반응형(둘러보기는 모바일 우선), 키보드 포커스 가시화, prefers-reduced-motion 존중, 빈 상태/에러는 "다음 행동" 안내(사과·모호 금지).

---

## 12. 크론 · 자동수집 파이프라인 (요청 반영)

### 12.1 스케줄
- Cloud Functions Scheduled, 매일 08:00 KST(설정 가능). 키워드 세트 × 지역 × 직전 24~48시간(`publishedAfter`).

### 12.2 단계 (각 단계 멱등 · 재시도 가능)
1. **수집**: SocialKit Search / YouTube `search.list(order=date)` → 후보 videoId. `videoId` unique + `optOutList` 조회로 중복·거부 스킵. → Cloud Tasks 적재.
2. **자막**: SocialKit `/youtube/transcript`. 실패 시 재시도(backoff), 3회 초과 시 `error`.
3. **구조화**: Claude tool use(스키마 강제) → 표준 JSON. 실패 시 폴백 추출 + `confidence` 하향.
4. **지오코딩**: 카카오 주소→좌표→geohash. 실패 시 읍면동 중심 좌표 + 검수 플래그.
5. **썸네일**: 유튜브 thumbnail URL 저장(필요 시 Storage 캐시).
6. **저장**: `status=draft`, `collectionJobs`에 결과 기록.

### 12.3 운영 가시성·안전장치
- 모든 잡은 `collectionJobs`로 추적(found/processed/failed). 실패율 임계 초과 시 어드민 알림.
- 일일 SocialKit/LLM 호출 상한(쿼터·비용 가드), 레이트리밋.
- 저작권/ToS: 영상 재호스팅 금지(임베드만), `rawTranscript`는 캐시·만료(구조화 결과만 영구 보관).

---

## 13. 검색 · 정렬 · 필터 사양

| 구분 | 항목 |
|---|---|
| 정렬 | 최신순 · 가격↑ · 가격↓ · 면적순 · 가격인하순 · 방금게시 |
| 필터 | 유형 · 거래유형 · 가격대 · 면적 · 읍면동 · 용도지역 · 테마 · 영상키워드칩 |
| 지도 | draw search(영역) · 클러스터링 · 카드↔핀 연동 |
| 고급 | 자연어 검색(색인 자막 의미매칭) · 저장검색+알림(신규/가격인하) |
| 구현 | 1차 Firestore 인덱스+`array-contains`, 2차 Algolia/Typesense |

---

## 14. 수익모델 (단계적)

| 단계 | 모델 | 비고 |
|---|---|---|
| Phase 1 | **무료** (유동성·공급 우선) | 색인 규모·신선도부터 확보 |
| Phase 2 | 중개사 **유료 상위노출 / 프리미엄 매물**, **리드(문의) 과금**, `verified` 배지 | 양면 플랫폼 표준 BM |
| Phase 2 | 육지인 **원격 임장 중개 수수료**, **프리미엄 알림 구독** | 수요자 측 |
| Phase 3 | 이주·정착 제휴(인테리어·시공·이사·세컨하우스 업체) | 송객 수수료 |

> 원칙: 노출/순위는 유료라도 **검증·진위는 돈으로 못 사게** 한다(신뢰가 차별점).

---

## 15. 컴플라이언스 · 동의 · 저작권

- **동의/옵트아웃**: 중개사·소유자 요청 시 즉시 takedown + 재수집 제외. 채널 단위 옵트아웃 지원.
- **2026 개정법 대응**: 플랫폼 운영자의 게시자 신원·매물주 관계 확인 의무 → `verified` 게시 게이트. 필수정보 명시 의무 → 표준 포맷 필수필드 강제. 허위·과장 책임 → 검수 단계가 방어선.
- **저작권/ToS**: 영상 임베드만(재호스팅·다운로드 금지), 자막 전문 영구보관 회색지대 → 구조화 결과만 보관·rawTranscript 만료. YouTube/SocialKit API 약관 준수(데이터 보관·갱신 규칙 사전 검토 필요 — *오픈 이슈*).
- **개인정보**: 문의자·중개사 개인정보 처리 흐름 최소화·고지.

---

## 16. 비기능 요건
- 성능: 지도 첫 로드 < 2.5s, 리스트 페이지네이션, 썸네일 lazy-load.
- 신뢰성: 수집 실패율 < 5%, 잡 멱등·재시도.
- 보안: Auth role 기반 접근, 어드민 분리, API 키 서버사이드 보관.
- 접근성: 키보드·포커스·대비·reduced-motion.
- 비용 가드: SocialKit/LLM/지오코딩 호출 상한·모니터링.

---

## 17. 로드맵

| Phase | 범위 | 기간(예시) |
|---|---|---|
| **0 · 정확도 PoC** | 제주 실영상 30~50건 SocialKit→Claude 구조화→수기 채점(가격/면적/위치/용도). **게이트: 정확도 ≥ 90%** | 1~2주 |
| **1 · MVP** | Next.js+Firebase, 크론 자동수집, 검수큐, 게시관리, 옵트아웃, 지도·검색·정렬·필터, 썸네일 카드, 저장검색·찜·알림(기본) | 4~6주 |
| **2 · 확장** | 원격 임장, 테마 컬렉션 고도화, 중개사 포털·verified, 수익화(유료노출·리드), 외부검색엔진, 이주가이드 | — |

---

## 18. 리스크 / 미검증 변수
1. **한국어 부동산 영상 추출 정확도**(가격 단위·평/㎡·읍면동·사투리) — 사업 사활. Phase 0에서 반드시 채점.
2. **지오코딩 정밀도** — 영상에 정확 주소 없을 때 읍면동 단위만 가능 → 핀 보정 UX로 보완.
3. **SocialKit 비용·레이트리밋·안정성**의 스케일 검증.
4. **공급 콜드스타트** — 중개사 동의·영상 수 확보. 초기엔 공개 영상 색인 + 옵트아웃으로 시작.
5. **API 약관 적합성** — YouTube/SocialKit 데이터 보관·재호스팅 규정 법무 검토.

---

## 19. 오픈 퀘스천
- 수집 범위: 제주 전역 vs 1~2개 읍면동 집중(애월·조천 등)으로 시작?
- 자연어 검색을 Phase 1에 넣을지, 2로 미룰지(비용/복잡도).
- 원격 임장의 운영 주체(우리 중개 vs 중개사 연결만).
- `verified` 검증 절차의 수준(자율신고 vs 등록번호 실검증).

---

*본 문서는 개발 착수용 단일 스펙이며, Phase 0 정확도 결과에 따라 데이터모델·파이프라인이 조정될 수 있다.*
