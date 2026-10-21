// 쟈알디 그림 묶음 (game-pack/jyaldi: atlas.png + frames.json + cutin.png, tools/build_engine_art.py가 만듦).
// 시연판은 window.__GOEI_ENGINE_ART__에 내장, 플러그인은 bridge.assets.url('jyaldi', …)로 받는다.

export interface FrameInfo {
  sx: number; sy: number; w: number; h: number;
  /** 잘린 그림의 왼쪽 위 = 앵커에서 (ox, oy) 도트 (오른쪽 보기, oy는 아래가 +) */
  ox: number; oy: number;
  /** 앵커 기준 도트 상자 [x0, x1, y0, y1], y는 위가 + */
  hurt: [number, number, number, number] | null;
  reach: [number, number, number, number] | null;
  /** 손 고정점 [x, y, 각도°] 앵커 기준 도트, y는 위가 +, 각도는 오른쪽 보기에서 시계 방향.
   *  든 물건(무기·환경 물건)은 캐릭터 그림에 넣지 않고, 엔진이 그 물건 그림의 손잡이를 이 점에 맞춰 따로 그린다. */
  hand?: [number, number, number] | null;
}

export interface Art {
  atlas: HTMLImageElement | null;
  cutin: HTMLImageElement | null;
  clips: Record<string, FrameInfo[]>;
}

export const EMPTY_ART: Art = { atlas: null, cutin: null, clips: {} };

declare global {
  interface Window {
    __GOEI_ENGINE_ART__?: { atlas: string; cutin: string; frames: { clips: Record<string, FrameInfo[]> } };
  }
}

function img(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

export async function loadArt(urlOf?: (file: string) => Promise<string>): Promise<Art> {
  const inline = typeof window !== 'undefined' ? window.__GOEI_ENGINE_ART__ : undefined;
  if (inline) {
    const [atlas, cutin] = await Promise.all([img(inline.atlas), img(inline.cutin)]);
    return { atlas, cutin, clips: inline.frames.clips };
  }
  if (urlOf) {
    try {
      const [a, c, f] = await Promise.all([urlOf('atlas.png'), urlOf('cutin.png'), urlOf('frames.json')]);
      const frames = f ? await (await fetch(f)).json() : null;
      const [atlas, cutin] = await Promise.all([img(a), img(c)]);
      if (frames) return { atlas, cutin, clips: frames.clips };
    } catch {
      /* 그림 없으면 회색 상자 */
    }
  }
  return EMPTY_ART;
}
