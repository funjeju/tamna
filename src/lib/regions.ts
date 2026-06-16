// TamnaIndex — 제주 읍면동 지역 데이터 + 커스텀 SVG 지도 좌표

export interface JejuRegion {
  name: string;
  lat: number;
  lng: number;
  // SVG map 상의 정규화 좌표 (viewBox 0..1000 x, 0..620 y 기준)
  x: number;
  y: number;
  coast: "북" | "서" | "남" | "동" | "내륙";
  desc: string;
}

// 제주도 외곽 윤곽 (스타일라이즈드) — viewBox 0 0 1000 620
// 실제 지형의 bean-shape을 단순화한 경로
export const JEJU_OUTLINE_PATH =
  "M 250 95 " +
  "C 330 60, 440 55, 540 70 " +
  "C 640 80, 740 95, 810 140 " +
  "C 870 180, 905 250, 920 320 " +
  "C 930 380, 915 445, 875 490 " +
  "C 830 535, 760 565, 680 575 " +
  "C 600 585, 510 590, 420 580 " +
  "C 330 570, 245 555, 185 510 " +
  "C 130 470, 95 410, 85 340 " +
  "C 80 270, 110 200, 165 150 " +
  "C 195 122, 225 105, 250 95 Z";

// 한라산 (중심 산) — 지도상 표시용
export const HALLASAN = { x: 470, y: 310, r: 26 };

// 제주 주요 읍면동 (북서→남동 순)
export const JEJU_REGIONS: JejuRegion[] = [
  { name: "한경", lat: 33.34, lng: 126.20, x: 175, y: 360, coast: "서", desc: "서쪽 끝, 수월봉·저지오름" },
  { name: "한림", lat: 33.41, lng: 126.26, x: 230, y: 290, coast: "서", desc: "협재·금악, 해안 절경" },
  { name: "애월", lat: 33.47, lng: 126.33, x: 285, y: 230, coast: "북", desc: "바다뷰 단독·전원주택 밀집" },
  { name: "외도", lat: 33.49, lng: 126.43, x: 355, y: 205, coast: "북", desc: "제주시 근교 주거단지" },
  { name: "노형·연동", lat: 33.49, lng: 126.47, x: 405, y: 200, coast: "내륙", desc: "신제주 도심, 아파트·상가" },
  { name: "제주시", lat: 33.51, lng: 126.53, x: 460, y: 180, coast: "북", desc: "구제주 원도심, 상가·주택" },
  { name: "조천", lat: 33.56, lng: 126.80, x: 640, y: 150, coast: "북", desc: "함덕·김녕, 해변 전원주택" },
  { name: "구좌", lat: 33.51, lng: 126.86, x: 700, y: 200, coast: "동", desc: "세화·종달, 동쪽 해안 마을" },
  { name: "성산", lat: 33.46, lng: 126.94, x: 760, y: 260, coast: "동", desc: "성산일출봉 인근, 관광 매물" },
  { name: "표선", lat: 33.32, lng: 126.82, x: 705, y: 395, coast: "남", desc: "남동 해안, 한적한 마을" },
  { name: "남원", lat: 33.27, lng: 126.70, x: 615, y: 445, coast: "남", desc: "남원유원지, 바다뷰 매물" },
  { name: "서귀포", lat: 33.25, lng: 126.56, x: 470, y: 475, coast: "남", desc: "서귀포 원도심·법환" },
  { name: "중문", lat: 33.24, lng: 126.41, x: 365, y: 480, coast: "남", desc: "중문관광단지, 리조트 인근" },
  { name: "안덕", lat: 33.25, lng: 126.31, x: 280, y: 455, coast: "남", desc: "산방산·모슬포 방면" },
  { name: "대정", lat: 33.24, lng: 126.22, x: 215, y: 425, coast: "서", desc: "모슬포·가파도, 서남단" },
  { name: "한라산", lat: 33.36, lng: 126.53, x: 470, y: 310, coast: "내륙", desc: "도심 산 중턱 전원주택" },
];

// 지역 필터용 (한라산 제외)
export const REGION_NAMES = JEJU_REGIONS.filter((r) => r.name !== "한라산").map(
  (r) => r.name,
);

// 좌표 → SVG 위치 변환 (동적 핀용)
export function latLngToSvg(lat: number, lng: number): { x: number; y: number } {
  // 제주도 영역: lat 33.18~33.60, lng 126.15~126.96
  const minLat = 33.18;
  const maxLat = 33.60;
  const minLng = 126.15;
  const maxLng = 126.96;
  const x = ((lng - minLng) / (maxLng - minLng)) * 840 + 85;
  const y = 590 - ((lat - minLat) / (maxLat - minLat)) * 510 + 30;
  return { x, y };
}

// 유형별 핀 색/아이콘
export const PROPERTY_PIN: Record<
  string,
  { color: string; label: string; emoji: string }
> = {
  단독주택: { color: "#176b6b", label: "단독", emoji: "⌂" },
  전원주택: { color: "#2e8b57", label: "전원", emoji: "🌳" },
  빌라: { color: "#4a7c7c", label: "빌라", emoji: "▣" },
  아파트: { color: "#5d665f", label: "아파트", emoji: "█" },
  상가: { color: "#e2702a", label: "상가", emoji: "◐" },
  상가주택: { color: "#c8842a", label: "상가주택", emoji: "◑" },
  토지: { color: "#8b9d6b", label: "토지", emoji: "◇" },
  기타: { color: "#9aa3a0", label: "기타", emoji: "•" },
};
