// TamnaIndex — 공개 사이트 푸터 (sticky bottom)
// 본문 길이에 상관없이 항상 화면 하단에 자리잡도록 PublicApp에서 mt-auto와 함께 사용.
import { Compass, ShieldAlert, Youtube } from "lucide-react";

export function PublicFooter() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-stone/60 bg-paper/60 px-4 py-8 text-sm text-muted-foreground md:px-8"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
        {/* 플랫폼 소개 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-basalt">
            <Compass className="size-4 text-tangerine" aria-hidden="true" />
            <span className="font-semibold">탐라인덱스</span>
          </div>
          <p className="leading-relaxed">
            제주 부동산 유튜브 영상 매물을 수집 · 표준화 · 지도화하는 공개
            인덱스입니다. 흩어진 영상 매물을 한 장의 지도로 모아 보여줍니다.
          </p>
          <p className="text-xs text-muted-foreground/80">
            지도가 곧 인덱스 · Tamna Index
          </p>
        </section>

        {/* 이용안내 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-basalt">
            <ShieldAlert className="size-4 text-sea" aria-hidden="true" />
            <span className="font-semibold">이용 안내</span>
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed">
            <li>
              · 모든 영상은 YouTube 공개 영상을 임베드 방식으로만 재생합니다.
              재호스팅하지 않습니다.
            </li>
            <li>
              · 중개사 채널은 사전 동의를 원칙으로 하며, 노출을 원하지 않는
              채널은 옵트아웃(opt-out) 요청을 통해 즉시 제외됩니다.
            </li>
            <li>
              · 매물 정보는 영상에서 자동 추출되며, 정확도는 표준화 신뢰도로
              표시됩니다. 최종 거래 조건은 반드시 중개사에게 확인하세요.
            </li>
          </ul>
        </section>

        {/* 저작권 · 채널 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-basalt">
            <Youtube className="size-4 text-tangerine" aria-hidden="true" />
            <span className="font-semibold">출처와 권리</span>
          </div>
          <p className="text-xs leading-relaxed">
            영상의 모든 저작권은 원 채널 소유자에게 있으며, 본 플랫폼은
            인덱싱·검색 보조 목적으로만 동작합니다.
          </p>
          <p className="text-xs">© {new Date().getFullYear()} TamnaIndex</p>
        </section>
      </div>
    </footer>
  );
}

export default PublicFooter;
