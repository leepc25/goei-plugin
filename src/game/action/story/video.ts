// 컷신 도트 애니메이션 재생기. 대사 층 위에 화면 전체를 덮고 프레임 PNG를 차례로 재생, 자막, 건너뛰기, 소리 켜기.
// 컷 = 폴더 <컷>/ 안의 0001.png, 0002.png …(장마다 640×360) + timing.json {ms: [장별 ms], loop?: [처음, 끝](1부터)}.
// 첫 컷을 못 불러오면 바로 끝낸다.
import type { VideoSub } from './scripts/videos';
import { ensureKit } from '../ui/kit';

const W = 640;
const H = 360;

interface CutMeta {
  /** 장마다 ms. 개수 = 장 수 */
  ms: number[];
  /** 컷 길이를 다 못 채우면 되풀이할 장 범위 [처음, 끝] (1부터, 끝 포함) */
  loop?: [number, number];
}
interface Cut {
  imgs: HTMLImageElement[];
  meta: CutMeta;
  frames: number;
}

export class VideoPlayer {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audio: HTMLAudioElement | null = null;
  private sub: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private subs: VideoSub[] = [];
  private cuts: (Cut | null | undefined)[] = [];
  private lens: number[] = [];
  private done: (() => void) | null = null;
  private token = 0;
  private raf = 0;
  private started = 0;
  /** 재생 중인가 (불러오는 중 포함) */
  open = false;

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'gsy-video';
    el.hidden = true;
    el.innerHTML = `<canvas width="${W}" height="${H}"></canvas><p class="gsy-vsub gk-panel gk-font" hidden></p>
<button class="gsy-vsound gk-btn" hidden>소리 켜기</button><button class="gsy-vskip gk-btn">건너뛰기 ▶▶</button>`;
    root.append(el);
    ensureKit();
    this.el = el;
    this.canvas = el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.sub = el.querySelector('.gsy-vsub')!;
    this.skipBtn = el.querySelector('.gsy-vskip')!;
    this.soundBtn = el.querySelector('.gsy-vsound')!;
    this.skipBtn.addEventListener('click', (e) => (e.stopPropagation(), this.finish()));
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.audio) this.audio.muted = false;
      this.soundBtn.hidden = true;
    });
    // 화면을 눌러도 건너뛴다 (1초 뒤부터, 실수 방지)
    el.addEventListener('click', () => this.skipSoft());
  }

  /** base = 컷 폴더 주소(끝에 /), cuts = 컷 길이(초), ready = 프레임이 있다고 알려졌나(false면 불러 보지 않고 끝) */
  async play(base: string, cuts: number[], subs: VideoSub[], onDone: () => void, ready: Promise<boolean> = Promise.resolve(true), sound = false) {
    this.finish();
    const token = ++this.token;
    this.subs = subs;
    this.lens = cuts;
    this.cuts = cuts.map(() => undefined);
    this.done = onDone;
    this.open = true;
    this.started = performance.now();
    this.el.hidden = false;
    this.sub.hidden = true;
    this.soundBtn.hidden = true;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    const first = (await ready) && token === this.token ? await loadCut(base, 1) : null;
    if (token !== this.token) return;
    if (!first) return this.finish();
    this.cuts[0] = first;
    // 나머지 컷은 재생하면서 불러온다. 못 불러온 컷은 앞 컷의 마지막 장을 둔다
    cuts.slice(1).forEach((_, i) => void loadCut(base, i + 2).then((c) => token === this.token && (this.cuts[i + 1] = c)));
    if (sound) this.startAudio(`${base}sound.ogg`, token);
    this.started = performance.now();
    const tick = () => {
      if (token !== this.token) return;
      const t = (performance.now() - this.started) / 1000;
      if (t >= this.lens.reduce((a, b) => a + b, 0)) return this.finish();
      this.draw(t);
      this.showSub(t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private startAudio(url: string, token: number) {
    const a = new Audio(url);
    this.audio = a;
    a.addEventListener('error', () => (this.soundBtn.hidden = true));
    a.play().catch(() => {
      // 소리 있는 자동 재생이 막히면 소리 없이 틀고 「소리 켜기」를 보인다
      if (token !== this.token || a.error) return;
      a.muted = true;
      a.play().then(() => token === this.token && (this.soundBtn.hidden = false)).catch(() => {});
    });
  }

  private draw(t: number) {
    let i = 0;
    let at = t;
    while (i < this.lens.length - 1 && at >= this.lens[i]) at -= this.lens[i++];
    // 아직 못 불러온 컷이면 앞의 불러온 컷 마지막 장
    let cut = this.cuts[i];
    let f: number;
    if (cut) f = frameAt(cut, at * 1000);
    else {
      while (i > 0 && !this.cuts[i]) i--;
      cut = this.cuts[i];
      if (!cut) return;
      f = cut.frames - 1;
    }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(cut.imgs[f], 0, 0, W, H);
  }

  private showSub(t: number) {
    let cur: VideoSub | null = null;
    this.subs.forEach((s, i) => {
      const end = s.t + (s.dur ?? (this.subs[i + 1] ? this.subs[i + 1].t - s.t : 3));
      if (t >= s.t && t < end) cur = s;
    });
    const c = cur as VideoSub | null;
    this.sub.hidden = !c;
    if (c) this.sub.innerHTML = `${c.who ? `<b>${esc(c.who)}</b> ` : ''}${esc(c.text)}`;
  }

  /** 화면 누르기·확인 키: 시작 1초 뒤부터 건너뜀 (실수 방지) */
  skipSoft() {
    if (performance.now() - this.started > 1000) this.finish();
  }

  /** 건너뛰기·끝·실패 모두 여기로 */
  finish() {
    if (!this.open) return;
    this.open = false;
    this.token++;
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    this.audio = null;
    this.el.hidden = true;
    const cb = this.done;
    this.done = null;
    cb?.();
  }
}

const lists = new Map<string, Promise<string[]>>();
/** 프레임 폴더의 index.json(받은 컷신 이름 목록)에 id가 있나. 없는 파일을 불러 콘솔 오류를 내지 않으려고 먼저 본다 */
export function listed(dir: string, id: string): Promise<boolean> {
  if (!lists.has(dir))
    lists.set(
      dir,
      fetch(`${dir}index.json`)
        .then((r) => (r.ok ? r.json() : []))
        .then((a) => (Array.isArray(a) ? a.map(String) : []))
        .catch(() => []),
    );
  return lists.get(dir)!.then((a) => a.includes(id));
}

async function loadCut(base: string, n: number): Promise<Cut | null> {
  try {
    const res = await fetch(`${base}c${n}/timing.json`);
    if (!res.ok) return null;
    const meta = (await res.json()) as CutMeta;
    if (!Array.isArray(meta.ms) || !meta.ms.length) return null;
    const imgs = await Promise.all(
      meta.ms.map(async (_, k) => {
        const img = new Image();
        img.src = `${base}c${n}/${String(k + 1).padStart(4, '0')}.png`;
        await img.decode();
        return img;
      }),
    );
    return { imgs, meta, frames: imgs.length };
  } catch {
    return null;
  }
}

/** 컷 시작에서 ms 지난 때의 장 번호. 다 넘기면 loop 범위를 되풀이, 없으면 마지막 장에 멈춤 */
export function frameAt(cut: { meta: CutMeta; frames: number }, ms: number): number {
  const d = (k: number) => Math.max(16, cut.meta.ms[k] || 100);
  let acc = 0;
  for (let k = 0; k < cut.frames; k++) {
    acc += d(k);
    if (ms < acc) return k;
  }
  const loop = cut.meta.loop;
  if (!loop) return cut.frames - 1;
  const a = Math.max(0, Math.min(loop[0] - 1, cut.frames - 1));
  const b = Math.max(a, Math.min(loop[1] - 1, cut.frames - 1));
  let span = 0;
  for (let k = a; k <= b; k++) span += d(k);
  let r = (ms - acc) % span;
  for (let k = a; k <= b; k++) {
    r -= d(k);
    if (r < 0) return k;
  }
  return b;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** 저장소 뿌리 주소 추정: release/demo/·dist/ 안의 html이면 그 위, 아니면 지금 폴더 */
export function repoRoot(href = location.href): string {
  const i = href.search(/\/(release\/demo|dist)\//);
  return i >= 0 ? href.slice(0, i + 1) : new URL('./', href).href;
}
