"use client";

import { useRef, useState, useCallback } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { clientStorage } from "@/lib/firebase.client";
import { ImagePlus, Loader2, X } from "lucide-react";

interface ImageSlotProps {
  url: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  label?: string;
  aspectRatio?: "video" | "square";
}

export function ImageSlot({
  url,
  onUpload,
  onRemove,
  label,
  aspectRatio = "square",
}: ImageSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 가능합니다");
        return;
      }
      setUploading(true);
      setError("");
      try {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `listings/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const storageRef = ref(clientStorage, path);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        onUpload(downloadUrl);
      } catch (e: any) {
        setError("업로드 실패: " + (e?.message ?? "오류"));
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const aspect = aspectRatio === "video" ? "aspect-video" : "aspect-square";

  return (
    <div className="relative">
      {label && (
        <p className="text-[10px] text-muted-jeju mb-1">{label}</p>
      )}
      <div
        ref={divRef}
        tabIndex={0}
        onPaste={handlePaste}
        onClick={() => !url && fileRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !url) fileRef.current?.click();
        }}
        className={`${aspect} rounded-md border-2 ${
          url
            ? "border-stone/40"
            : "border-dashed border-stone/50 cursor-pointer hover:border-sea/60 hover:bg-sea/5"
        } relative overflow-hidden transition-colors focus:outline-none focus:ring-2 focus:ring-sea/40`}
        aria-label={url ? "이미지 슬롯 (Ctrl+V로 교체)" : "이미지 추가 (클릭 또는 Ctrl+V)"}
      >
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/80 gap-1">
            <Loader2 className="size-5 animate-spin text-sea" />
            <span className="text-[10px] text-muted-jeju">업로드 중...</span>
          </div>
        ) : url ? (
          <img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-jeju">
            <ImagePlus className="size-5" />
            <span className="text-[10px]">클릭 또는 Ctrl+V</span>
          </div>
        )}
      </div>

      {/* 교체/삭제 버튼 — 이미지 있을 때만 */}
      {url && !uploading && (
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            type="button"
            className="size-6 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            title="이미지 교체 (파일 선택)"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            <ImagePlus className="size-3" />
          </button>
          <button
            type="button"
            className="size-6 rounded bg-black/60 flex items-center justify-center text-white hover:bg-red-600/90 transition-colors"
            title="삭제"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Ctrl+V 힌트 — 이미지 있을 때 호버 시 표시 */}
      {url && !uploading && (
        <div
          className="absolute inset-0 bg-black/30 flex items-end justify-center pb-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
          tabIndex={-1}
        >
          <span className="text-white text-[10px] bg-black/50 rounded px-1.5 py-0.5">
            Ctrl+V로 교체
          </span>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-destructive mt-0.5">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
