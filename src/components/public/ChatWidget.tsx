"use client";
// TamnaIndex — 매물 검색 챗봇 (플로팅)
// 자연어 질문 → /api/chat (Gemini 필터 추출 + 매물 조회) → 답변 + 매물 카드.
// 카드 클릭 시 기존 상세 모달(onOpenListing)로 연결.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PROPERTY_PIN } from "@/lib/regions";
import { formatPrice } from "@/lib/public/format";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  listings?: Listing[];
}

const SUGGESTIONS = [
  "애월 바다뷰 3억 이하",
  "한림 단독주택 매매",
  "급매 토지",
  "서귀포 전원주택",
];

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "안녕하세요! 제주 매물을 찾아드릴게요. 지역·가격·유형을 말씀해 주시면 딱 맞는 매물을 보여드려요.",
};

interface ChatWidgetProps {
  onOpenListing: (id: string) => void;
}

export function ChatWidget({ onOpenListing }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지마다 맨 아래로
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", content: q }]);
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q }),
        });
        const data = await res.json();
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.reply ?? "잠시 후 다시 시도해 주세요.",
            listings: Array.isArray(data.listings) ? data.listings : [],
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "검색 중 오류가 났어요. 잠시 후 다시 시도해 주세요." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "매물 도우미 닫기" : "매물 도우미 열기"}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full shadow-lg transition-all",
          "bg-sea text-sea-foreground hover:scale-105 hover:bg-sea/90",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "x" : "chat"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* 패널 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed bottom-24 right-5 z-40 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-stone/50 bg-background shadow-2xl"
            role="dialog"
            aria-label="매물 검색 도우미"
          >
            {/* 헤더 */}
            <div className="flex items-center gap-2 border-b border-stone/40 bg-sea px-4 py-3 text-sea-foreground">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">탐라 매물 도우미</p>
                <p className="text-[11px] opacity-80">검색된 매물만 알려드려요</p>
              </div>
            </div>

            {/* 메시지 */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scroll-thin p-3">
              {messages.map((m, i) => (
                <div key={i}>
                  <div
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                        m.role === "user"
                          ? "rounded-br-sm bg-sea text-sea-foreground"
                          : "rounded-bl-sm bg-paper text-basalt",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>

                  {/* 매물 카드 */}
                  {m.listings && m.listings.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.listings.map((l) => (
                        <ChatListingCard key={l.id} listing={l} onOpen={onOpenListing} />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-paper px-3 py-2.5">
                    <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                  </div>
                </div>
              )}

              {/* 첫 화면 추천 칩 */}
              {messages.length === 1 && !busy && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-sea/40 bg-sea/5 px-2.5 py-1 text-[11px] text-sea transition hover:bg-sea/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 입력 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-stone/40 p-2.5"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="예: 애월 바다뷰 3억 이하"
                aria-label="매물 검색 메시지"
                className="h-10 border-stone/60 bg-paper/60 text-[13px]"
                disabled={busy}
              />
              <Button
                type="submit"
                size="icon"
                className="size-10 shrink-0 bg-sea text-sea-foreground hover:bg-sea/90"
                disabled={busy || !input.trim()}
                aria-label="보내기"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatListingCard({
  listing,
  onOpen,
}: {
  listing: Listing;
  onOpen: (id: string) => void;
}) {
  const [err, setErr] = useState(false);
  const pin = PROPERTY_PIN[listing.propertyType] ?? PROPERTY_PIN["기타"];
  // 블로그 수동 썸네일(thumbnailUrl≠images[0]) 우선, 없으면 images[0]
  const thumb =
    listing.thumbnailUrl ||
    (listing.images && listing.images.length > 0 ? listing.images[0] : "");

  return (
    <button
      type="button"
      onClick={() => onOpen(listing.id)}
      className="flex w-full items-center gap-2.5 rounded-xl border border-stone/50 bg-card p-2 text-left transition hover:border-sea/50 hover:shadow-sm"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {thumb && !err ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={listing.title}
            loading="lazy"
            onError={() => setErr(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
            이미지 없음
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Badge
            className="border-transparent px-1 py-0 text-[10px] text-white"
            style={{ backgroundColor: pin.color }}
          >
            {pin.label}
          </Badge>
          {listing.dealType && (
            <span className="text-[10px] text-muted-foreground">{listing.dealType}</span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-basalt">
          {listing.title}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          <span className="font-mono text-[13px] font-bold text-basalt">
            {formatPrice(listing.priceManwon, listing.priceText)}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-tangerine">
            <MapPin className="size-2.5" />
            {listing.region}
          </span>
        </div>
      </div>
    </button>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className="size-1.5 rounded-full bg-muted-foreground/60"
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay }}
    />
  );
}

export default ChatWidget;
