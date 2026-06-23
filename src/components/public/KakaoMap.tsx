"use client";
// TamnaIndex — 카카오 지도 (실제 지도 타일 + 매물 핀)
// props 는 기존 JejuMap 과 동일하게 유지하여 호출부 변경 최소화.
import { useEffect, useRef, useState } from "react";
import { PROPERTY_PIN } from "@/lib/regions";
import { formatPrice } from "@/lib/public/format";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KakaoMapProps {
  listings: Listing[];
  onSelectListing: (id: string) => void;
  highlightId?: string | null;
  className?: string;
}

const KAKAO_KEY = (
  process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
)?.replace(/^﻿/, "").trim();
const JEJU_CENTER = { lat: 33.38, lng: 126.55 };

declare global {
  interface Window {
    kakao: any;
  }
}

function loadKakaoSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.kakao?.maps) return resolve(window.kakao);
    const finish = () => window.kakao.maps.load(() => resolve(window.kakao));
    const existing = document.getElementById("kakao-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "kakao-sdk";
    s.async = true;
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`;
    s.onload = finish;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── 편의시설 범례 정의 ──
// category: 카카오 카테고리 코드 / keyword: 카테고리에 없는 항목은 키워드 검색
// (버스정류장은 카테고리 코드가 없음 — SW8은 '지하철역'이라 제주에선 0건)
const AMENITIES = [
  { id: "HP8", label: "병원",     emoji: "🏥", color: "#e74c3c", category: "HP8" },
  { id: "SC4", label: "학교",     emoji: "🏫", color: "#3498db", category: "SC4" },
  { id: "PO3", label: "관공서",   emoji: "🏛️", color: "#8e44ad", category: "PO3" },
  { id: "MT1", label: "마트",     emoji: "🛒", color: "#27ae60", category: "MT1" },
  { id: "BUS", label: "버스정류장", emoji: "🚌", color: "#f39c12", keyword: "버스정류장" },
] as const;

type AmenityId = (typeof AMENITIES)[number]["id"];

export function KakaoMap({
  listings,
  onSelectListing,
  highlightId,
  className,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const pinElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const poiMarkersRef = useRef<Map<AmenityId, any[]>>(new Map());
  const tooltipRef = useRef<{ ov: any; tip: HTMLElement } | null>(null);
  const onSelectRef = useRef(onSelectListing);
  onSelectRef.current = onSelectListing;
  const [status, setStatus] = useState<"loading" | "ready" | "nokey" | "error">(
    KAKAO_KEY ? "loading" : "nokey",
  );
  const [activeAmenities, setActiveAmenities] = useState<Set<AmenityId>>(new Set());

  // 지도 초기화
  useEffect(() => {
    if (!KAKAO_KEY) return;
    let cancelled = false;
    loadKakaoSdk()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(JEJU_CENTER.lat, JEJU_CENTER.lng),
          level: 10,
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  // 핀(커스텀 오버레이) 렌더링
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    pinElsRef.current = new Map();

    const valid = listings.filter((l) => l.lat && l.lng);
    const bounds = new kakao.maps.LatLngBounds();

    for (const l of valid) {
      const pos = new kakao.maps.LatLng(l.lat, l.lng);
      bounds.extend(pos);
      const pin = PROPERTY_PIN[l.propertyType] ?? PROPERTY_PIN["기타"];

      const el = document.createElement("div");
      el.className = "tx-pin";
      el.title = `${l.title}\n${formatPrice(l.priceManwon, l.priceText)} · ${l.region}`;
      el.style.cssText = [
        "transform: translate(-50%, -50%)",
        "cursor: pointer",
        "width:14px",
        "height:14px",
        "border-radius:9999px",
        `background:${pin.color}`,
        "border:2px solid #fff",
        "box-shadow:0 1px 4px rgba(0,0,0,.35)",
      ].join(";");
      el.addEventListener("click", () => onSelectRef.current(l.id));

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 1,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
      pinElsRef.current.set(l.id, el);
    }

    if (valid.length > 0) {
      map.setBounds(bounds, 40, 40, 40, 40);
    }
  }, [listings, status]);

  // 강조(카드 hover) — 해당 핀만 깜박임 토글 (지도 이동 없음)
  useEffect(() => {
    for (const [id, el] of pinElsRef.current) {
      el.classList.toggle("tx-pin-pulse", id === highlightId);
    }
  }, [highlightId]);

  // 주변시설 마커 hover 시 이름 툴팁 (즉시 표시)
  const showPoiTip = (name: string, pos: any) => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    if (!tooltipRef.current) {
      const tip = document.createElement("div");
      tip.style.cssText = [
        "transform:translate(-50%,-165%)",
        "padding:3px 7px",
        "border-radius:6px",
        "background:rgba(20,20,20,.9)",
        "color:#fff",
        "font-size:11px",
        "line-height:1.2",
        "white-space:nowrap",
        "pointer-events:none",
        "box-shadow:0 1px 4px rgba(0,0,0,.35)",
      ].join(";");
      const ov = new kakao.maps.CustomOverlay({
        content: tip,
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: 6,
      });
      tooltipRef.current = { ov, tip };
    }
    tooltipRef.current.tip.textContent = name;
    tooltipRef.current.ov.setPosition(pos);
    tooltipRef.current.ov.setMap(map);
  };
  const hidePoiTip = () => tooltipRef.current?.ov.setMap(null);

  // 편의시설 토글
  const toggleAmenity = (amenityId: AmenityId) => {
    if (status !== "ready" || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    const next = new Set(activeAmenities);

    if (next.has(amenityId)) {
      // 끄기 — 마커 제거
      (poiMarkersRef.current.get(amenityId) ?? []).forEach((m) => m.setMap(null));
      poiMarkersRef.current.delete(amenityId);
      hidePoiTip();
      next.delete(amenityId);
    } else {
      // 켜기 — 제주 전역 거점 좌표 기준 반경 검색 (useMapBounds는 현재 화면만 커버해 누락 발생)
      next.add(amenityId);
      const amenity = AMENITIES.find((a) => a.id === amenityId)!;
      const ps = new kakao.maps.services.Places();
      const allMarkers: any[] = [];
      const seenIds = new Set<string>();

      // 제주 동/서/남/북 + 중심 거점 5곳 × 반경 20km → 제주 전역 커버
      const JEJU_CENTERS = [
        { lat: 33.4996, lng: 126.5312 }, // 제주시 중심
        { lat: 33.2541, lng: 126.5600 }, // 서귀포 중심
        { lat: 33.3887, lng: 126.2400 }, // 서부(한림)
        { lat: 33.4383, lng: 126.9200 }, // 동부(성산)
        { lat: 33.3300, lng: 126.7800 }, // 남동(표선)
      ];

      let pending = JEJU_CENTERS.length;

      const makeMarker = (place: any) => {
        if (seenIds.has(place.id)) return null;
        seenIds.add(place.id);
        const pos = new kakao.maps.LatLng(place.y, place.x);
        const el = document.createElement("div");
        el.style.cssText = [
          "transform:translate(-50%,-50%)",
          "width:22px","height:22px",
          "border-radius:9999px",
          `background:${amenity.color}`,
          "border:2px solid #fff",
          "box-shadow:0 1px 4px rgba(0,0,0,.3)",
          "display:flex","align-items:center","justify-content:center",
          "font-size:11px","cursor:pointer",
        ].join(";");
        el.title = place.place_name;
        el.textContent = amenity.emoji;
        // hover 시 이름 툴팁
        el.addEventListener("mouseenter", () => showPoiTip(place.place_name, pos));
        el.addEventListener("mouseleave", hidePoiTip);
        const overlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          yAnchor: 0.5, xAnchor: 0.5, zIndex: 2,
        });
        overlay.setMap(map);
        return overlay;
      };

      // 거점별 검색 — 카테고리 항목은 categorySearch, 키워드 항목(버스정류장)은 keywordSearch
      const runSearch = (center: { lat: number; lng: number }) => {
        let page = 1;
        const cb = (data: any[], st: string, pagination: any) => {
          if (st === kakao.maps.services.Status.OK) {
            for (const place of data) {
              const m = makeMarker(place);
              if (m) allMarkers.push(m);
            }
            if (pagination?.hasNextPage && page < 3) {
              page++;
              pagination.nextPage();
              return;
            }
          }
          // 이 거점 완료
          pending--;
          if (pending === 0) {
            poiMarkersRef.current.set(amenityId, allMarkers);
          }
        };
        const opts = {
          location: new kakao.maps.LatLng(center.lat, center.lng),
          radius: 20000, // 20km
          size: 15,
        };
        if ("keyword" in amenity) {
          ps.keywordSearch(amenity.keyword, cb, opts);
        } else {
          ps.categorySearch(amenity.category, cb, opts);
        }
      };

      for (const center of JEJU_CENTERS) {
        runSearch(center);
      }
    }
    setActiveAmenities(next);
  };

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-stone/60 bg-muted",
        className,
      )}
    >
      <div className="relative">
        <div ref={containerRef} className="min-h-[400px] w-full" />
        {status !== "ready" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/80 p-6 text-center text-sm backdrop-blur">
            {status === "loading" ? (
              <span className="text-muted-foreground">지도를 불러오는 중…</span>
            ) : status === "nokey" ? (
              <span className="max-w-sm text-muted-foreground">
                카카오 지도 키(<code>NEXT_PUBLIC_KAKAO_JS_KEY</code>)가 설정되지 않았습니다.
              </span>
            ) : (
              <span className="max-w-sm text-muted-foreground">
                지도를 불러오지 못했습니다. 카카오 개발자 콘솔에서 현재 도메인이 등록됐는지 확인하세요.
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* 편의시설 범례 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-stone/40 bg-background/80 px-3 py-2 backdrop-blur">
        <span className="text-[10px] text-muted-foreground shrink-0">주변시설</span>
        {AMENITIES.map((a) => {
          const active = activeAmenities.has(a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggleAmenity(a.id)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                active
                  ? "border-transparent text-white shadow-sm"
                  : "border-stone/50 bg-background text-muted-foreground hover:border-stone",
              )}
              style={active ? { backgroundColor: a.color } : undefined}
            >
              <span>{a.emoji}</span>
              {a.label}
            </button>
          );
        })}
        {activeAmenities.size > 0 && (
          <button
            onClick={() => {
              activeAmenities.forEach((id) => {
                (poiMarkersRef.current.get(id) ?? []).forEach((m) => m.setMap(null));
              });
              poiMarkersRef.current.clear();
              hidePoiTip();
              setActiveAmenities(new Set());
            }}
            className="ml-auto text-[10px] text-muted-foreground hover:text-basalt"
          >
            전체 해제
          </button>
        )}
      </div>
    </div>
  );
}

export default KakaoMap;
