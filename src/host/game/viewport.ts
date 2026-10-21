// 게임 창 전체화면·가로 보기. Risu 플러그인 창은 iframe이라 브라우저 전체화면(requestFullscreen)이 막혀 있을 수 있다.
// 순서: ① 브라우저 전체화면 + 가로 고정(screen.orientation.lock, 안드로이드 크롬) ② 안 되면 창 안 전체화면(고정 덮개)
// ③ 세로로 든 폰이면 게임을 90도 돌려 가로로 보여 준다(아이폰 사파리는 가로 고정이 없다). 폰을 가로로 돌리면 돌리기를 푼다.
// 돌려 보일 때는 화면 좌표와 게임 좌표가 달라서, 게임은 터치 위치를 toLocal()로 바꿔 써야 한다.
import type { GameViewport } from '../../game/bridge';

export interface ViewportCtl extends GameViewport {
  dispose(): void;
}

const portrait = () => innerHeight > innerWidth;
const phone = () => Math.min(innerWidth, innerHeight) <= 560 || matchMedia('(pointer: coarse)').matches;

export function makeViewport(layer: HTMLElement): ViewportCtl {
  let full = false;
  let rotated = false;
  /** 사용자가 돌려 보기를 원하는가 (전체화면을 누르면 켜진다) */
  let wantRotate = false;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  const apply = () => {
    const rot = wantRotate && full && portrait() && phone();
    if (rot !== rotated) rotated = rot;
    layer.classList.toggle('gx-full', full);
    layer.classList.toggle('gx-rot', rotated);
    emit();
  };

  const onResize = () => apply();
  const onFs = () => {
    // 브라우저 전체화면에서 사용자가 뒤로 가기·Esc로 나오면 창 안 전체화면도 푼다
    if (!document.fullscreenElement && full && layer.dataset.nativeFs === '1') {
      full = false;
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
    async enter() {
      full = true;
      wantRotate = true;
      try {
        if (layer.requestFullscreen && document.fullscreenEnabled) {
          await layer.requestFullscreen({ navigationUI: 'hide' });
          layer.dataset.nativeFs = '1';
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
    async exit() {
      full = false;
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
