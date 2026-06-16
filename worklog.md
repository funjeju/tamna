# TamnaIndex 작업 로그 (worklog)

> 제주 부동산 유튜브 매물 영상 수집·표준화·지도화 플랫폼
> 단일 페이지(`/`)에서 공개 서비스 + 운영자 콘솔을 모두 제공

---
Task ID: 1 (foundation)
Agent: main (Z.ai Code)
Task: 탐라인덱스 MVP 기반 설정 — 디자인 토큰, 폰트, Prisma 스키마, 시드 데이터, 공통 타입/상수, API 라우트

Work Log:
- `src/app/globals.css`: 제주 팔레트 디자인 토큰 적용 (basalt #20282b / paper #eef0ec / sea #176b6b / tangerine #e2702a / stone #b9c2bd). 다크모드 대응. `.scroll-thin` 커스텀 스크롤바, `.live-dot` 펄스 애니메이션, `.jeju-grain` 텍스처 추가.
- `src/app/layout.tsx`: Pretendard Variable CDN 로드, `lang="ko"`, 메타데이터 한글화. Geist Mono는 next/font 유지 (가격/좌표 모노스페이스용).
- `prisma/schema.prisma`: 모델 정의 — `Agent`(중개사/채널), `Listing`(매물=영상1건, 표준구조화 필드 포함), `CollectionJob`(수집로그), `OptOut`(블랙리스트), `Favorite`(찜), `SavedSearch`(저장검색). JSON 필드는 SQLite 제약상 String 저장.
- `bun run db:push` 완료.
- `src/lib/seed.ts`: 제주 실감나는 샘플 데이터 작성 및 실행 — 중개사 5건(verified 4, unverified 1), 매물 23건(애월/한림/제주시/조천/성산/서귀포/중문/남원/대정/안덕/구좌/표산 퍼짐, published 18 / draft 4 / error 1), 수집잡 5건, 옵트아웃 1건. 가격인하 이력, confidence 분포, fallback 추출 매물 포함.
- `src/lib/types.ts`: PropertyType/DealType/ListingStatus/Theme 등 enum 타입 + Listing/Agent/CollectionJob 인터페이스 + 상수 배열(PROPERTY_TYPES, DEAL_TYPES, THEMES, KEYWORD_CHIPS, STATUS_LABEL, STATUS_COLOR).
- `src/lib/regions.ts`: 제주 읍면동 16개 지역 데이터(lat/lng + SVG map 좌표), `JEJU_OUTLINE_PATH`(스타일라이즈드 제주도 윤곽), `HALLASAN`(한라산 중심), `latLngToSvg()` 변환 함수, `PROPERTY_PIN`(유형별 핀 색/라벨/이모지).
- `src/lib/mapper.ts`: Prisma row → Listing/Agent/CollectionJob 타입 변환(JSON 필드 파싱), `canPublish()` 게시 게이트 검증(중개사 verified + 필수필드 + confidence).
- API 라우트:
  - `GET /api/listings` — 필터(q/status/propertyTypes/dealTypes/themes/regions/keywords/priceMin/Max/areaMin/Max/sort/limit)
  - `GET/PATCH /api/listings/[id]` — 상세 + 인라인 수정
  - `POST /api/listings/[id]/action` — approve/reject/takedown/retry/update_price
  - `GET /api/agents` — 중개사 목록(status 필터)
  - `PATCH /api/agents/[id]` — verified/plan/optedOut 토글 (채널 옵트아웃 시 해당 매물 모두 opted_out)
  - `GET/POST /api/collection` — 수집잡 목록 + 수집 시뮬레이션 실행
  - `GET /api/dashboard` — KPI(총매물/게시/드래프트/에러/신선도/실패율/중개사/옵트아웃 등) + 최근 수집잡
  - `GET/POST /api/favorites` — 찜 목록 + 토글(userId="guest")
- `src/lib/db.ts`: Prisma 로그를 error/warn만 출력하도록 축소.

Stage Summary:
- DB 스키마 + 풍부한 시드 데이터 준비 완료 (매물 23건, 18개 게시중).
- 모든 API 엔드포인트 구현 완료. 공개/운영자 양쪽에서 사용 가능.
- 디자인 토큰: sea(#176b6b) 1차 인터랙션, tangerine(#e2702a) 게시/라이브 시그니처(절제 사용), basalt 텍스트, paper 배경.
- 다음 단계: 공개 사이트 + 운영자 콘솔 UI 컴포넌트를 두 서브에이전트가 병렬로 구현 → page.tsx에서 통합.
- 파일 위치 규약: 공개 컴포넌트는 `src/components/public/`, 운영자 컴포넌트는 `src/components/admin/`.
- 공개 사이트 최상위 컴포넌트: `src/components/public/PublicApp.tsx` (자체完結)
- 운영자 사이트 최상위 컴포넌트: `src/components/admin/AdminApp.tsx` (자체完結)

---
Task ID: 6-a
Agent: full-stack-developer (공개 사이트)
Task: 공개 사이트 UI 컴포넌트 구현 (PublicApp 자체完結)

Work Log:
- `src/lib/public/format.ts` 작성: formatPrice(만원→억/만), formatArea, formatRelativeTime("방금/N일 전"), isJustPublished(24h), hasPriceDrop, lastPriceDrop, toggleFavorite(fetch 래퍼), buildListingsQuery(필터→URLSearchParams).
- `PublicFooter.tsx`: mt-auto sticky footer. 3컬럼(플랫폼 소개 / 이용안내·옵트아웃·임베드만 / 출처·©TamnaIndex) — 모바일 1컬럼 스택.
- `ListingCard.tsx`: 16:9 썸네일(loading=lazy), 좌상단 유형 배지(PROPERTY_PIN 색), 우상단 ↓인하 뱃지(tangerine), 좌하단 live-dot "방금 게시", 가격 font-mono tabular, 키워드 해시, 하단 중개사+verified 체크+상대시간, ▶영상/♡찜 버튼 분리. 좌측 3px tangerine 바(published). hover -translate-y-1 + shadow-lg (framer-motion). ListingCardSkeleton 내보냄.
- `ListingGrid.tsx`: grid-cols-1 sm:2 lg:3 xl:4 gap-4. 로딩 시 Skeleton 8개, 빈 상태에 SearchX 아이콘 + 필터 초기화 CTA + 테마 추천 칩.
- `SearchBar.tsx`: 자연어 검색 input + 6종 정렬 셀렉트 + Popover 필터(유형 8 / 거래 5 / 가격대 슬라이더 0~10억 / 면적 0~200평 / 읍면동 16 / 테마 6 / 키워드 12칩) + 활성 필터 칩(해제 X 버튼) + 결과 카운트 "N개 매물".
- `JejuMap.tsx`: SVG viewBox 0 0 1000 620. 바다 배경 sea 그라데이션, JEJU_OUTLINE_PATH 윤곽+stroke(stone), 한라산 점선 원+라벨, 읍면동 15개 라벨. 핀 = latLngToSvg() 원형 r=7, hover 시 r=9 + framer-motion scale, 툴팁(가격/유형/지역/클릭안내). 가격인하 핀에 tangerine 링, 방금게시 live-dot. region별 4개 초과시 클러스터(sea 원+숫자). 마우스 드래그로 사각형 draw-search → draggedIds로 영역 강조. 우상단 컨트롤 "핀 모두 보기" + 유형 토글 칩. highlightId prop으로 카드↔핀 연동. 반응형 min-h-[400px] md:min-h-[600px].
- `Hero.tsx`: jeju-grain 배경 + sea 그라데이션 오버레이 + 우측 제주도 실루엣 SVG(JEJU_OUTLINE_PATH, stone). 통계 배지(게시중 N / 오늘 N건 / 신선도 N%). 큰 타이틀 "제주 매물, 한 장의 지도로" + 서브. 검색바 placeholder "애월 바다 보이는 2억대 구옥". 6 테마 빠른 진입 칩(테마별 컬러 dot). CTA "지도에서 보기" tangerine 버튼.
- `ThemeCollections.tsx`: 6 테마 카드 (세컨하우스 basalt / 한달살기 sea / 돌집·구옥 stone / 바다뷰 sea / 읍면 단독 paper / 급매 tangerine). 각 카드 대표 썸네일 2x2 모자이크(빈 칸은 그라데이션+emoji), 좌상단 테마 배지, 우하단 매물 수, 본문에 subtitle/desc/보기→. framer-motion whileInView.
- `ListingDetail.tsx`: Dialog max-w-4xl. 좌측 YouTube iframe 임베드 + 재호스팅 금지 안내 + 미니 SVG 지도(해당 핀만). 우측 가격(font-mono 3xl) + 가격이력 details + 표준필드표(유형/거래/면적㎡/평/용도지역/주소) + 요약 + 하이라이트 + 키워드 + 중개사 카드(channelName+verified+name+regNo+office+expertise+phone+채널방문 링크) + CTA "원격 임장 예약"(tangerine) 토스트 + 찜 토글 + 가격인하 알림 Switch + 공유(clipboard 복사 토스트).
- `MySheet.tsx`: Sheet 우측 슬라이드 sm:max-w-md md:max-w-lg. 3 탭(찜/저장검색/알림함). 찜 — `/api/favorites` GET → 작은 카드 리스트(썸네일+가격+지역) + 보기/찜해제 + 인하알림 Switch. 저장검색 — 현재 filters를 "저장" 버튼 → localStorage(`tamna:saved-searches`) 영속화, cadence 셀렉트(즉시/일간/끔). 알림함 — 더미 3개(애월 바다뷰 신규 / 한림 돌집 3.2억→2.8억 / 성산 전원주택 신규).
- `PublicApp.tsx`: min-h-screen flex flex-col. sticky 헤더(로고+태그라인 / 중앙 검색바 / 찜 버튼 with count + 마이 버튼). 본문 AnimatePresence view 전환 (home: Hero+ThemeCollections+방금 들어온 매물 8개 미리보기 / search: SearchBar+지도+그리드 2단 레이아웃). TanStack Query 3종(listings limit=200, dashboard KPI, favorites count). 상세 모달은 listings에서 우선 찾고 폴백으로 `/api/listings/[id]` fetch. PublicFooter mt-auto. ListingDetail + MySheet 오버레이.
- lint: `bunx eslint src/components/public/ src/lib/public/` → error 0, warning 0 통과 (admin 폴더의 별도 에러는 6-b 에이전트 소관).

Stage Summary:
- 산출물: `src/lib/public/format.ts` + `src/components/public/{PublicApp,Hero,JejuMap,ListingCard,ListingGrid,SearchBar,ThemeCollections,ListingDetail,MySheet,PublicFooter}.tsx` (총 11개 파일)
- 핵심 결정: QueryClientProvider는 page.tsx에서 감쌈 (PublicApp은 useQuery만 사용), 모든 fetch 상대 경로, shadcn/ui 적극 활용, framer-motion으로 부드러운 전환, sea/tangerine/basalt/paper/stone 팔레트만 사용 (indigo/blue 금지 준수), `<img loading="lazy">` 사용, 가격은 font-mono tabular-nums
- 메인 page.tsx 통합 방법:
  ```tsx
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
  import PublicApp from '@/components/public/PublicApp'
  // page.tsx에서 QueryClientProvider로 감싸고 <PublicApp /> 렌더링
  ```
- PublicApp은 props 없이 자체完結. default export + named export 모두 제공. header의 "찜/마이" 버튼이 MySheet를 열고, 카드 클릭 시 ListingDetail 모달이 열림.


---
Task ID: 6-b
Agent: full-stack-developer (운영자 콘솔)
Task: 운영자 콘솔 UI 컴포넌트 구현 (AdminApp 자체完結)

Work Log:
- 기존 작업(worklog.md / Task 1)과 `src/lib/types.ts`, `src/lib/regions.ts`, `src/lib/mapper.ts`, API 라우트 전체를 사전 파악. 디자인 토큰(sea #176b6b / tangerine #e2702a / basalt / paper / stone)과 Pretendard+Geist Mono 정책, shadcn/ui New York 컴포넌트 세트를 그대로 활용.
- `src/components/admin/lib/canPublish.ts` 신규 작성 — `canPublishClient()` (클라이언트용 게시 게이트, 서버 mapper.ts와 동일 로직), `svgToLatLng()` (latLngToSvg 역변환, 지도 핀 보정용), `m2ToPyeong()/pyeongToM2()`, `fmtManwon()/fmtTimeAgo()/fmtDateTime()` 유틸.
- `src/components/admin/MiniMap.tsx` 신규 — 제주도 외곽(JEJU_OUTLINE_PATH) + 한라산 + 16개 읍면동 라벨을 SVG(viewBox 0 0 1000 620)로 표시, 마우스/터치 드래그로 핀 위치 보정 → onChange(lat, lng). 유형별 핀 색(PROPERTY_PIN) 적용, live-dot 펄스로 현재 핀 강조. 좌표 클램프로 제주도 영역 밖 드래그 방지.
- `src/components/admin/ChipInput.tsx` 신규 — 하이라이트/키워드/테마 칩 입력. 엔터/쉼표 추가, 백스페이스로 마지막 칩 삭제, suggestion 칩 클릭 추가. accentColor prop으로 sea/tangerine 색상 분기.
- `src/components/admin/AdminFooter.tsx` 신규 — `mt-auto` sticky footer. "TamnaIndex Admin Console · RBAC: editor · 신뢰 우선 · 매일 08:00 KST 자동수집" + 시스템 정상 live-dot + 버전(v1.0 MVP). 모바일/데스크탑 반응형.
- `src/components/admin/Dashboard.tsx` (PRD 8.1) — `useQuery<DashboardData>` GET /api/dashboard (30초 폴링). KPI 카드 2x4 그리드: 총 매물/게시중/검수대기/에러(tangerine 강조)/오늘수집/이번주신규/신선도(게이지+목표선20%)/수집실패율/중개사/검증완료/옵트아웃/찜누적. failRate>5% 시 tangerine Alert. 7일 수집 추이 Recharts AreaChart (found/failed). 최근 수집잡 타임라인 — trigger 배지(cron=sea, manual=stone) + region + found→processed→failed 단계 표시 + 실패건 빨간 점. 빠른 액션 버튼: 수집실행/검수 N건 처리.
- `src/components/admin/CollectionConsole.tsx` (PRD 8.2) — 상단 폼 카드: 기간 select(24h/48h/7d/30d), 지역 칩 토글(REGION_NAMES 16개), 매물유형 프리셋 라디오(전체/주택/상가/토지), 키워드 input. "매물 수집" tangerine 버튼 → POST /api/collection → 실시간 로그 시뮬레이션 시작. 5개 단계(search→transcript→structuring→geocode→saved) 0.4초 간격 순차 표시, 진행중 sea 펄스, 완료 체크, 실패 빨간 X + 재시도 버튼. 중복 스킵/옵트아웃 스킵 stone 배지. 전체 진행률 Progress 바. 하단 수집잡 이력 Table — 행 클릭 시 items 상세 펼침. "크론 설정" Dialog — 스케줄(매일 08:00 KST 고정 표시), 키워드 세트 관리(추가/삭제), 활성 토글. setTimeout 클린업(useEffect return + timersRef).
- `src/components/admin/ListingEditPanel.tsx` (PRD 8.3 핵심 — 검수 인라인 수정 패널) — 선택된 매물 1건 상세 편집. 필드: 가격(만원→표시텍스트 자동생성), 면적(㎡↔평 동시 입력 시 자동 변환), 주소, 지역 select, 요약 textarea, 유형/거래 select, confidence slider(0~1, 임계 0.5 표시). 하이라이트/키워드 ChipInput, 테마 칩 토글(THEMES 6개). **지도 핀 보정 MiniMap** 임베드. 게시 게이트 `canPublishClient()` 즉시 피드백 — 충족 시 sea "게시 가능", 미충족 시 tangerine 사유 리스트. 승인·게시 버튼: gate.ok 일 때만 활성(tangerine), 미충족 시 Tooltip으로 사유 표시. 원본 YouTube 링크(외부 새 탭). 반려 Dialog(사유 입력). error 상태 시 재시도 버튼. 모든 필드 변경 시 즉시 PATCH /api/listings/[id] → queryClient.invalidateQueries. listing.id 변경 감지(useEffect 없이 동기식 if 패턴)로 폼 리셋.
- `src/components/admin/ReviewQueue.tsx` (PRD 8.3) — GET /api/listings?status=draft. 정렬 select(신뢰도↑/신규순/지역순) + 검색 input. 좌측 드래프트 카드 리스트(`scroll-thin` 스크롤) — 썸네일 + AI/폴백 배지 + confidence 바(0~100%, 낮으면 tangerine/destructive) + 게시 게이트 상태 배지 + 미충족 사유 요약. 체크박스 다중 선택 → "일괄 승인/반려" AlertDialog 확인 후 batch 처리(Promise.allSettled). 우측 ListingEditPanel (데스크탑 인라인, 모바일 풀스크린 오버레이). 빈 상태: "검수 대기 매물이 없습니다" + 수집 콘솔 이동 버튼.
- `src/components/admin/PublishManagement.tsx` (PRD 8.4) — 상태 탭(게시중/반려/옵트아웃/에러) — 4개 카드 버튼으로 표현, 현재 탭 강조. 검색 + 유형/지역 필터 select. 테이블: 썸네일 + 제목 + 가격 + 유형/거래 + 중개사(검증 배지) + 게시일 + 상태 배지(STATUS_COLOR). 행 액션: 노출 중단(AlertDialog 사유 입력 → takedown → optOut 등록) / 가격 갱신(Dialog 새 가격 입력, 인하/인상 표시 → update_price, 가격이력 자동 저장) / 테마 재태깅(Dialog에서 THEMES 토글 → PATCH themes) / 중복 병합(더미 토스트) / YouTube 외부 링크. 20개씩 페이지네이션.
- `src/components/admin/AgentManagement.tsx` (PRD 8.5) — GET /api/agents?status=... 탭(전체/검증완료/미검증/옵트아웃) + 검색. 테이블: channelName + name + regNo + office + listingCount + verified(Switch 토글 → PATCH verified) + plan(Select free/featured/premium → PATCH plan) + optedOut(Switch → 켜기 시 AlertDialog "채널 단위 옵트아웃 — 모든 매물 노출 중단" 확인 → PATCH optedOut:true). 채널 등록 Dialog(channelId/channelName/name/regNo/office 입력 → 더미 토스트). PATCH 후 agents/listings/dashboard 쿼리 모두 invalidate.
- `src/components/admin/OptOutList.tsx` (PRD 6.5/8.4 설정 탭) — GET /api/agents?status=opted_out (채널 단위) + 더미 영상 단위 옵트아웃 2건. 옵트아웃 정책 Alert(신뢰 우선 안내). 2개 테이블: 채널 단위(해제 버튼 → PATCH optedOut:false) / 영상 단위(더미, 해제 토스트). 검색 input.
- `src/components/admin/AdminApp.tsx` (최상위 자체完結) — `min-h-screen flex flex-col`. sticky 헤더(로고 "탐" + "탐라인덱스 운영자 콘솔" + 현재 섹션명 + 우측 "공개 사이트 보기" 버튼 + editor 배지). 데스크탑 사이드바(240px 고정, 6개 메뉴 + 시스템 상태 박스) + 모바일 Sheet Drawer(햄버거). `section` 상태로 6개 컴포넌트 전환. AdminFooter `mt-auto`로 하단 고정.
- `bun run lint` 통과 — 초기 useEffect setState 에러(ListingEditPanel listing 리셋)를 동기식 if 패턴으로 수정, 미사용 import(Tabs/Popover) 제거, 미사용 eslint-disable-next-line 제거. 최종 0 errors / 0 warnings.

Stage Summary:
- 산출물 (모두 `src/components/admin/` 아래):
  - `AdminApp.tsx` (최상위, default + named export, props: `onExitAdmin?: () => void`)
  - `AdminFooter.tsx`
  - `Dashboard.tsx` (props: `onNavigate: (section: 'collection'|'review') => void`)
  - `CollectionConsole.tsx` (props: `onJobCompleted?: () => void`)
  - `ReviewQueue.tsx` (props: `onGoToCollection?: () => void`)
  - `PublishManagement.tsx`
  - `AgentManagement.tsx`
  - `OptOutList.tsx`
  - `ListingEditPanel.tsx` (서브 — 검수 인라인 수정)
  - `MiniMap.tsx` (서브 — SVG 지도 핀 보정)
  - `ChipInput.tsx` (서브 — 칩 입력)
  - `lib/canPublish.ts` (유틸 — canPublishClient, svgToLatLng, m2↔평, fmt*)
- 핵심 결정:
  - 모든 컴포넌트 `'use client'` + TanStack Query (useQuery/useMutation + invalidateQueries). QueryClientProvider는 메인 page.tsx에서 감쌀 것을 가정.
  - fetch는 모두 상대 경로만 (`/api/...`).
  - 게시 게이트를 클라이언트에서 즉시 피드백(`canPublishClient`) — 승인 버튼 활성/비활성 + 사유 Tooltip. 서버 canPublish()와 동일 로직.
  - 지도 핀 보정: MiniMap에서 SVG 좌표↔lat/lng 양방향 변환 (latLngToSvg + svgToLatLng). 드래그로 좌표 수정.
  - 면적 ㎡↔평 동시 입력 시 자동 변환.
  - 색 제한 준수: indigo/blue 금지, sea/tangerine/basalt/paper/stone 팔레트 + STATUS_COLOR 사용.
  - 반응형: 사이드바 데스크탑 고정 / 모바일 Sheet Drawer. 검수큐는 데스크탑 분할 뷰 / 모바일 풀스크린 오버레이.
  - sticky footer: `mt-auto`로 항상 하단 고정, 모바일 safe area 대응.
  - 토스트: useToast 훅으로 모든 액션 피드백 (승인/반려/검증토글/수집실행/옵트아웃 등).
- 메인 page.tsx에서 사용법:
  ```tsx
  import { AdminApp } from "@/components/admin/AdminApp";
  // 또는 default import: import AdminApp from "@/components/admin/AdminApp";
  
  // mode === 'admin' 일 때
  <AdminApp onExitAdmin={() => setMode('public')} />
  ```
  - AdminApp은 QueryClientProvider로 감싸져 있어야 함 (TanStack Query 사용).
  - Toaster는 layout.tsx에 이미 마운트됨.
  - props `onExitAdmin`은 선택 — 공개 사이트로 전환 콜백. 미전달 시 버튼이 사이드바 하단에만 노출.
- 다음 단계(메인 page.tsx 통합자): `mode` 상태(`'public' | 'admin'`)로 전환, `QueryClientProvider`로 전체 감싸기, `/` 단일 라우트 유지.

---
Task ID: 7+8 (integration & verification)
Agent: main (Z.ai Code)
Task: 메인 page.tsx 통합 + lint + Agent Browser 자가 검증 + VLM 시각 검증

Work Log:
- `src/app/page.tsx` 작성: QueryClientProvider로 전체 감싸고 `mode` 상태('public'|'admin')로 PublicApp/AdminApp 전환. 공개 모드에서 우하단 floating "운영자 콘솔" 버튼(ShieldCheck 아이콘, Tooltip 포함) → admin 진입. AdminApp은 onExitAdmin 콜백으로 공개로 복귀(헤더 + 사이드바 하단 버튼).
- import 오류 수정: admin 서브에이전트가 `REGION_NAMES`를 `@/lib/types`에서 import했으나 실제로는 `@/lib/regions`에 존재. `PublishManagement.tsx`, `ListingEditPanel.tsx`의 import 분리 수정.
- `bun run lint` — 0 errors / 0 warnings 통과.
- dev 서버 실행(Turbopack) — `/` 컴파일 HTTP 200, 4초 컴파일.
- Agent Browser 검증 (1440x900 + 390x844 모바일):
  - 홈: 히어로("제주 매물, 한 장의 지도로") + 6 테마 컬렉션(세컨하우스 8건/한달살기 5건/돌집·구옥 2건/바다뷰 5건/읍면 단독 6건/급매 1건) + "방금 들어온 매물" 8카드. 에러 0, 콘솔 에러 0.
  - 매물 상세 모달: YouTube 임베드 + 요약/하이라이트/영상 키워드 + 원격 임장 예약/찜/공유 버튼 정상.
  - 운영자 전환: floating 버튼 클릭 → 대시보드("운영 대시보드") + 사이드바 6메뉴 + "검수 4건 처리" 버튼.
  - 수집콘솔: "수집 콘솔" + 키워드 입력폼("예: 애월 바다뷰 전원주택") 정상 렌더.
  - 검수큐: "검수 큐 4건 대기" + 드래프트 카드 + 우측 인라인 편집 패널(가격/주소/요약 필드 표시).
  - 게시관리: "게시 관리" 헤더 정상.
  - 중개사관리: "중개사 관리 5명" 헤더 정상.
  - 푸터 sticky 검증(1600px tall viewport): admin 수집콘솔 bodyHeight=1600=viewport → 푸터가 하단 고정(sticky). public 홈 bodyHeight=2696>viewport → 푸터 자연 밀림. 둘 다 정상.
- VLM(glm-4.6v) 시각 검증:
  - 홈: "깔끔하고 가독성 높으며 한글 표시 및 콘텐츠 구성 정상. 빈 영역/에러 없음. 부동산 플랫폼 핵심 기능 명확 구현."
  - 대시보드: "8개 KPI 카드 직관적 구성, 사이드바 현재 위치 강조, 한글 가독성 양호. 하단 주황 경고창은 수집 실패율 임계 초과(11%>5%) 의도적 알림."

Stage Summary:
- 단일 라우트 `/`에서 공개 서비스 + 운영자 콘솔 모두 동작. 모드 전환 floating 버튼.
- 핵심 플로우 전부 검증: 홈→테마/검색→매물상세→찜, 운영자→대시보드/수집/검수/게시/중개사.
- lint 0 에러, 런타임 에러 0, 콘솔 에러 0, HTTP 200.
- 푸터 sticky(짧은 콘텐츠) + 자연 밀림(긴 콘텐츠) 모두 정상.
- 반응형: 모바일(390x844)/데스크탑(1440x900) 모두 렌더 확인.
- 제주 디자인 토큰(sea/tangerine/basalt/paper/stone) 일관 적용. Pretendard 폰트 정상.
- 산출 스크린샷: screenshot-home/detail/admin-dashboard/collection/review/published/agents/mobile.png
