"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ChipInputProps {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  accentColor?: string; // hex
  label?: string;
}

/**
 * 칩 입력 컴포넌트 — 하이라이트 / 키워드 / 테마 등에 사용
 * - 엔터로 추가, X 클릭으로 삭제
 * - suggestion 클릭 시 자동 추가
 */
export function ChipInput({
  values,
  onChange,
  placeholder = "입력 후 Enter",
  suggestions,
  accentColor = "#176b6b",
  label,
}: ChipInputProps) {
  const [text, setText] = useState("");

  const add = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setText("");
  };

  const remove = (v: string) => {
    onChange(values.filter((x) => x !== v));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && values.length > 0) {
      remove(values[values.length - 1]);
    }
  };

  const remaining = (suggestions ?? []).filter((s) => !values.includes(s));

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-xs font-medium text-muted-jeju">{label}</span>
      )}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-9">
        {values.map((v) => (
          <Badge
            key={v}
            variant="secondary"
            className="gap-1 pr-1"
            style={{
              backgroundColor: `${accentColor}1a`,
              color: accentColor,
              borderColor: `${accentColor}33`,
            }}
          >
            {v}
            <button
              type="button"
              aria-label={`${v} 삭제`}
              onClick={() => remove(v)}
              className="rounded-full hover:bg-foreground/10 p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(text)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {remaining && remaining.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remaining.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-stone/60 px-2 py-0.5 text-[11px] text-muted-jeju hover:border-sea hover:text-sea transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
