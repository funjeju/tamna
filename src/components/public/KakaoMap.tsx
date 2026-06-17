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
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    s.onload = finish;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

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
  const onSelectRef = useRef(onSelectListing);
  onSelectRef.current = onSelectListing;
  const [status, setStatus] = useState<"loading" | "ready" | "nokey" | "error">(
    KAKAO_KEY ? "loading" : "nokey",
  );

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

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-stone/60 bg-muted",
        className,
      )}
    >
      <div ref={containerRef} className="h-full min-h-[400px] w-full" />

      {status !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-paper/80 p-6 text-center text-sm backdrop-blur">
          {status === "loading" ? (
            <span className="text-muted-foreground">지도를 불러오는 중…</span>
          ) : status === "nokey" ? (
            <span className="max-w-sm text-muted-foreground">
              카카오 지도 키(<code>NEXT_PUBLIC_KAKAO_JS_KEY</code>)가 설정되지
              않았습니다.
            </span>
          ) : (
            <span className="max-w-sm text-muted-foreground">
              지도를 불러오지 못했습니다. 카카오 개발자 콘솔에서 현재 도메인이
              등록됐는지 확인하세요.
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default KakaoMap;
