// 보고서 「이미지로 저장」 (docs/설계안_기록_보고서.md 5-9절): 캔버스 900×1200 한 장을 PNG 로 내려받는다 (설정 내보내기 man-download 와 같은 a.download 길).
// 배색은 지금 창 테마(다크·라이트·페이퍼)의 CSS 변수, 글꼴은 플러그인 글꼴이 받아졌으면 그것·아니면 시스템 글꼴, 사건 그림은 카드 에셋(evArt)이
// blob:/data: 로 읽혀 있을 때만 그린다 (원격 URL 은 캔버스를 오염시켜 toBlob 이 실패하므로 빈 틀). 그리기 자체는 core/journal/png.ts (순수).
import { paintReport, PNG_H, PNG_W, type PaintArt, type PaintColors, type Report } from '../core/journal';
import type { ChatContext } from '../host/risu';
import { evArt } from './evpic';
import { currentTheme, PALETTES } from './theme';

const FONT_SANS = '"IBM Plex Sans KR", "Pretendard", system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const FONT_MONO = '"JetBrains Mono", "IBM Plex Sans KR", ui-monospace, Menlo, monospace';

/** 지금 창의 배색 (CSS 변수 → 없으면 테마 배색표) */
export function paintColors(root: Element | null): PaintColors {
  const p = PALETTES[currentTheme()];
  const cs = root ? getComputedStyle(root) : null;
  const v = (name: string, fallback: string) => {
    const x = cs?.getPropertyValue(name).trim();
    return x || fallback;
  };
  return {
    void: v('--void', p.void), panel: v('--panel', p.panel), line: v('--line', p.line), text: v('--text', p.text), sub: v('--sub', p.sub),
    dim: v('--dim', p.sub), signal: v('--signal', p.signal), amber: v('--amber', '#F5B544'), danger: v('--danger', '#FF7A6B'), accentBg: v('--accent-bg', p.accentBg),
  };
}

/** 플러그인 글꼴을 최대 2초 기다린다. 못 받아도 진행 (시스템 글꼴) */
async function waitFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  const t = new Promise<void>((r) => setTimeout(r, 2000));
  await Promise.race([Promise.all([fonts.load('700 32px "IBM Plex Sans KR"'), fonts.load('500 14px "JetBrains Mono"')]).then(() => undefined).catch(() => undefined), t]);
}

/** blob:/data: 그림만 읽는다 (원격 URL 은 캔버스 오염). 못 읽으면 null */
async function loadArt(url: string | null): Promise<PaintArt | null> {
  if (!url || !/^(?:blob:|data:)/.test(url)) return null;
  try {
    const img = new Image();
    img.src = url;
    await (img.decode ? img.decode() : new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('img')); }));
    return img.naturalWidth > 0 ? { img, w: img.naturalWidth, h: img.naturalHeight } : null;
  } catch {
    return null;
  }
}

export interface ReportPng { blob: Blob; url: string; name: string }

/** 보고서 → PNG blob + 미리보기 URL + 파일 이름 */
export async function reportPng(ctx: ChatContext, r: Report, root: Element | null, org = ''): Promise<ReportPng> {
  await waitFonts();
  const art = await loadArt(r.kind === 'fd' ? null : evArt(ctx, r.head.name, r.kind).pic);
  const canvas = document.createElement('canvas');
  canvas.width = PNG_W;
  canvas.height = PNG_H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('캔버스를 만들지 못했어요');
  const paint = () => paintReport(g, r, { colors: paintColors(root), sans: FONT_SANS, mono: FONT_MONO, art, org });
  paint();
  let blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob && art) {
    // 그림 때문에 오염됐으면 그림 없이 한 번 더
    g.clearRect(0, 0, PNG_W, PNG_H);
    paintReport(g, r, { colors: paintColors(root), sans: FONT_SANS, mono: FONT_MONO, art: null, org });
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  }
  if (!blob) throw new Error('PNG 로 바꾸지 못했어요');
  const name = `관리국_보고서_${r.no.replace(/[^\w-]/g, '')}.png`;
  return { blob, url: URL.createObjectURL(blob), name };
}

/** 내려받기 (a.download). iOS 처럼 download 를 무시하는 곳은 부르는 쪽이 미리보기 창을 함께 띄운다 */
export function downloadPng(p: ReportPng): void {
  const a = document.createElement('a');
  a.href = p.url;
  a.download = p.name;
  a.rel = 'noopener';
  a.click();
}
