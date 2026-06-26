"use client";
// 슬러그(widgetId)로 해당 계산기 위젯을 렌더 (서버 페이지에서 사용)
import { WIDGETS } from "./CalculatorWidgets";

export function CalcWidget({ widgetId }: { widgetId: string }) {
  const Comp = WIDGETS[widgetId];
  if (!Comp) return null;
  return <Comp />;
}

export default CalcWidget;
