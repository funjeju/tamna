"use client";

interface AdminFooterProps {
  version?: string;
}

export function AdminFooter({ version = "v1.0 MVP" }: AdminFooterProps) {
  return (
    <footer
      className="mt-auto border-t border-stone/60 bg-paper/70 px-4 py-3 text-xs text-muted-jeju"
      role="contentinfo"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-basalt">
            TamnaIndex Admin Console
          </span>
          <span className="hidden sm:inline text-stone">·</span>
          <span>RBAC: editor</span>
          <span className="hidden sm:inline text-stone">·</span>
          <span>신뢰 우선</span>
          <span className="hidden sm:inline text-stone">·</span>
          <span className="font-mono">매일 08:00 KST 자동수집</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-sea live-dot" aria-hidden />
            <span className="sr-only">시스템 상태:</span>
            정상
          </span>
          <span className="text-stone">·</span>
          <span className="font-mono">{version}</span>
        </div>
      </div>
    </footer>
  );
}
