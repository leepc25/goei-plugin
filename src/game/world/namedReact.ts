// 이름 인물(캐릭터) 반응표 (10-31 사용자 확정: docs/캐릭터_반응표_초안_1031.md 를 그대로 데이터로).
// 캐릭터는 고정된 개성이 있다: 인물마다 상황별 포즈·말풍선·행동. 유형·무작위 성격 수치는 몹만.
import data from './namedReact.json';

/** ignore 하던 일, watch 그 자리에서 봄, approach 다가가 살핌, confront 마주 서서 버팀, attack 가해자 공격, protect 동료 곁으로, report 무전·신고, avoid 자리를 피함, flee 달아남, cower 웅크림 */
export type ReactAct = 'ignore' | 'watch' | 'approach' | 'confront' | 'attack' | 'protect' | 'report' | 'avoid' | 'flee' | 'cower';
export interface ReactCell { clip: string; icon: string; act: ReactAct }
export type ReactSituation = 'weapon' | 'body' | 'uproar' | 'crime' | 'allyHit' | 'allyDown';
export interface NamedReact extends Partial<Record<ReactSituation, ReactCell | null>> { combat: boolean; notes?: string }

const TABLE = data as unknown as Record<string, NamedReact>;
/** 그 인물의 반응표 (없으면 null = 표에 없는 인물) */
export const reactOf = (name: string): NamedReact | null => TABLE[name] ?? null;
/** 그 상황 반응 (표에 없거나 해당 없음이면 null) */
export const reactCell = (name: string, s: ReactSituation): ReactCell | null => TABLE[name]?.[s] ?? null;
