// 컷신 도트 애니메이션 재생기. 대사 층 위에 화면 전체를 덮고 프레임 PNG를 차례로 재생, 자막, 건너뛰기, 소리 켜기.
// 컷 = 폴더 <컷>/ 안의 0001.png, 0002.png …(장마다 640×360) + timing.json {ms: [장별 ms], loop?: [처음, 끝](1부터)}.
// 첫 컷을 못 불러오면 바로 끝낸다.
import type { VideoSub } from './scripts/videos';
import { ensureKit } from '../ui/kit';
import { VideoTrack } from '../audio/videoTrack';

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
  private audio: VideoTrack | null = null;
  private sub: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private loading: HTMLElement;
  private lastImage: HTMLImageElement | null = null;
  private lastSubtitle = '';
  private subs: VideoSub[] = [];
  private cuts: (Cut | null | undefined)[] = [];
  private lens: number[] = [];
  private done: (() => void) | null = null;
  private token = 0;
  private raf = 0;
  private started = 0;
  private audioTime = 0;
  private paused = false;
  private resetClock: (() => void) | null = null;
  private detachClock: (() => void) | null = null;
  /** 재생 중인가 (불러오는 중 포함) */
  open = false;

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'gsy-video';
    el.hidden = true;
    el.innerHTML = `<canvas width="${W}" height="${H}"></canvas><p class="gsy-vsub gk-panel gk-font" hidden></p>
<p class="gsy-vloading gk-panel gk-font" style="position:absolute;top:12%;padding:12px">장면 불러오는 중…</p>
<button class="gsy-vsound gk-btn" hidden>소리 켜기</button><button class="gsy-vskip gk-btn">건너뛰기 ▶▶</button>`;
    root.append(el);
    ensureKit();
    this.el = el;
    this.canvas = el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.sub = el.querySelector('.gsy-vsub')!;
    this.skipBtn = el.querySelector('.gsy-vskip')!;
    this.soundBtn = el.querySelector('.gsy-vsound')!;
    this.loading = el.querySelector('.gsy-vloading')!;
    this.skipBtn.addEventListener('click', (e) => (e.stopPropagation(), this.finish()));
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio?.enable(this.audioTime);
    });
    // 화면을 눌러도 건너뛴다 (1초 뒤부터, 실수 방지)
    el.addEventListener('click', () => this.skipSoft());
  }

  /** base = 컷 폴더 주소(끝에 /), cuts = 컷 길이(초), ready = 프레임이 있다고 알려졌나(false면 불러 보지 않고 끝) */
  async play(base: string, cuts: number[], subs: VideoSub[], onDone: () => void, ready: Promise<boolean> = Promise.resolve(true), sound = false) {
    this.cancel();
    const token = ++this.token;
    this.subs = subs;
    this.lens = cuts;
    this.cuts = cuts.map(() => undefined);
    this.done = onDone;
    this.open = true;
    this.audioTime = 0;
    this.started = performance.now();
    this.el.hidden = false;
    this.sub.hidden = true;
    this.soundBtn.hidden = true;
    this.loading.hidden = false;
    this.lastImage = null;
    this.lastSubtitle = '';
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    const active = () => token === this.token;
    const available = await ready.catch(() => false);
    const first = available && active() ? await loadCut(base, 1, active) : null;
    if (token !== this.token) return;
    if (!first) return this.finish();
    this.cuts[0] = first;
    // 다음 컷부터 순서대로 준비한다. 모든 PNG를 한꺼번에 디코딩해 UI를 막지 않는다.
    void (async () => {
      for (let i = 1; i < cuts.length && active(); i++) {
        const cut = await loadCut(base, i + 1, active);
        if (active()) this.cuts[i] = cut;
      }
    })();
    if (sound) this.startAudio(`${base}sound.ogg`, token);
    this.started = performance.now();
    let elapsed = 0, last = this.started, buffering = false;
    const resetClock = () => { last = performance.now(); };
    this.resetClock = resetClock;
    document.addEventListener('visibilitychange', resetClock);
    this.detachClock = () => document.removeEventListener('visibilitychange', resetClock);
    const duration = this.lens.reduce((a, b) => a + b, 0);
    this.loading.hidden = true;
    this.draw(0);
    this.showSub(0);
    const tick = () => {
      if (token !== this.token) return;
      const now = performance.now();
      if (this.paused || document.hidden || this.audio?.blocked) {
        last = now;
        this.raf = requestAnimationFrame(tick);
        return;
      }
      const t = elapsed + (now - last) / 1000;
      last = now;
      let at = t, index = 0;
      while (index < this.lens.length - 1 && at >= this.lens[index]) at -= this.lens[index++];
      if (this.cuts[index] === undefined) {
        this.loading.hidden = false;
        if (!buffering) this.audio?.pause();
        buffering = true;
      } else {
        this.loading.hidden = true;
        if (buffering && this.audio) {
          this.audio.resume(elapsed);
        }
        buffering = false;
        elapsed = this.audioTime = t;
        if (t >= duration) return this.finish();
        this.draw(t);
        this.showSub(t);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private startAudio(url: string, token: number) {
    this.audio = new VideoTrack(this.el, url, show => {
      if (token === this.token) this.soundBtn.hidden = !show;
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
    const img = cut.imgs[f];
    if (img === this.lastImage) return;
    this.lastImage = img;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(img, 0, 0, W, H);
  }

  private showSub(t: number) {
    let cur: VideoSub | null = null;
    this.subs.forEach((s, i) => {
      const end = s.t + (s.dur ?? (this.subs[i + 1] ? this.subs[i + 1].t - s.t : 3));
      if (t >= s.t && t < end) cur = s;
    });
    const c = cur as VideoSub | null;
    this.sub.hidden = !c;
    const html = c ? `${c.who ? `<b>${esc(c.who)}</b> ` : ''}${esc(c.text)}` : '';
    if (html !== this.lastSubtitle) this.sub.innerHTML = this.lastSubtitle = html;
  }

  /** 화면 누르기·확인 키: 시작 1초 뒤부터 건너뜀 (실수 방지) */
  skipSoft() {
    if (performance.now() - this.started > 1000) this.finish();
  }

  /** Menu policy also applies to silent clips, which have no VideoTrack. */
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.resetClock?.();
  }

  /** Replacement/disposal is not successful completion of the previous scene. */
  cancel() {
    this.done = null;
    this.finish();
  }

  /** 건너뛰기·끝·실패 모두 여기로 */
  finish() {
    if (!this.open) return;
    this.open = false;
    this.token++;
    cancelAnimationFrame(this.raf);
    this.detachClock?.();
    this.detachClock = null;
    this.resetClock = null;
    this.audio?.dispose();
    this.audio = null;
    this.el.hidden = true;
    this.cuts = [];
    this.lastImage = null;
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

async function loadCut(base: string, n: number, active: () => boolean): Promise<Cut | null> {
  try {
    const res = await fetch(`${base}c${n}/timing.json`);
    if (!res.ok) return null;
    const meta = (await res.json()) as CutMeta;
    if (!Array.isArray(meta.ms) || !meta.ms.length) return null;
    const imgs: HTMLImageElement[] = new Array(meta.ms.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, meta.ms.length) }, async () => {
      while (next < meta.ms.length && active()) {
        const k = next++;
        const img = new Image();
        img.src = `${base}c${n}/${String(k + 1).padStart(4, '0')}.png`;
        await img.decode();
        imgs[k] = img;
      }
    }));
    if (!active()) return null;
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
