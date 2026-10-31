// 상황판 창 둘레의 기기 틀 (설정 → 화면 「외부 프레임」, 2026-10-29 사용자 결정).
// - PC 전용: 폰(760px 이하)·필드 전체화면(document.fullscreenElement)에서는 안 그린다. 설정 창(.gw)에는 없다.
// - 창(.gx-panel) 크기 규칙은 그대로 두고 틀만 창 테두리 바깥으로 뻗는다. 뷰포트가 좁아 「창 최대 폭 + 틀 두께 + 여백」이 안 들어가면 창은 그대로 두고 틀만 숨긴다.
// - 그림 파일 없이 CSS·SVG 로 그린다 (style.css 「외부 프레임」 절). 확정 시안: docs/시안/상황판_프레임/Tablet.dc.html · Tactical.dc.html
import type { Prefs } from '../core/settings';

export type FrameKind = NonNullable<Prefs['frame']>;

/** 틀이 창 바깥으로 차지하는 가로 폭(양쪽 합). 일반: 베젤 26×2 + 오른쪽 전원·볼륨 버튼 4. 전술: 베젤 44×2 + 모서리 범퍼 8×2 */
const EXTRA_W: Record<Exclude<FrameKind, 'none'>, number> = { tablet: 26 * 2 + 4, tactical: 44 * 2 + 8 * 2 };
/** 틀이 창 위아래로 차지하는 높이(합) */
const EXTRA_H: Record<Exclude<FrameKind, 'none'>, number> = { tablet: 26 * 2, tactical: 44 * 2 };
/** 틀을 켰을 때 .gx 바깥 여백 (style.css 와 같은 값). 전술은 모서리 범퍼 바닥이 본체 밖 8px 까지 나가서 그만큼 더 */
const PAD: Record<Exclude<FrameKind, 'none'>, number> = { tablet: 4, tactical: 8 };
/** 창 최대 폭 (style.css .gx-panel · .gx-panel.pre 와 같은 값) */
const PANEL_W = { nav: 1280, pre: 1024 };
/** 전술 틀일 때 창이 이보다 낮아지면 틀을 숨긴다 */
const TACTICAL_MIN_H = 600;

export interface FrameState {
  /** 실제로 그리는 종류 */
  kind: FrameKind;
  /** 설정은 틀을 원하지만 창 폭이 좁아 숨긴 상태 (설정 줄 안내용) */
  hidden: boolean;
}

/** 지금 뷰포트·전체화면 상태에서 무엇을 그릴지. nav = 시작 뒤 창(1280px) 인지 */
export function frameState(pref: FrameKind | undefined, nav: boolean): FrameState {
  const want: FrameKind = pref ?? 'tablet';
  if (want === 'none') return { kind: 'none', hidden: false };
  // 폰·필드 전체화면: 기기 틀을 그릴 자리가 없다 (숨김 안내도 없음)
  if (matchMedia('(max-width: 760px)').matches || document.fullscreenElement) return { kind: 'none', hidden: false };
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < (nav ? PANEL_W.nav : PANEL_W.pre) + EXTRA_W[want] + PAD[want] * 2) return { kind: 'none', hidden: true };
  if (want === 'tactical' && h - PAD.tactical * 2 - EXTRA_H.tactical < TACTICAL_MIN_H) return { kind: 'none', hidden: true };
  return { kind: want, hidden: false };
}

/** 전술 틀의 육각 소켓 볼트 (시안 그대로). gradient id 는 문서 안에서 겹치면 안 돼 자리마다 번호를 붙인다. url() 뒤 색은 조각 참조가 안 되는 문서(<base>)의 대체색 */
function screw(n: number, pos: string): string {
  const s = `gxf-s${n}`;
  const m = `gxf-m${n}`;
  const k = `gxf-k${n}`;
  return `<svg class="gxf-screw" aria-hidden="true" width="18" height="18" viewBox="0 0 26 26" style="${pos}"><defs><radialGradient id="${s}" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#040506"/><stop offset=".9" stop-color="#15181b"/><stop offset="1" stop-color="#2a2f33"/></radialGradient><linearGradient id="${m}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#454b50"/><stop offset=".5" stop-color="#2b3035"/><stop offset="1" stop-color="#15181b"/></linearGradient><linearGradient id="${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050607"/><stop offset="1" stop-color="#1a1e22"/></linearGradient></defs><circle cx="13" cy="13" r="13" fill="url(#${s}) #15181b"/><circle cx="13" cy="13" r="9.4" fill="url(#${m}) #2b3035"/><circle cx="13" cy="13" r="9.4" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".6"/><path d="M6.4 9.2A7.8 7.8 0 0 1 9.4 6.1" stroke="rgba(255,255,255,.18)" stroke-width=".9" fill="none" stroke-linecap="round"/><polygon points="13,8.2 17.2,10.6 17.2,15.4 13,17.8 8.8,15.4 8.8,10.6" fill="url(#${k}) #0e1113"/><polygon points="13,8.2 17.2,10.6 17.2,15.4 13,17.8 8.8,15.4 8.8,10.6" fill="none" stroke="rgba(0,0,0,.85)" stroke-width=".7"/><path d="M9.4 15.2l3.6 2.1 3.6-2.1" stroke="rgba(255,255,255,.12)" stroke-width=".7" fill="none"/></svg>`;
}

/** 일반 태블릿 장식 (창 앞에 놓는 것). 유리 반사만 창 위 */
const TABLET_BEFORE = '<i class="gxf-hi"></i><i class="gxf-glass"></i><i class="gxf-cam"><b></b><b></b></i><i class="gxf-pwr"></i><i class="gxf-vol"></i><i class="gxf-spk"></i><i class="gxf-spk r"></i>';

/** 전술 태블릿 장식. 모서리 범퍼(바닥·몸·성형 홈) 4벌, 볼트 4개, 좌우 손잡이 홈, 상태 LED, 가운데 손잡이 홈, 파인 유리, 스트랩 고리 */
const TACTICAL_BEFORE = `<i class="gxf-tex"></i><i class="gxf-recess"></i>${['tl', 'tr', 'bl', 'br'].map((c) => `<i class="gxf-bump ${c} base"></i><i class="gxf-bump ${c} body"></i><i class="gxf-bump ${c} ridge"></i>`).join('')}${screw(1, 'left:18px;top:18px')}${screw(2, 'right:18px;top:18px')}${screw(3, 'left:18px;bottom:18px')}${screw(4, 'right:18px;bottom:18px')}<i class="gxf-grip"></i><i class="gxf-grip r"></i><i class="gxf-leds"><span><b class="on-link"></b>LINK</span><span><b></b>STBY</span><span><b class="on-rec"></b>REC</span></i><i class="gxf-handle"></i><i class="gxf-pit"></i><i class="gxf-strap"></i>`;

/** 창(.gx-panel HTML)을 기기 틀로 감싼다. pre = 시작 전 창(1024px) */
export function frameHtml(kind: Exclude<FrameKind, 'none'>, pre: boolean, panel: string): string {
  return `<div class="gx-frame${pre ? ' pre' : ''}" data-kind="${kind}">${kind === 'tablet' ? TABLET_BEFORE : TACTICAL_BEFORE}${panel}<i class="gxf-glare"></i></div>`;
}
