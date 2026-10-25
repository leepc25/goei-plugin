// 게임 창 전체화면·가로 보기. Risu 플러그인 창은 iframe이라 브라우저 전체화면(requestFullscreen)이 막혀 있을 수 있다.
// 순서: ① 브라우저 전체화면 + 가로 고정(screen.orientation.lock, 안드로이드 크롬) ② 안 되면 창 안 전체화면(고정 덮개)
// ③ 세로로 든 폰이면 게임을 90도 돌려 가로로 보여 준다(아이폰 사파리는 가로 고정이 없다). 폰을 가로로 돌리면 돌리기를 푼다.
// 돌려 보일 때는 화면 좌표와 게임 좌표가 달라서, 게임은 터치 위치를 toLocal()로 바꿔 써야 한다.
import type { GameViewport } from '../../game/bridge';

export interface ViewportCtl extends GameViewport {
  /** 게임 중: 브라우저 전체화면은 묻지 않고 창(iframe) 전체를 덮는다. 세로로 든 폰이면 돌려 보인다 */
  fill(on: boolean): void;
  dispose(): void;
}

const portrait = () => innerHeight > innerWidth;
const phone = () => Math.min(innerWidth, innerHeight) <= 560 || matchMedia('(pointer: coarse)').matches;

export function makeViewport(layer: HTMLElement, opt: { inFrame?: boolean } = {}): ViewportCtl {
  let full = false;
  /** 사용자가 고른 전체화면 (필드 설정): 브라우저 · 상황창 안 */
  let mode: 'browser' | 'panel' | null = null;
  /** 브라우저 전체화면이 막혀(리스 플러그인 창은 iframe에 fullscreen 허용이 없다) 창 전체를 덮는 중 */
  let winFill = false;
  let rotated = false;
  /** 사용자가 돌려 보기를 원하는가 (전체화면을 누르면 켜진다) */
  let wantRotate = false;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  const apply = () => {
    // 창 틀 안에서 돌릴 때는 돌려 보이지 않는다 (틀 크기 그대로)
    const rot = !opt.inFrame && wantRotate && full && portrait() && phone();
    if (rot !== rotated) rotated = rot;
    layer.classList.toggle('gx-full', full);
    layer.classList.toggle('gx-panelfull', mode === 'panel');
    layer.classList.toggle('gx-winfull', mode === 'browser' && winFill);
    layer.classList.toggle('gx-rot', rotated);
    emit();
  };

  const onResize = () => apply();
  const onFs = () => {
    // 브라우저 전체화면에서 사용자가 뒤로 가기·Esc로 나오면 창 안 전체화면도 푼다
    if (!document.fullscreenElement && layer.dataset.nativeFs === '1') {
      if (mode === 'browser') mode = null;
      full = opt.inFrame ? full : false;
      wantRotate = false;
      delete layer.dataset.nativeFs;
      apply();
    }
  };
  addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onFs);
  const mq = matchMedia('(orientation: portrait)');
  mq.addEventListener?.('change', onResize);

  const vp: ViewportCtl = {
    get full() {
      return full;
    },
    get rotated() {
      return rotated;
    },
    get mode() {
      return mode;
    },
    async enter(kind = 'browser') {
      full = true;
      wantRotate = true;
      if (kind === 'panel') {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        delete layer.dataset.nativeFs;
        mode = 'panel';
        return apply();
      }
      // 브라우저 전체화면이 막히면(리스 창 iframe은 허용이 없다) 브라우저 창 전체를 덮는다 (상황창 틀·여백까지)
      mode = 'browser';
      winFill = true;
      try {
        if (layer.requestFullscreen && document.fullscreenEnabled) {
          await layer.requestFullscreen({ navigationUI: 'hide' });
          layer.dataset.nativeFs = '1';
          winFill = false;
          try {
            await (screen.orientation as unknown as { lock(o: string): Promise<void> }).lock('landscape');
          } catch {
            /* 가로 고정이 없는 기기: 아래에서 돌려 보인다 */
          }
        }
      } catch {
        /* iframe이 막음: 창 안 전체화면 */
      }
      apply();
    },
    fill(on) {
      if (!on && document.fullscreenElement) return void vp.exit();
      full = on;
      wantRotate = on;
      apply();
    },
    async exit() {
      // 필드 게임 중(창 틀 안)에는 틀 채우기는 그대로 두고 전체화면만 푼다
      full = opt.inFrame && mode !== null ? full : false;
      mode = null;
      winFill = false;
      wantRotate = false;
      if (document.fullscreenElement) {
        try {
          screen.orientation?.unlock?.();
        } catch {
          /* 무시 */
        }
        await document.exitFullscreen().catch(() => {});
      }
      delete layer.dataset.nativeFs;
      apply();
    },
    toLocal(x, y, el) {
      const r = el.getBoundingClientRect();
      // 시계 방향 90도: 요소의 가로축이 화면 아래쪽, 세로축이 화면 왼쪽을 향한다
      return rotated ? { x: y - r.top, y: r.right - x } : { x: x - r.left, y: y - r.top };
    },
    onChange(cb) {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    dispose() {
      removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
      mq.removeEventListener?.('change', onResize);
      subs.clear();
      if (document.fullscreenElement === layer) void document.exitFullscreen().catch(() => {});
    },
  };
  return vp;
}
