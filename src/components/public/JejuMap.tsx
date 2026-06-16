"use client";
// TamnaIndex — 커스텀 SVG 제주도 지도
// - JEJU_OUTLINE_PATH + 읍면동 라벨 + 한라산 + 매물 핀(클러스터링/드래그 서치)
import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, MapPin, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HALLASAN,
  JEJU_OUTLINE_PATH,
  JEJU_REGIONS,
  PROPERTY_PIN,
  latLngToSvg,
} from "@/lib/regions";
import type { Listing, PropertyType } from "@/lib/types";
import { PROPERTY_TYPES } from "@/lib/types";
import {
  formatPrice,
  hasPriceDrop,
  isJustPublished,
} from "@/lib/public/format";
import { cn } from "@/lib/utils";

interface JejuMapProps {
  listings: Listing[];
  onSelectListing: (id: string) => void;
  highlightId?: string | null;
  className?: string;
}

interface DragRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PinItem {
  listing: Listing;
  x: number;
  y: number;
  color: string;
  just: boolean;
  drop: boolean;
}

interface ClusterItem {
  x: number;
  y: number;
  count: number;
  ids: string[];
  region: string;
}

export function JejuMap({
  listings,
  onSelectListing,
  highlightId,
  className,
}: JejuMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPin, setHoverPin] = useState<PinItem | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [draggedIds, setDraggedIds] = useState<Set<string> | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<PropertyType>>(new Set());
  const [showAll, setShowAll] = useState(true);

  // SVG client → viewBox 좌표 변환
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 620;
    return { x, y };
  }, []);

  // 핀 계산 — 유형 필터 적용 + 클러스터링
  const { pins, clusters } = useMemo(() => {
    const visible = listings.filter(
      (l) => !hiddenTypes.has(l.propertyType) && l.lat && l.lng,
    );
    const allPins: PinItem[] = visible.map((l) => {
      const { x, y } = latLngToSvg(l.lat, l.lng);
      const pin = PROPERTY_PIN[l.propertyType] ?? PROPERTY_PIN["기타"];
      return {
        listing: l,
        x,
        y,
        color: pin.color,
        just: isJustPublished(l),
        drop: hasPriceDrop(l),
      };
    });

    // region 기준 클러스터링 (4개 초과시)
    const byRegion = new Map<string, PinItem[]>();
    for (const p of allPins) {
      const key = p.listing.region || "기타";
      const arr = byRegion.get(key) ?? [];
      arr.push(p);
      byRegion.set(key, arr);
    }
    const pinsOut: PinItem[] = [];
    const clustersOut: ClusterItem[] = [];
    for (const [region, arr] of byRegion) {
      if (arr.length > 4) {
        const cx = arr.reduce((s, p) => s + p.x, 0) / arr.length;
        const cy = arr.reduce((s, p) => s + p.y, 0) / arr.length;
        clustersOut.push({
          x: cx,
          y: cy,
          count: arr.length,
          ids: arr.map((p) => p.listing.id),
          region,
        });
      } else {
        pinsOut.push(...arr);
      }
    }
    return { pins: pinsOut, clusters: clustersOut };
  }, [listings, hiddenTypes]);

  // 드래그 박스 내 핀 필터링
  const computeDraggedIds = useCallback(
    (rect: DragRect): Set<string> => {
      const minX = Math.min(rect.x0, rect.x1);
      const maxX = Math.max(rect.x0, rect.x1);
      const minY = Math.min(rect.y0, rect.y1);
      const maxY = Math.max(rect.y0, rect.y1);
      const inBox = pins.filter(
        (p) =>
          p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
      );
      return new Set(inBox.map((p) => p.listing.id));
    },
    [pins],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // 좌클릭만
      if (e.button !== 0) return;
      const pt = toViewBox(e.clientX, e.clientY);
      dragStart.current = pt;
      setDragRect({ x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y });
      setDraggedIds(null);
    },
    [toViewBox],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragStart.current) return;
      const pt = toViewBox(e.clientX, e.clientY);
      const rect: DragRect = {
        x0: dragStart.current.x,
        y0: dragStart.current.y,
        x1: pt.x,
        y1: pt.y,
      };
      setDragRect(rect);
      setDraggedIds(computeDraggedIds(rect));
    },
    [toViewBox, computeDraggedIds],
  );

  const handleMouseUp = useCallback(() => {
    dragStart.current = null;
    // 드래그 결과 유지(draggedIds 는 그대로 두고 사각형은 숨김)
    setDragRect(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragStart.current = null;
    setDragRect(null);
  }, []);

  const clearDragFilter = () => setDraggedIds(null);

  const toggleType = (t: PropertyType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  // 핀 강조 여부: 드래그 필터가 있으면 그 안만, highlightId면 그 핀만
  const isPinEmphasized = (id: string) => {
    if (draggedIds) return draggedIds.has(id);
    if (highlightId) return id === highlightId;
    return true;
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-stone/60 bg-gradient-to-br from-sea/5 via-paper to-paper",
        className,
      )}
    >
      {/* 컨트롤 — 우상단 */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-stone/60 bg-background/90 text-xs backdrop-blur"
          onClick={() => {
            setHiddenTypes(new Set());
            setDraggedIds(null);
            setShowAll(true);
          }}
        >
          <Maximize2 className="size-3.5" aria-hidden="true" />
          핀 모두 보기
        </Button>
        <div className="hidden items-center gap-1 md:flex">
          <Filter className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {PROPERTY_TYPES.map((t) => {
            const pin = PROPERTY_PIN[t] ?? PROPERTY_PIN["기타"];
            const hidden = hiddenTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={!hidden}
                aria-label={`${t} 핀 ${hidden ? "보이기" : "숨기기"}`}
                onClick={() => toggleType(t)}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] transition",
                  hidden
                    ? "border-stone/40 text-muted-foreground/60 opacity-50"
                    : "border-stone/60 bg-background text-basalt hover:opacity-80",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: pin.color }}
                />
                {pin.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 드래그 필터 배지 — 좌상단 */}
      <AnimatePresence>
        {draggedIds ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full border border-tangerine/60 bg-background/95 px-3 py-1 text-xs shadow-sm backdrop-blur"
          >
            <MapPin className="size-3.5 text-tangerine" aria-hidden="true" />
            <span>
              영역 내{" "}
              <span className="font-mono font-semibold text-basalt tabular">
                {draggedIds.size}
              </span>
              개 매물
            </span>
            <button
              type="button"
              onClick={clearDragFilter}
              aria-label="영역 필터 해제"
              className="rounded-full p-0.5 hover:bg-tangerine/10"
            >
              <X className="size-3" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 드래그 안내 — 좌하단 */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden items-center gap-1.5 rounded-md bg-basalt/70 px-2 py-1 text-[10px] text-paper backdrop-blur md:flex">
        <span className="live-dot size-1.5 rounded-full bg-tangerine" />
        지도를 드래그해 영역을 선택하면 해당 매물만 강조됩니다
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 1000 620"
        role="img"
        aria-label="제주도 매물 지도"
        className="block h-full w-full cursor-crosshair touch-none select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="jeju-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#176b6b" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#176b6b" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="jeju-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#eef0ec" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="halla-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b9c2bd" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#b9c2bd" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 바다 배경 */}
        <rect x="0" y="0" width="1000" height="620" fill="url(#jeju-sea)" />

        {/* 제주도 윤곽 */}
        <path
          d={JEJU_OUTLINE_PATH}
          fill="url(#jeju-land)"
          stroke="#b9c2bd"
          strokeWidth="1.5"
        />

        {/* 한라산 */}
        <circle cx={HALLASAN.x} cy={HALLASAN.y} r={HALLASAN.r + 12} fill="url(#halla-grad)" />
        <circle
          cx={HALLASAN.x}
          cy={HALLASAN.y}
          r={HALLASAN.r}
          fill="none"
          stroke="#5d665f"
          strokeOpacity="0.35"
          strokeWidth="1.4"
          strokeDasharray="3 3"
        />
        <text
          x={HALLASAN.x}
          y={HALLASAN.y + 4}
          textAnchor="middle"
          className="fill-muted-jeju"
          style={{ fontSize: "12px", fontWeight: 600 }}
        >
          한라산
        </text>

        {/* 읍면동 라벨 */}
        {JEJU_REGIONS.filter((r) => r.name !== "한라산").map((r) => (
          <text
            key={r.name}
            x={r.x}
            y={r.y - 16}
            textAnchor="middle"
            className="fill-muted-jeju"
            style={{ fontSize: "11px", fontWeight: 500 }}
            opacity={0.75}
          >
            {r.name}
          </text>
        ))}

        {/* 클러스터 (4개 초과 region) */}
        {clusters.map((c) => (
          <ClusterMarker
            key={c.region}
            cluster={c}
            onClick={() => {
              // 클러스터 클릭 시 첫 매물 오픈 (간단)
              if (c.ids[0]) onSelectListing(c.ids[0]);
            }}
          />
        ))}

        {/* 매물 핀 */}
        {pins.map((p) => {
          const emphasized = isPinEmphasized(p.listing.id);
          const isHighlight = highlightId === p.listing.id;
          return (
            <g
              key={p.listing.id}
              transform={`translate(${p.x}, ${p.y})`}
              className="cursor-pointer"
              onMouseEnter={(e) => {
                setHoverPin(p);
                setHoverPos(toViewBox(e.clientX, e.clientY));
              }}
              onMouseMove={(e) =>
                setHoverPos(toViewBox(e.clientX, e.clientY))
              }
              onMouseLeave={() => {
                setHoverPin(null);
                setHoverPos(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectListing(p.listing.id);
              }}
              opacity={emphasized ? 1 : 0.18}
            >
              {/* 강조 링 */}
              {isHighlight ? (
                <circle r="14" fill="none" stroke="#176b6b" strokeWidth="2" />
              ) : null}
              {/* 가격인하 링 */}
              {p.drop ? (
                <circle r="11" fill="none" stroke="#e2702a" strokeWidth="2" />
              ) : null}
              {/* 메인 핀 */}
              <motion.circle
                r={isHighlight ? 9 : 7}
                fill={p.color}
                stroke="#fff"
                strokeWidth="1.5"
                whileHover={{ scale: 1.18 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
              />
              {/* 방금 게시 live dot */}
              {p.just ? (
                <circle r="2.4" cx="0" cy="0" fill="#e2702a" className="live-dot" />
              ) : null}
            </g>
          );
        })}

        {/* 드래그 선택 사각형 */}
        {dragRect ? (
          <rect
            x={Math.min(dragRect.x0, dragRect.x1)}
            y={Math.min(dragRect.y0, dragRect.y1)}
            width={Math.abs(dragRect.x1 - dragRect.x0)}
            height={Math.abs(dragRect.y1 - dragRect.y0)}
            fill="#e2702a"
            fillOpacity="0.08"
            stroke="#e2702a"
            strokeOpacity="0.7"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            pointerEvents="none"
          />
        ) : null}
      </svg>

      {/* 호버 툴팁 — SVG 외부 DOM */}
      <AnimatePresence>
        {hoverPin && hoverPos ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-20 max-w-[220px] rounded-md border border-stone/70 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{
              left: `${(hoverPos.x / 1000) * 100}%`,
              top: `${(hoverPos.y / 620) * 100}%`,
              transform: "translate(12px, -50%)",
            }}
          >
            <div className="line-clamp-2 font-semibold text-basalt">
              {hoverPin.listing.title}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono font-bold tabular text-basalt">
                {formatPrice(hoverPin.listing.priceManwon, hoverPin.listing.priceText)}
              </span>
              <Badge
                className="border-transparent px-1.5 py-0 text-[10px] text-white"
                style={{ backgroundColor: hoverPin.color }}
              >
                {hoverPin.listing.propertyType}
              </Badge>
            </div>
            <div className="mt-0.5 text-tangerine">{hoverPin.listing.region}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              클릭하여 상세 보기
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ClusterMarker({
  cluster,
  onClick,
}: {
  cluster: ClusterItem;
  onClick: () => void;
}) {
  return (
    <g
      transform={`translate(${cluster.x}, ${cluster.y})`}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <circle r="18" fill="#176b6b" fillOpacity="0.12" />
      <circle r="14" fill="#176b6b" stroke="#fff" strokeWidth="2" />
      <text
        textAnchor="middle"
        y="4"
        style={{ fontSize: "12px", fontWeight: 700 }}
        className="fill-sea-foreground"
      >
        {cluster.count}
      </text>
      <text
        textAnchor="middle"
        y="28"
        style={{ fontSize: "10px" }}
        className="fill-muted-jeju"
      >
        {cluster.region}
      </text>
    </g>
  );
}

export default JejuMap;
