// 창 밖에 그리는 것(플로팅 버튼·접속 효과·채팅 속 기록 카드)도 창과 같은 배색을 쓰게 하는 작은 배색표.
// 값은 style.css의 :root / [data-theme] 토큰과 같다.
export type ThemeName = 'dark' | 'light' | 'paper';

export interface Palette {
  void: string; panel: string; line: string; text: string; sub: string;
  signal: string; accentBg: string; accentLine: string; scrim: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  dark: { void: '#1A2226', panel: '#232D32', line: '#37464D', text: '#E9F0EE', sub: '#BECBC8', signal: '#5EEAD4', accentBg: '#1D403A', accentLine: '#3F8879', scrim: 'rgba(3, 7, 9, .9)' },
  light: { void: '#F4F6F5', panel: '#FFFFFF', line: '#DCE3E1', text: '#13201D', sub: '#3B4B47', signal: '#0F8C7A', accentBg: '#DDF3EE', accentLine: '#8FCFC3', scrim: 'rgba(236, 242, 240, .94)' },
  paper: { void: '#EFE6D2', panel: '#F8F2E4', line: '#D8C9A8', text: '#2B2418', sub: '#4A3F2C', signal: '#8A4B12', accentBg: '#F1DEC2', accentLine: '#C99A63', scrim: 'rgba(239, 230, 210, .94)' },
};

export function themeName(v: unknown, fallback: ThemeName = 'dark'): ThemeName {
  return v === 'light' || v === 'paper' || v === 'dark' ? v : fallback;
}

let current: ThemeName = 'dark';
const listeners = new Set<(t: ThemeName) => void>();

export function currentTheme(): ThemeName {
  return current;
}

/** 지금 채팅의 배색이 바뀌면 알린다 (같으면 조용히) */
export function setCurrentTheme(t: ThemeName): void {
  if (t === current) return;
  current = t;
  for (const f of listeners) f(t);
}

export function onThemeChange(f: (t: ThemeName) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

const KEYS = Object.keys(PALETTES.dark) as (keyof Palette)[];

/**
 * 채팅 속 카드(첫 안내·기록 카드)의 배색. 카드 HTML은 메시지를 다시 그릴 때만 새로 만들어져서,
 * 색을 값으로 박으면 테마를 바꿔도 새로고침 전까지 그대로다. 그래서 본 화면 style이 바꿔 주는
 * CSS 변수로 쓰고, 그 style이 없을 때만 그린 때의 배색으로 보인다.
 */
export function cardPalette(t: ThemeName): Palette {
  const p = PALETTES[t];
  return Object.fromEntries(KEYS.map((k) => [k, `var(--goei-${k}, ${p[k]})`])) as unknown as Palette;
}

/** cardPalette의 변수에 지금 배색을 넣는 CSS (본 화면에 붙인다) */
export function cardVarsCss(t: ThemeName): string {
  const p = PALETTES[t];
  return `[data-goei-card] { ${KEYS.map((k) => `--goei-${k}: ${p[k]};`).join(' ')} }`;
}
