// Lite 카드 첫 안내(first_mes)를 플러그인이 다시 그리는 시작 카드.
// 채팅 메시지 안이라 class는 Risu가 바꿔 버리고 @keyframes도 못 넣는다.
// 그래서 모양은 인라인 style로 다 그리고, 움직임과 좁은 화면 배치만 본 화면에 붙인 CSS(LANDING_CSS)가 data-goei-part로 건다.
// 그 CSS가 없어도(본 화면 권한 거부) 멈춘 카드는 똑같이 보인다. 움직임은 transform·opacity만 쓴다.
import { GHOST_ICON } from './icons';
import type { Palette } from './theme';

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** 제목 「괴이 ː 이면세계」와 아래로 비친 반사(이면). 반사는 물결처럼 일렁인다 */
function title(p: Palette): string {
  const line = `<span style="color:${p.text}">괴이</span><span style="color:${p.signal};font-weight:300;margin:0 .3em">ː</span><span style="color:${p.signal}">이면세계</span>`;
  const font = 'font-size:2.1em;font-weight:800;letter-spacing:.08em;line-height:1.15;white-space:nowrap';
  return `<div style="margin:6px 0 0;${font}">${line}</div>`
    + `<div aria-hidden="true" style="${font};line-height:1;margin:-.06em 0 .02em;`
    + `-webkit-mask-image:linear-gradient(to bottom,#000,transparent 60%);mask-image:linear-gradient(to bottom,#000,transparent 60%)">`
    + `<div data-goei-part="mirror" style="transform:scaleY(-1);opacity:.3">${line}</div></div>`;
}

/** 모서리 꺾쇠 하나 (관제 화면 느낌, 카드가 넓어도 빈 곳이 덜 휑하게) */
function corner(pos: string, p: Palette): string {
  const [v, h] = pos.split(' ');
  return `<span aria-hidden="true" style="position:absolute;${v}:10px;${h}:10px;width:14px;height:14px;`
    + `border-${v}:2px solid ${p.accentLine};border-${h}:2px solid ${p.accentLine};border-${v}-${h}-radius:4px;opacity:.9"></span>`;
}

// 넓은 화면에서 글 오른쪽만 휑하지 않게: 유령·글 묶음을 가운데로, 카드 폭도 조금 좁게 (사용자 2026-10-19). 크기 격리(container-type) 때문에 fit-content는 못 씀
export function landingHtml(p: Palette): string {
  const ghost = GHOST_ICON.replace('width="24" height="24"', 'width="92" height="92"');
  return `<div data-goei-card="landing" style="position:relative;overflow:hidden;box-sizing:border-box;max-width:37em;margin:18px auto;padding:26px 30px 22px;border-radius:20px;`
    + `background:${p.void};border:1px solid ${p.line};color:${p.text};line-height:1.6;font-size:15px;text-align:left;box-shadow:0 20px 40px -24px rgba(0,0,0,.45)">`
    + `<span aria-hidden="true" data-goei-part="scan" style="position:absolute;left:0;right:0;top:0;height:40%;pointer-events:none;opacity:0;`
    + `background:linear-gradient(to bottom,transparent,${p.accentBg} 70%,transparent)"></span>`
    + corner('top left', p) + corner('top right', p) + corner('bottom left', p) + corner('bottom right', p)
    + `<div data-goei-part="row" style="position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:18px 26px">`
    // 유령은 상자 없이 크게 (사용자 2026-10-19). 은은한 빛만 뒤에
    + `<div data-goei-part="ghost" style="flex:0 0 auto;display:grid;place-items:center;width:96px;height:96px;`
    + `color:${p.signal};filter:drop-shadow(0 6px 14px ${p.accentBg})">${ghost}</div>`
    // 오른쪽: 글
    + `<div data-goei-part="text" style="flex:0 1 auto;min-width:0">`
    + `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px 12px;flex-wrap:wrap;font-family:${MONO};font-size:11px;letter-spacing:.28em">`
    + `<span data-goei-part="label" style="color:${p.signal}">ANOMALY SIMULATION</span>`
    + `<span style="display:inline-flex;align-items:center;gap:6px;color:${p.sub};letter-spacing:.2em">`
    + `<span data-goei-part="dot" style="width:7px;height:7px;border-radius:50%;background:${p.signal}"></span>STANDBY</span></div>`
    + title(p)
    + `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;padding-top:12px;border-top:1px dashed ${p.line};color:${p.sub}">`
    + `<span style="font-family:${MONO};color:${p.signal}">▸</span><span data-goei-part="hint">유령 버튼을 눌러 시작하세요</span></div>`
    + `</div></div></div>`;
}

/** 본 화면에 붙이는 시작 카드 움직임 + 좁은 화면 배치 */
export const LANDING_CSS = `
[data-goei-card="landing"] { container-type: inline-size; }
@keyframes goei-l-blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
@keyframes goei-l-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(.7); } }
@keyframes goei-l-mirror {
  0%, 100% { transform: scaleY(-1) skewX(0deg) translateX(0); opacity: .3; }
  25% { transform: scaleY(-1.04) skewX(5deg) translateX(-2px); opacity: .22; }
  50% { transform: scaleY(-.97) skewX(-3deg) translateX(2px); opacity: .34; }
  75% { transform: scaleY(-1.02) skewX(4deg) translateX(-1px); opacity: .25; }
}
@keyframes goei-l-label {
  0%, 86%, 100% { opacity: .9; transform: translateX(0); }
  88% { opacity: .3; transform: translateX(2px); }
  90% { opacity: 1; transform: translateX(-2px); }
  92% { opacity: .5; transform: translateX(1px); }
  94% { opacity: .95; transform: translateX(0); }
}
@keyframes goei-l-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes goei-l-scan { 0% { transform: translateY(-100%); opacity: 0; } 15% { opacity: .55; } 70% { opacity: .55; } 100% { transform: translateY(260%); opacity: 0; } }
[data-goei-card="landing"] [data-goei-part="hint"] { animation: goei-l-blink 1.6s ease-in-out infinite; }
[data-goei-card="landing"] [data-goei-part="dot"] { animation: goei-l-dot 1.6s ease-in-out infinite; }
[data-goei-card="landing"] [data-goei-part="mirror"] { animation: goei-l-mirror 4.5s ease-in-out infinite; }
[data-goei-card="landing"] [data-goei-part="label"] { display: inline-block; animation: goei-l-label 3.8s linear infinite; }
[data-goei-card="landing"] [data-goei-part="ghost"] { animation: goei-l-float 3.2s ease-in-out infinite; }
[data-goei-card="landing"] [data-goei-part="scan"] { animation: goei-l-scan 5s ease-in-out infinite; }
/* 인라인 style을 이겨야 해서 !important */
@container (max-width: 30em) {
  [data-goei-card="landing"] [data-goei-part="text"] { flex-basis: 100% !important; text-align: center !important; }
  [data-goei-card="landing"] [data-goei-part="text"] > div:first-child { justify-content: center !important; }
  [data-goei-card="landing"] [data-goei-part="text"] > div:last-child { justify-content: center !important; }
  [data-goei-card="landing"] [data-goei-part="ghost"] { width: 80px !important; height: 80px !important; }
  [data-goei-card="landing"] [data-goei-part="ghost"] svg { width: 76px; height: 76px; }
}
@media (prefers-reduced-motion: reduce) {
  [data-goei-card="landing"] [data-goei-part] { animation: none !important; }
}
`;
