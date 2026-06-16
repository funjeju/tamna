# Task 6-a — 공개 사이트 UI 컴포넌트 구현 (PublicApp 자체完結)

## 작업 범위
`src/components/public/` 폴더에 제주 부동산 유튜브 매물 플랫폼의 공개 사이트 UI 10개 파일 + 공통 포맷 유틸 1개 파일을 구현.

## 산출물
- `src/lib/public/format.ts` — formatPrice, formatArea, formatRelativeTime, isJustPublished, hasPriceDrop, lastPriceDrop, toggleFavorite, buildListingsQuery
- `src/components/public/PublicFooter.tsx` — sticky bottom footer (3컬럼)
- `src/components/public/Hero.tsx` — 홈 히어로 + 검색바 + 6 테마 빠른 진입 칩 + 통계 배지
- `src/components/public/JejuMap.tsx` — 커스텀 SVG (윤곽/한라산/읍면동/핀/클러스터/드래그 서치/툴팁)
- `src/components/public/ListingCard.tsx` — PRD 11.2 썸네일 카드 + Skeleton 변형
- `src/components/public/ListingGrid.tsx` — 반응형 그리드 + 로딩/빈/테마 추천 상태
- `src/components/public/SearchBar.tsx` — 검색/정렬/필터 팝오버(유형·거래·가격·면적·읍면동·테마·키워드) + 활성 칩
- `src/components/public/ThemeCollections.tsx` — 6 테마 카드 (모자이크 썸네일)
- `src/components/public/ListingDetail.tsx` — Dialog (YouTube 임베드 + 필드표 + 미니지도 + 중개사카드 + CTA)
- `src/components/public/MySheet.tsx` — Sheet + 3 탭 (찜/저장검색/알림함)
- `src/components/public/PublicApp.tsx` — 최상위 (header + view전환 + footer + dialog + sheet)

## 핵심 결정
- TanStack Query `useQuery` 사용 — QueryClientProvider는 메인 page.tsx에서 감쌈 (PublicApp 내부에 Provider 두지 않음)
- 모든 fetch는 상대 경로 (`/api/listings`, `/api/favorites`, `/api/dashboard`, `/api/listings/[id]`)
- shadcn/ui: Button, Card, Badge, Input, Select, Dialog, Sheet, Tabs, Popover, Checkbox, Slider, Switch, Separator, Skeleton, ScrollArea, Label, Tooltip
- framer-motion: 카드 hover, 뷰 전환, 모달 진입, 호버 툴팁
- 색 팔레트: sea(청록) / tangerine(감귤) / basalt / paper / stone — indigo/blue 미사용
- 상태: `view: 'home' | 'search'`, `selectedId`, `highlightId`, `filters`, `myOpen`, `headerQ`
- 상세 모달: 이미 로드된 listings에서 먼저 찾고, 없으면 `/api/listings/[id]` 폴백 fetch
- 마이 시트: 저장검색 localStorage 영속화(`tamna:saved-searches`), 찜은 TanStack Query로 관리
- 지도: `latLngToSvg()`로 핀 배치, region별 4개 초과시 클러스터, 마우스 드래그로 사각형 서치
- lint: `bunx eslint src/components/public/ src/lib/public/` — error 0, warning 0 통과

## 메인 page.tsx에서 사용법
```tsx
// src/app/page.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import PublicApp from '@/components/public/PublicApp'
// 운영자 사이트와 토글하려면 별도 state로 분기
// import AdminApp from '@/components/admin/AdminApp'

export default function Home() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <PublicApp />
    </QueryClientProvider>
  )
}
```

## Props / Export
- `PublicApp` — props 없음 (자체完結), default + named export
- `Hero`, `JejuMap`, `ListingCard`, `ListingGrid`, `SearchBar`, `ThemeCollections`, `ListingDetail`, `MySheet`, `PublicFooter` — 모두 default + named export
- 자체 내부 상태로 동작하며 page.tsx는 `<PublicApp />` 한 줄로 렌더링하면 됨
