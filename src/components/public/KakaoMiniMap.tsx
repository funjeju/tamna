"use client";
// 상세 모달용 단일 위치 카카오 미니맵
import { useEffect, useRef, useState } from "react";

const KAKAO_KEY = (
  process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
)?.replace(/^﻿/, "").trim();

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

export function KakaoMiniMap({
  lat,
  lng,
  color = "#176b6b",
  className,
}: {
  lat: number;
  lng: number;
  color?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    KAKAO_KEY ? "loading" : "error",
  );

  useEffect(() => {
    if (!KAKAO_KEY || !lat || !lng) return;
    let cancelled = false;
    loadKakaoSdk()
      .then((kakao) => {
        if (cancelled || !ref.current) return;
        const pos = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(ref.current, { center: pos, level: 4 });
        const el = document.createElement("div");
        el.style.cssText = [
          "transform:translate(-50%,-50%)",
          "width:16px;height:16px;border-radius:9999px",
          `background:${color};border:3px solid #fff`,
          "box-shadow:0 1px 5px rgba(0,0,0,.4)",
        ].join(";");
        new kakao.maps.CustomOverlay({ position: pos, content: el, map, yAnchor: 0.5, xAnchor: 0.5 });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, color]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={ref} className="h-full w-full" />
      {status !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-[11px] text-muted-foreground">
          {status === "loading" ? "지도 불러오는 중…" : "지도를 표시할 수 없습니다"}
        </div>
      ) : null}
    </div>
  );
}

export default KakaoMiniMap;
