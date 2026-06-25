"use client";
// TamnaIndex — 실장님 수첩: 음성/텍스트 상담 → 전사·항목추출 → 검수 → 상담일지 출력
// 데이터는 서버에 저장하지 않고 요청 처리에만 사용(PII 안전).
import { useCallback, useRef, useState } from "react";
import { Mic, Square, Upload, FileText, Loader2, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildConsultReportHtml, type ConsultReportData } from "@/lib/decision/report";

type Mode = "record" | "upload" | "text";

interface Form {
  customerName: string;
  contact: string;
  consultType: string;
  region: string;
  propertyType: string;
  dealType: string;
  budgetText: string;
  conditionsText: string;
  interestedText: string;
  nextActionsText: string;
  summary: string;
}
const EMPTY_FORM: Form = {
  customerName: "", contact: "", consultType: "", region: "", propertyType: "", dealType: "",
  budgetText: "", conditionsText: "", interestedText: "", nextActionsText: "", summary: "",
};

const DISCLAIMER =
  "본 상담일지는 상담 내용 요약 보조자료이며 법적 효력이 없습니다. 고객 개인정보는 사전 동의 하에 처리하세요. 본 도구는 입력한 음성·텍스트를 서버에 저장하지 않습니다.";

export function NotebookTool() {
  const [mode, setMode] = useState<Mode>("text");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [hasResult, setHasResult] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRec = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      setError("마이크 권한이 필요합니다.");
    }
  }, []);
  const stopRec = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
  }, []);

  const process = useCallback(async () => {
    setError("");
    setProcessing(true);
    try {
      let res: Response;
      if (mode === "text") {
        res = await fetch("/api/notebook/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } else {
        if (!audioBlob) {
          setError("먼저 녹음하거나 오디오 파일을 올려주세요.");
          setProcessing(false);
          return;
        }
        const fd = new FormData();
        fd.append("audio", audioBlob, "consult.webm");
        res = await fetch("/api/notebook/process", { method: "POST", body: fd });
      }
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "처리 실패");
        setProcessing(false);
        return;
      }
      setTranscript(d.transcript || "");
      const e = d.extracted;
      if (e) {
        setForm({
          customerName: e.customerName ?? "",
          contact: e.contact ?? "",
          consultType: e.consultType ?? "",
          region: e.region ?? "",
          propertyType: e.propertyType ?? "",
          dealType: e.dealType ?? "",
          budgetText: e.budgetText ?? "",
          conditionsText: (e.conditions ?? []).join("\n"),
          interestedText: (e.interested ?? []).join("\n"),
          nextActionsText: (e.nextActions ?? []).join("\n"),
          summary: e.summary ?? "",
        });
      }
      setHasResult(true);
    } catch {
      setError("처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  }, [mode, text, audioBlob]);

  const upd = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const printReport = useCallback(() => {
    const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    const data: ConsultReportData = {
      createdAt: `${new Date().toLocaleDateString("ko-KR")} 작성`,
      customerName: form.customerName,
      contact: form.contact,
      consultType: form.consultType,
      region: form.region,
      propertyType: form.propertyType,
      dealType: form.dealType,
      budgetText: form.budgetText,
      conditions: lines(form.conditionsText),
      interested: lines(form.interestedText),
      nextActions: lines(form.nextActionsText),
      summary: form.summary,
      disclaimer: DISCLAIMER,
    };
    const w = window.open("", "_blank", "width=900,height=1000");
    if (w) {
      w.document.open();
      w.document.write(buildConsultReportHtml(data));
      w.document.close();
    }
  }, [form]);

  const canProcess = consent && (mode === "text" ? text.trim().length > 0 : !!audioBlob || recording);

  return (
    <div className="space-y-4">
      {/* 동의 */}
      <label className="flex items-start gap-2 rounded-lg border border-stone/50 bg-paper/40 p-3 text-xs text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>
          <b className="text-basalt">녹취·개인정보 동의 확인</b> — 고객에게 녹취·정보 처리 동의를 받았음을 확인합니다.
          입력 데이터는 서버에 저장되지 않습니다.
        </span>
      </label>

      {/* 입력 모드 */}
      <div className="inline-flex rounded-full border border-stone/50 bg-paper/60 p-0.5">
        {([["text", "텍스트", FileText], ["record", "녹음", Mic], ["upload", "파일", Upload]] as const).map(
          ([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                mode === m ? "bg-sea text-sea-foreground" : "text-muted-foreground hover:text-basalt",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ),
        )}
      </div>

      {/* 입력 영역 */}
      <div className="rounded-xl border border-stone/50 bg-card p-4">
        {mode === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="상담 내용을 붙여넣거나 메모하세요. 예) 김OO 고객, 010-..., 애월 단독주택 매매, 예산 3억, 바다뷰 희망, 다음주 임장 예약…"
            className="h-40 w-full resize-y rounded-md border border-stone/60 bg-background p-3 text-sm"
          />
        )}
        {mode === "record" && (
          <div className="flex flex-col items-center gap-3 py-4">
            {!recording ? (
              <Button type="button" onClick={startRec} className="bg-tangerine text-tangerine-foreground hover:bg-tangerine/90">
                <Mic className="size-4" /> 녹음 시작
              </Button>
            ) : (
              <Button type="button" onClick={stopRec} variant="outline" className="border-tangerine text-tangerine">
                <Square className="size-4" /> 녹음 중지
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{audioBlob ? "녹음 완료 — 분석을 눌러주세요." : recording ? "녹음 중…" : "마이크로 상담을 녹음하세요."}</span>
          </div>
        )}
        {mode === "upload" && (
          <div className="flex flex-col items-center gap-2 py-4">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioBlob(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {audioBlob && <span className="text-xs text-muted-foreground">파일 준비됨 — 분석을 눌러주세요.</span>}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={process} disabled={!canProcess || processing} className="w-full bg-sea text-sea-foreground hover:bg-sea/90">
        {processing ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        {processing ? "분석 중…" : "분석 (전사·항목추출)"}
      </Button>

      {/* 검수 폼 */}
      {hasResult && (
        <div className="space-y-3 rounded-xl border border-sea/30 bg-sea/5 p-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-sea" />
            <span className="text-sm font-semibold text-basalt">검수 — 추출 항목을 확인·수정하세요</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Lbl t="고객명"><Input value={form.customerName} onChange={upd("customerName")} className="h-9 text-sm" /></Lbl>
            <Lbl t="연락처"><Input value={form.contact} onChange={upd("contact")} className="h-9 text-sm" /></Lbl>
            <Lbl t="상담유형"><Input value={form.consultType} onChange={upd("consultType")} className="h-9 text-sm" /></Lbl>
            <Lbl t="지역"><Input value={form.region} onChange={upd("region")} className="h-9 text-sm" /></Lbl>
            <Lbl t="유형"><Input value={form.propertyType} onChange={upd("propertyType")} className="h-9 text-sm" /></Lbl>
            <Lbl t="거래"><Input value={form.dealType} onChange={upd("dealType")} className="h-9 text-sm" /></Lbl>
          </div>
          <Lbl t="예산·자금"><Input value={form.budgetText} onChange={upd("budgetText")} className="h-9 text-sm" /></Lbl>
          <Lbl t="상담 요약"><textarea value={form.summary} onChange={upd("summary")} className="h-20 w-full resize-y rounded-md border border-stone/60 bg-background p-2 text-sm" /></Lbl>
          <div className="grid gap-2 sm:grid-cols-3">
            <Lbl t="희망조건 (한 줄에 하나)"><textarea value={form.conditionsText} onChange={upd("conditionsText")} className="h-20 w-full resize-y rounded-md border border-stone/60 bg-background p-2 text-sm" /></Lbl>
            <Lbl t="관심매물"><textarea value={form.interestedText} onChange={upd("interestedText")} className="h-20 w-full resize-y rounded-md border border-stone/60 bg-background p-2 text-sm" /></Lbl>
            <Lbl t="다음 액션"><textarea value={form.nextActionsText} onChange={upd("nextActionsText")} className="h-20 w-full resize-y rounded-md border border-stone/60 bg-background p-2 text-sm" /></Lbl>
          </div>

          <Button onClick={printReport} className="w-full bg-sea text-sea-foreground hover:bg-sea/90">
            <Printer className="size-4" /> 상담일지 출력 (PDF)
          </Button>

          {transcript && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">전사 원문 보기</summary>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{transcript}</p>
            </details>
          )}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground/80">{DISCLAIMER}</p>
    </div>
  );
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{t}</span>
      {children}
    </label>
  );
}

export default NotebookTool;
