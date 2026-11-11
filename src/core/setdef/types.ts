// 설정 정의표 (2026-11-11 설정 개편 2단계). 설정 한 줄을 자료로 적는다.
// 화면(ui/setrow.ts)은 이 표를 읽어 줄을 그리고, 「인터넷」 표·관제 화면·기본값 저장·AI 상담 창도 같은 표를 읽는다.
// 규칙은 docs 「설정_기준서」: 줄을 더하거나 옮길 때는 여기 한 줄만 고친다. 화면 코드에 줄을 직접 쓰지 않는다.

/** 조작 모양 */
export type SetCtl =
  /** 고르기. 선택지가 ON/OFF 둘뿐이면 스위치로 그린다. fb = 저장값이 선택지에 없을 때 보일 값 */
  | { t: 'seg'; opts: [string, string][]; fb?: string }
  /** 최소·최대 두 칸. 저장 열쇠는 「열쇠_min」「열쇠_max」. act = 버튼 이름 꼬리 (기본 count) */
  | { t: 'minmax'; lo: number; hi: number; unit: string; act?: 'count' | 'num' | 'shnum'; keys?: [string, string] }
  /** 수 한 칸 */
  | { t: 'num'; lo: number; hi: number; unit: string; act?: 'num' | 'shnum' }
  /** 글 한 줄 */
  | { t: 'text'; ph: string; max?: number }
  /** 줄이기·늘리기 단추. 버튼 값은 「열쇠:-」「열쇠:+」 */
  | { t: 'step'; lo: number; hi: number; unit: string; action?: string; vkey?: string }
  /** 글 여러 줄. 이름 없이 줄 전체를 쓴다 */
  | { t: 'area'; ph: string; rows: number; cls: string; labeled?: boolean }
  /** 페이지가 직접 그리는 조작 (값이 둘 이상 얽힌 줄). 줄 이름·설명은 표를 따른다 */
  | { t: 'custom' };

/** 여러 페이지가 똑같이 갖는 줄의 종류 (기준서 3절). 「인터넷」 표와 관제 화면이 이 값으로 줄을 모은다 */
export type SetCommon = 'auto' | 'joint' | 'model' | 'ctx' | 'sampling';

export interface SetDef {
  /** 페이지 안에서 하나뿐인 열쇠. 버튼 값과 저장 변수 이름의 끝이 된다 */
  key: string;
  label: string;
  /** 설명. 값마다 다르면 { 값: 글 } */
  help?: string | Record<string, string>;
  ctl: SetCtl;
  common?: SetCommon;
  /** 읽어 주기용 이름 (줄 이름과 다를 때) */
  aria?: string;
  /** 조작 옆에 붙는 수 칸 (켬·끔 + 확률, 켬·끔 + 상한). whenOn = 켜져 있을 때만 보인다 */
  inline?: { key: string; lo: number; hi: number; unit: string; aria?: string; whenOn?: boolean };
  /** 다른 줄의 값이 이럴 때만 보이는 줄 */
  show?: { key: string; eq: string };
}
export interface SetGroup {
  /** 묶음 이름. '@page' 면 페이지 이름을 쓴다 */
  title: string;
  rows: SetDef[];
  /** 묶음 머리 아래 안내 글 (HTML) */
  note?: string;
}
/** 한 기능(페이지 계열)의 설정 */
export interface SetPage {
  /** 기능 열쇠 (gn·ph·wk…). 버튼 이름의 머리이기도 하다: 「gn-cfg」 */
  id: string;
  /** 버튼 꼴. 없으면 「gn-cfg」에 값 「열쇠=값」. flat 이면 「wiki-열쇠」에 값만 */
  flat?: boolean;
  groups: SetGroup[];
}

const ONOFF: [string, string][] = [['1', 'ON'], ['0', 'OFF']];
/** 켬·끔 스위치. on = 켬일 때 저장되는 값 (끔은 반대) */
export const onOff = (fb: '0' | '1' = '0', on: '0' | '1' = '1'): SetCtl => ({ t: 'seg', opts: on === '1' ? ONOFF : [['0', 'ON'], ['1', 'OFF']], fb });

/** 표에서 줄 하나 찾기 */
export function findDef(page: SetPage, key: string): SetDef | undefined {
  for (const g of page.groups) for (const r of g.rows) if (r.key === key) return r;
  return undefined;
}
/** 표의 모든 줄 */
export const allDefs = (page: SetPage): SetDef[] => page.groups.flatMap((g) => g.rows);
