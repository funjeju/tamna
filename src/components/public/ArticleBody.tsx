"use client";
// TamnaIndex — 가이드 본문 마크다운 렌더러 (시맨틱 HTML, SEO 친화)
import ReactMarkdown from "react-markdown";

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-basalt">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-8 mb-3 border-l-4 border-sea pl-3 text-xl font-bold text-basalt">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-lg font-semibold text-basalt">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed text-basalt/90">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-basalt/90">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-basalt/90">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-basalt">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-sea underline underline-offset-2 hover:text-tangerine">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-stone/50 bg-paper/50 py-1 pl-4 text-sm text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-stone/40 bg-paper/60 px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-stone/30 px-3 py-2">{children}</td>,
          hr: () => <hr className="my-6 border-stone/40" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default ArticleBody;
