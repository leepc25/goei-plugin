// 화장실 (2026-11-01, 스레드 「화장실 게임에 넣기」): 남자 화장실(wc, 2층)·여자 화장실(wc3, 3층)의 칸·소변기·세면대 자리.
// 자리 좌표는 그림에서 땄다 (tools/mapedit/author_hq_wc.py → PAINTED.wc.toilets → 장면 toilets).
// - 칸(stall): 문 앞에 와서 문이 열리고 → 안 좌석에 앉아(101 → 102 → 103, 화면 쪽을 봄) → 문이 닫히고 → 끝나면 문이 열리고 나와서 닫힘.
//   남자 화장실은 오른쪽부터 1·2번 칸만 쓴다(맨 왼쪽 칸은 늘 닫힘, 자리 자체가 없음).
// - 소변기(urinal): 남자만(100 줄이 있는 사람), 벽을 보고 선다. 세면대(sink): 벽을 보고 손 씻기(104).
// - 성별: 남 소변(100) 줄이 있으면 남자, 없고 앉아 볼일(102)이 있으면 여자 (동작표: 100은 남자 인물에게만 있다).
import type { Activity } from './needs';

/** 볼일 뒤 손 씻기 (욕구를 채우지 않는 짧은 일) */
export const WASH: Activity = { id: 'wash', need: 'bladder', clip: 'line:104', where: ['restroom'], sec: [4, 6], fill: 0, label: '손 씻는 중' };

/** 칸 문이 열리고 닫히는 데 걸리는 초 (문 그림 6장면) */
export const STALL_DOOR_SEC = 0.45;

/** 앉은 줄 102 첫 장의 허벅지 윗선(도트, 캔버스 y). 좌석 자리는 이 기준값(큐라스)으로 땄고, 사람마다 다르면 여기에 그 값을 적는다.
 * 2026-11-01 본부 인물 16명(종합대응·진압·격리팀 12명 + 관리국 요원 남녀 4명)을 기준값으로 앉혀 확인: 모두 좌석에 맞아 따로 적은 값 없음.
 * 열쇠 = 인물 그림 키(이름 인물은 이름, 몹은 look) */
export const TOILET_LAP: Record<string, number> = {};
export const LAP_BASE = 167;

/** 칸 좌석에 앉은 사람의 발 자리: 기준 발 자리에서 (기준 허벅지선 - 그 사람 허벅지선) × 도트 배율만큼 */
export function seatFeet(seat: { x: number; y: number; k?: number }, look: string): { x: number; y: number } {
  const lap = TOILET_LAP[look] ?? LAP_BASE;
  return { x: seat.x, y: seat.y + (LAP_BASE - lap) * (seat.k ?? 1.25) };
}

/** 필드 스레드(침입 감지·대사)가 쓰는 것: 화장실 안 사람마다 지금 어디서 무엇을 하는지·어느 쪽을 보는지.
 * at: stall = 칸 안(닫힌 문 뒤, 들어가는 중·나오는 중 포함), urinal·sink = 그 앞에서 벽(북)을 봄, walk = 그 밖(서 있거나 걷는 중).
 * face: N = 벽을 봄(뒤통수가 화면), S = 화면을 봄, E·W = 옆. phase = 칸에서 문 열림·안·나옴 */
export interface ToiletUse {
  id: string;
  name: string;
  kind: 'named' | 'mob' | 'player';
  sex: '남' | '여' | null;
  at: 'stall' | 'urinal' | 'sink' | 'walk';
  face: 'N' | 'S' | 'E' | 'W';
  x: number;
  y: number;
  /** 쓰는 자리 id (stall0, urinal1, sink2 …) */
  spot?: string;
  phase?: 'open' | 'in' | 'leave';
}
