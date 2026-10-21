// 화면에 나오는 이름·색·사진 열쇠
import type { AgentId, SpeakerId } from './types';
import { AGENTS } from './lines/agents';

export interface CastInfo {
  name: string;
  color: string;
  /** assets/agents/<photo>_default.avif. 없으면 이름 첫 글자 */
  photo?: string;
}

export const CAST: Record<Exclude<SpeakerId, AgentId | 'agent'>, CastInfo> = {
  jaemtri: { name: '잼트리', color: '#27685b', photo: 'Jaemtri' },
  gognija: { name: '고그니쟈', color: '#c9a227', photo: 'Gognija' },
  dejure: { name: '데쥬레', color: '#e58fb5', photo: 'Dejure' },
  konjyuce: { name: '콘쥬스', color: '#e0457b', photo: 'Konjyuce' },
  madeokhee: { name: '마덕희', color: '#7d2a3a', photo: 'Ma Deok-hee' },
  elevator: { name: '승강기', color: '#b8a36a' },
  passenger: { name: '승객', color: '#8a8f86' },
  survivor: { name: '생존자', color: '#9aa7b3' },
  fake: { name: '가짜 관리국', color: '#444b55' },
  daydream: { name: '백일몽', color: '#7a6aa8' },
  narr: { name: '', color: '#6b7280' },
  radio: { name: '무전', color: '#4b8f8c' },
};

export function castOf(who: SpeakerId, agent: AgentId): CastInfo {
  const id = who === 'agent' ? agent : who;
  const a = AGENTS[id as AgentId];
  if (a) return { name: a.name, color: a.color, photo: a.photo };
  return CAST[id as keyof typeof CAST] ?? { name: String(id), color: '#888' };
}

export const MALE_AGENTS: AgentId[] = ['gorgodio', 'kyuras'];
