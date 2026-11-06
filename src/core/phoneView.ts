// 괴담톡 보기 전용 방 (라이트보드 미니톡 사전설정 셋, 2026-11-06 사용자 「전부 넣어야지」)
// - 사이드스토리: 본편에 안 나온 짧은 대화. 시점 인물 곁 인물들끼리 일상 이야기
// - 혼잣말: 시점 인물 한 명의 속마음을 메시지처럼
// - 다중인격 혼잣말: 시점 인물의 마음속 여러 갈래(1~9)가 단톡처럼 주고받는다
// 내가 끼지 않는 방이라 괴담톡 대화 기록(PState)과 따로 둔다. 선톡·새로고침·채팅 반영에는 섞이지 않는다.
import { decodeJson, parseReactions, PH, phoneValue, PhoneError } from './phone';

export type ViewPreset = 'side' | 'mono' | 'multi';
export const VIEW_PRESETS: Record<ViewPreset, string> = { side: '사이드스토리', mono: '혼잣말', multi: '다중인격 혼잣말' };
export const PH_VIEWS = PH('views');
export const PH_VIEW_LAST = PH('view_last');
export const VIEW_KEEP = 30;
export const VIEW_LIMITS = { messages: 30, text: 600, name: 60, people: 10 };

export interface ViewPerson { id: string; name: string }
export interface ViewMsg { sender: string; type: 'text' | 'pause' | 'skip'; text: string; reactions?: string }
export interface ViewRoom {
  id: string;
  preset: ViewPreset;
  name: string;
  pov: string;
  people: ViewPerson[];
  messages: ViewMsg[];
  time: string;
  unread: boolean;
}

export interface ViewSettings {
  preset: ViewPreset;
  /** 시점 인물 (비우면 주인공) */
  pov: string;
  /** 시점 인물의 말을 모델이 써도 되는지 (원본 「사칭 허용」) */
  speak: boolean;
  /** 등장인물 범위 (사이드스토리): 0 주요 인물 / 1 장면 안 / 2 장면 안 주요 인물 / 3 자율 */
  scope: '0' | '1' | '2' | '3';
  /** 방 크기 (사이드스토리): 0 자동 / 1 둘이서 / 2 여럿 */
  size: '0' | '1' | '2';
  /** 발동: 수동 / 창을 열 때 / 매 턴 */
  auto: 'manual' | 'open' | 'turn';
}

export function viewSettings(state: Record<string, unknown> | undefined): ViewSettings {
  const v = (k: string) => phoneValue(state, k);
  const preset = v('view_preset');
  const scope = v('view_scope');
  const size = v('view_size');
  const auto = v('view_auto');
  return {
    preset: preset === 'mono' || preset === 'multi' ? preset : 'side',
    pov: v('view_pov').trim().slice(0, 40),
    speak: v('view_speak') === '1',
    scope: scope === '1' || scope === '2' || scope === '3' ? scope : '0',
    size: size === '1' || size === '2' ? size : '0',
    auto: auto === 'open' || auto === 'turn' ? auto : 'manual',
  };
}

export function readViews(state: Record<string, unknown> | undefined): ViewRoom[] {
  try {
    const v = JSON.parse(String(state?.[PH_VIEWS] ?? '[]'));
    return Array.isArray(v) ? v.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.messages) && Array.isArray(r.people)) : [];
  } catch {
    return [];
  }
}

export const writeViews = (list: ViewRoom[]): Record<string, string> => ({ [PH_VIEWS]: JSON.stringify(list.slice(-VIEW_KEEP)) });
export const viewUnread = (list: ViewRoom[]) => list.filter((r) => r.unread).length;

/** 이어 쓸 때 참고할 같은 종류의 마지막 방 (모델에 보낼 모양) */
export function previousView(list: ViewRoom[], preset: ViewPreset): unknown {
  const r = [...list].reverse().find((x) => x.preset === preset);
  if (!r) return undefined;
  return {
    name: r.name, pov: r.pov, participants: r.people,
    messages: r.messages.map((m) => ({ sender: m.type === 'text' ? m.sender : '-', type: m.type, content: m.type === 'text' ? m.text : m.type === 'pause' ? m.text : '-' })),
  };
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** 응답 {name, pov, participants:[{id,name}], messages:[{sender,type,content,reactions}]} → 방. 틀린 말풍선만 빼고, 남는 게 없으면 실패 */
export function parseView(raw: string, preset: ViewPreset): Omit<ViewRoom, 'id' | 'time' | 'unread'> {
  const value = decodeJson(raw) as Record<string, unknown>;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PhoneError('보기 전용 방 형식이 올바르지 않아요.', raw);
  const people: ViewPerson[] = [];
  for (const p of (Array.isArray(value.participants) ? value.participants : []) as Record<string, unknown>[]) {
    const id = str(p?.id).slice(0, 40);
    const name = str(p?.name).slice(0, VIEW_LIMITS.name);
    if (id && name && id !== '-' && !people.some((x) => x.id === id)) people.push({ id, name });
  }
  const pov = str(value.pov);
  if (!people.length || !people.some((p) => p.id === pov)) throw new PhoneError('시점 인물이 참여자 목록에 없어요.', raw);
  if (preset === 'mono' && people.length !== 1) people.splice(0, people.length, people.find((p) => p.id === pov)!);
  const ids = new Set(people.slice(0, VIEW_LIMITS.people).map((p) => p.id));
  const messages: ViewMsg[] = [];
  for (const m of (Array.isArray(value.messages) ? value.messages : []) as Record<string, unknown>[]) {
    const type = str(m?.type);
    const content = str(m?.content);
    if (type === 'text' && ids.has(str(m?.sender)) && content) {
      const cap = ids.size - 1;
      const reactions = cap > 0 ? parseReactions(m?.reactions).map((r) => `${r.emoji}${Math.min(r.count, cap)}`).join(' ') : '';
      messages.push({ sender: str(m.sender), type: 'text', text: content.slice(0, VIEW_LIMITS.text), ...(reactions ? { reactions } : {}) });
    } else if (type === 'pause' && content && content !== '-' && [...content].length <= 12) messages.push({ sender: '-', type: 'pause', text: content });
    else if (type === 'skip' && messages.length && messages[messages.length - 1].type !== 'skip') messages.push({ sender: '-', type: 'skip', text: '' });
    if (messages.length >= VIEW_LIMITS.messages) break;
  }
  while (messages.length && messages[messages.length - 1].type !== 'text') messages.pop();
  if (!messages.some((m) => m.type === 'text')) throw new PhoneError('보기 전용 방에 메시지가 하나도 없어요.', raw);
  const name = str(value.name).slice(0, VIEW_LIMITS.name) || VIEW_PRESETS[preset];
  return { preset, name, pov, people: people.filter((p) => ids.has(p.id)), messages };
}
