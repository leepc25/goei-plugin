// 창 밖에 그리는 것(플로팅 버튼·접속 효과·채팅 속 기록 카드)도 창과 같은 배색을 쓰게 하는 작은 배색표.
// 값은 style.css의 :root / [data-theme] 토큰과 같다.
export type ThemeName = 'dark' | 'light' | 'paper';

export interface Palette {
  void: string; panel: string; line: string; text: string; sub: string;
  signal: string; accentBg: string; accentLine: string; scrim: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  dark: { void: '#0B1215', panel: '#121B1F', line: '#24343B', text: '#E6EEEC', sub: '#B5C4C0', signal: '#5EEAD4', accentBg: '#10302C', accentLine: '#2C6E63', scrim: 'rgba(3, 7, 9, .9)' },
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
