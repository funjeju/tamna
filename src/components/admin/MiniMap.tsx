"use client";

import { useRef, useState, useCallback } from "react";
import {
  JEJU_OUTLINE_PATH,
  HALLASAN,
  JEJU_REGIONS,
  latLngToSvg,
  PROPERTY_PIN,
} from "@/lib/regions";
import { svgToLatLng } from "./lib/canPublish";
import type { PropertyType } from "@/lib/types";

interface MiniMapProps {
  lat: number;
  lng: number;
  propertyType: PropertyType;
  region?: string;
  onChange: (lat: number, lng: number) => void;
  onReset?: () => void;
}

/**
 * 제주도 미니 SVG 지도 + 드래그로 핀 보정 컴포넌트
 * - viewBox 0 0 1000 620 기준
 * - 마우스/터치 드래그로 핀 위치 수정 → onChange(lat, lng)
 */
export function MiniMap({
  lat,
  lng,
  propertyType,
  region,
  onChange,
  onReset,
}: MiniMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const pin = latLngToSvg(lat, lng);
  const pinInfo = PROPERTY_PIN[propertyType] ?? PROPERTY_PIN["기타"];

  const pointFromEvent = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    // SVG viewBox 0 0 1000 620
    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 620;
    return { x, y };
  }, []);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = pointFromEvent(clientX, clientY);
      const clampedX = Math.max(85, Math.min(925, x));
      const clampedY = Math.max(70, Math.min(590, y));
      const { lat: la, lng: ln } = svgToLatLng(clampedX, clampedY);
      onChange(la, ln);
    },
    [onChange, pointFromEvent],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    handleMove(e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    handleMove(e.clientX, e.clientY);
  };
  const endDrag = () => setDragging(false);

  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 620"
          className="w-full h-auto touch-none select-none cursor-crosshair rounded-md border border-stone/60 bg-paper"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endDrag}
          role="img"
          aria-label="제주도 지도 — 핀 드래그로 위치 보정"
        >
          {/* 배경 바다 */}
          <rect x="0" y="0" width="1000" height="620" fill="#eef0ec" />
          {/* 외곽 윤곽 */}
          <path
            d={JEJU_OUTLINE_PATH}
            fill="#ffffff"
            stroke="#b9c2bd"
            strokeWidth="2"
          />
          {/* 그라데이션 텍스처 */}
          <path
            d={JEJU_OUTLINE_PATH}
            fill="url(#jejuGrad)"
            opacity="0.5"
          />
          <defs>
            <radialGradient id="jejuGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#176b6b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#176b6b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 한라산 */}
          <circle
            cx={HALLASAN.x}
            cy={HALLASAN.y}
            r={HALLASAN.r}
            fill="none"
            stroke="#b9c2bd"
            strokeWidth="1.4"
            strokeDasharray="3 3"
          />
          <text
            x={HALLASAN.x}
            y={HALLASAN.y + 4}
            textAnchor="middle"
            fontSize="11"
            fill="#5d665f"
            fontWeight="500"
          >
            한라산
          </text>

          {/* 읍면동 라벨 (작게) */}
          {JEJU_REGIONS.filter((r) => r.name !== "한라산").map((r) => (
            <g key={r.name}>
              <circle cx={r.x} cy={r.y} r="2" fill="#b9c2bd" />
              <text
                x={r.x}
                y={r.y - 5}
                textAnchor="middle"
                fontSize="9"
                fill="#5d665f"
                opacity={region === r.name ? 1 : 0.55}
                fontWeight={region === r.name ? 700 : 400}
              >
                {r.name}
              </text>
            </g>
          ))}

          {/* 현재 핀 (드래그 가능) */}
          <g
            transform={`translate(${pin.x}, ${pin.y})`}
            style={{ cursor: dragging ? "grabbing" : "grab" }}
          >
            <circle
              r="11"
              fill={pinInfo.color}
              stroke="#ffffff"
              strokeWidth="2.5"
              opacity={dragging ? 1 : 0.92}
            />
            <text
              y="4"
              textAnchor="middle"
              fontSize="11"
              fill="#ffffff"
              fontWeight="700"
            >
              {pinInfo.emoji}
            </text>
            <circle r="20" fill={pinInfo.color} opacity="0.12" className="live-dot" />
          </g>
        </svg>
        <div className="absolute top-2 left-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-mono text-muted-jeju">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-jeju">
          <span className="text-foreground font-medium">지도를 드래그</span>
          하여 핀 위치를 보정하세요.
        </p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-sea hover:underline"
          >
            읍면동 중심으로 리셋
          </button>
        )}
      </div>
    </div>
  );
}
