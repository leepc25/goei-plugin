// 인터넷 게시판 사이트 (2026-11-08 사용자: 괴담넷·괴담갤·세정게·연어 마켓은 사이트마다 따로. 글·쪽지·설정·지침 모두 따로).
// 게시판 코드(core/gnet.ts, gnetPrompt.ts, ui/gnet.ts)는 괴담넷 변수 이름($gn_*, $lb_cfg_lb-gn.*)만 안다.
// 다른 사이트는 읽을 때 그 사이트 변수를 괴담넷 이름으로 비춰 보이고(boardView), 쓸 때 되돌린다(boardWrite).
// 괴담넷(gn)은 그대로라 옛 채팅 변수와 같다.
import type { Chat, ScriptState } from './types';

export type BoardSite = 'gn' | 'gal' | 'wpf' | 'sm';
export const BOARD_SITES: BoardSite[] = ['gn', 'gal', 'wpf', 'sm'];
export const isBoardSite = (v: unknown): v is BoardSite => (BOARD_SITES as unknown[]).includes(v);
export const BOARD_NAME: Record<BoardSite, string> = { gn: '괴담넷', gal: '괴담갤', wpf: '세정게', sm: '연어 마켓' };
/** 요청문이 지금 어느 사이트인지 아는 변수 (보기에만 있고 저장하지 않는다) */
export const BOARD_SITE_VAR = '$gn_site';
/** 사이트마다 따로 두지 않는 괴담넷 변수: 닉네임은 인터넷 로그인 하나, 쪽지 자동 정리는 게시판 넷이 한 값 */
const SHARED = new Set(['$gn_nick', '$gn_storage_auto_dm', '$gn_storage_limit_dm']);
/** 게시판마다 따로 정하는 설정 (설정 → 인터넷의 격자). 그 밖의 게시판 설정($lb_cfg_lb-gn.*)은 네 게시판이 괴담넷 자리의 값 하나를 같이 쓴다 (2026-11-11 사용자) */
export const BOARD_OWN_CFG = ['mode', 'lazy', 'context', 'privacy', 'subject', 'mood', 'protagonist', 'post_min', 'post_max', 'cmt_min', 'cmt_max', 'act_min', 'act_max', 'incoming', 'incoming_chance'];
const OWN = new Set(BOARD_OWN_CFG);
const GN_CFG = '$lb_cfg_lb-gn.';
/** 네 게시판이 같이 쓰는 값인가 */
export const boardShared = (key: string): boolean => SHARED.has(key) || (key.startsWith(GN_CFG) && !OWN.has(key.slice(GN_CFG.length)));

/** 괴담넷 이름 → 그 사이트 이름. 사이트 변수가 아니면 null */
export function siteKey(key: string, site: BoardSite): string | null {
  if (boardShared(key) || key === BOARD_SITE_VAR) return null;
  if (key.startsWith('$lb_cfg_lb-gn.')) return site === 'gn' ? key : `$lb_cfg_lb-${site}.${key.slice(14)}`;
  if (key.startsWith('$gn_')) return site === 'gn' ? key : `$${site}_${key.slice(4)}`;
  if (key === '$cooldown_received_gnet') return site === 'gn' ? key : `$cooldown_received_${site}`;
  if (key === '$st_unread_gnet') return site === 'gn' ? key : `$st_unread_${site}`;
  return null;
}

/** 그 사이트 변수 이름 → 괴담넷 이름. 그 사이트 변수가 아니면 null */
function gnKey(key: string, site: BoardSite): string | null {
  if (site === 'gn') return siteKey(key, 'gn');
  const cfg = `$lb_cfg_lb-${site}.`;
  if (key.startsWith(cfg)) return OWN.has(key.slice(cfg.length)) ? `$lb_cfg_lb-gn.${key.slice(cfg.length)}` : null;
  if (key === `$cooldown_received_${site}`) return '$cooldown_received_gnet';
  if (key === `$st_unread_${site}`) return '$st_unread_gnet';
  if (key.startsWith(`$${site}_`)) {
    const gn = `$gn_${key.slice(site.length + 2)}`;
    return siteKey(gn, site) === key ? gn : null;
  }
  return null;
}

/** 괴담넷 이름으로 비춘 변수 (다른 사이트의 괴담넷 변수는 가린다) */
export function boardState(state: ScriptState | undefined, site: BoardSite): ScriptState {
  const src: ScriptState = state ?? {};
  if (site === 'gn') return { ...src, [BOARD_SITE_VAR]: 'gn' };
  const out: ScriptState = {};
  for (const [k, v] of Object.entries(src)) if (siteKey(k, site) === null && gnKey(k, site) === null) out[k] = v;
  for (const [k, v] of Object.entries(src)) {
    const g = gnKey(k, site);
    if (g) out[g] = v;
  }
  out[BOARD_SITE_VAR] = site;
  return out;
}

export const boardView = (chat: Chat, site: BoardSite): Chat => ({ ...chat, scriptstate: boardState(chat.scriptstate, site) });

/** 비춰 보던 채팅(view)에서 바뀐 것을 원래 채팅(base)에 되돌려 넣는다 */
export function boardWrite(base: Chat, view: Chat, site: BoardSite): Chat {
  const out: ScriptState = { ...(base.scriptstate ?? {}) };
  const vs = view.scriptstate ?? {};
  // 보기에서 지운 사이트 변수는 원래 채팅에서도 지운다
  if (site !== 'gn') for (const k of Object.keys(out)) if (gnKey(k, site) && !(gnKey(k, site)! in vs)) delete out[k];
  for (const [k, v] of Object.entries(vs)) {
    if (k === BOARD_SITE_VAR || (site !== 'gn' && gnKey(k, site))) continue;
    const s = siteKey(k, site);
    out[s ?? k] = v;
  }
  if (site === 'gn') delete out[BOARD_SITE_VAR];
  return { ...base, ...view, scriptstate: out };
}

/** 지금 비춰 보는 사이트 (요청문·설정 화면이 읽는다) */
export const viewSite = (state: Record<string, unknown> | undefined): BoardSite => {
  const v = state?.[BOARD_SITE_VAR];
  return isBoardSite(v) ? v : 'gn';
};
