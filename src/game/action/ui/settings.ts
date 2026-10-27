// 화면·소리·조작 설정. 저장은 host 가 준 함수(없으면 localStorage)로 한다.
export type CrtMode = 'off' | 'screen' | 'curved';
export interface UiSettings {
  /** CRT: 끔 · 화면 효과만(주사선·형광 마스크·번짐) · 곡면(둥근 모서리·휘어진 유리까지) (사용자 2026-10-25) */
  crt: CrtMode;
  /** 화면 흔들림 0~1 */
  shake: number;
  /** 피격 섬광 */
  flash: boolean;
  /** 밝기 0.7~1.4 (어두운 층이 너무 어두울 때) */
  bright: number;
  /** 확대할 때 도트를 각지게 */
  pixel: boolean;
  /** 화면 확대 1~1.6: 배경과 사람을 같이 키운다 (기본 1 = 규격 크기: 필드 PC는 월드 1px = 화면 1.5px) */
  charSize: number;
  master: number;
  music: number;
  sfx: number;
  /** 터치 버튼: 자동(터치 기기에서만)·항상·끄기 */
  touch: 'auto' | 'on' | 'off';
  touchSize: number;
  touchAlpha: number;
  /** 스틱을 끝까지 밀면 달리기 */
  stickRun: boolean;
  /** 왼손 배치 (스틱 오른쪽, 버튼 왼쪽) */
  lefty: boolean;
  vibrate: boolean;
  /** 피해 숫자 */
  numbers: boolean;
  /** NPC 대화에 쓸 모델: 본편 주 모델·보조 모델 */
  talkModel: 'main' | 'aux';
  /** NPC 대화에 본편 최근 채팅 두 줄을 같이 보낸다 */
  talkRecent: boolean;
}

export const DEFAULT_SETTINGS: UiSettings = {
  crt: 'off',
  shake: 1,
  flash: true,
  bright: 1,
  pixel: true,
  charSize: 1,
  master: 0.8,
  music: 0.7,
  sfx: 0.9,
  touch: 'auto',
  touchSize: 1,
  touchAlpha: 0.55,
  stickRun: true,
  lefty: false,
  vibrate: true,
  numbers: true,
  talkModel: 'main',
  talkRecent: false,
};

export interface SettingsStore {
  load(): string | null | Promise<string | null>;
  save(text: string): void | Promise<void>;
}

const KEY = 'goei-game-ui:v1';
export const localStore: SettingsStore = {
  load() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  save(text) {
    try {
      localStorage.setItem(KEY, text);
    } catch {
      /* 저장 못 해도 이번 판은 그대로 */
    }
  },
};

export function parseSettings(text: string | null): UiSettings {
  const s = { ...DEFAULT_SETTINGS };
  if (!text) return s;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    // 옛 켜기/끄기 값
    if (o.crt === true) o.crt = 'curved';
    else if (o.crt === false) o.crt = 'off';
    for (const k of Object.keys(s) as (keyof UiSettings)[]) {
      const v = o[k];
      if (v !== undefined && typeof v === typeof s[k]) (s as unknown as Record<string, unknown>)[k] = v;
    }
  } catch {
    /* 깨진 값은 기본값 */
  }
  return s;
}
