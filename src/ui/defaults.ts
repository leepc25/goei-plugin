// 괴담톡·괴담넷·위키 설정 오른쪽 위 「덮어쓰기」「불러오기」 (v0.16.26, 사용자 설계: 메인 설정과 같은 동작).
// 덮어쓰기: 지금 채팅의 값을 새 채팅 기본값으로. 불러오기: 저장해 둔 기본값을 지금 채팅에. 누르면 확인을 한 번 더 받는다.
import { loadVarDefaults, saveVarDefaults } from '../host/prefs';
import { updateChat, type ChatContext } from '../host/risu';
import { ICONS } from './icons';

export type DefaultsPane = 'ph' | 'gn' | 'wiki' | 'pp' | 'jr';

const PREFIXES: Record<DefaultsPane, string[]> = {
  ph: ['$ph_'],
  /** 게시판 사이트 넷 (괴담넷·괴담갤·세정게·연어 마켓, 2026-11-08 사이트마다 따로) */
  gn: ['$lb_cfg_lb-gn.', '$gn_storage_', '$lb_cfg_lb-gal.', '$gal_storage_', '$lb_cfg_lb-wpf.', '$wpf_storage_', '$lb_cfg_lb-sm.', '$sm_storage_'],
  wiki: ['$nw_'],
  /** 인물 기록 (core/people/settings.ts PP). 메인 설정의 「덮어쓰기/불러오기」도 같은 접두어를 함께 다룬다 */
  pp: ['$pp_'],
  /** 기록 (core/journal/settings.ts JR): 채팅에 보고서 표시·일지 컨텍스트·상한 둘 */
  jr: ['$jr_'],
};
/** 메인 설정의 「덮어쓰기/불러오기」가 기능 설정과 함께 다루는 접두어 */
export const MAIN_PREFIXES = ['$gen_', '$pp_', '$it_'];
/** 설정 창 머리의 「기본값으로 저장」「기본값 불러오기」가 한 번에 다루는 채팅 변수 접두어 전부 (2026-10-29 사용자: 「현재 모든 상태가 한방에」).
 *  화면·이미지·상황판·괴이 발생·테마는 settings.ts set-bar-yes 가 따로 더한다 */
// 소지품 페이지(가계부 옵션 $st_wallet_*·상점 $sh_*)와 상태창 칸 구성($st_col_*)도 (11-08 전수점검: 「기본값으로 저장·불러오기」에서 빠져 있었다.
// 「초기값으로」는 이미 다루고 있었음). 칸 구성 기록($st_col_log)은 채팅마다라 PREF_VAR 에서 빠진다
// 상점 표(설정 → 상점)의 쇼핑몰·망상홈쇼핑 값($cos_sh_*·$bm_sh_*·$hs_sh_*·$hs_on)과 「한 번에 요청」($net_joint)도 (11-11: 빠져 있었다).
// 쇼핑몰·망상홈쇼핑 개별 화면 값(진열 방식·1:1 상담·방송 수치)도 (11-12 사용자). 상태 변수(진열대·방송·주문)는 PREF_VAR 가 이름으로 걸러 낸다:
// $cos_·$bm_ 는 통째로 넣지 않고, $hs_ 는 PREF_VAR 에 설정 이름만 적혀 있다
export const ALL_PREFIXES = [...new Set([...MAIN_PREFIXES, '$st_col_', '$st_wallet_', '$sh_', '$cos_sh_', '$bm_sh_', '$hs_', '$cos_roll_', '$bm_roll_', '$bm_desk_', '$cos_ready', '$cos_truth', '$cos_fixed', '$net_joint', ...Object.values(PREFIXES).flat()])];
const NAME: Record<DefaultsPane, string> = { ph: '괴담톡', gn: '괴담넷', wiki: '위키', pp: '인물 기록', jr: '기록' };

export const defaultsAsk = { pane: '' as DefaultsPane | '', what: '' as '' | 'save' | 'load' };

/** 설정·명부 위쪽 줄과 같은 두 버튼 */
export const defaultsButtons = (pane: DefaultsPane, off = false): string =>
  `<span class="ps-defaults"><button class="st-act save" data-action="${pane}-def-ask" data-value="save" ${off ? 'disabled' : ''}>${ICONS.pen}기본값으로 저장</button><button class="st-act" data-action="${pane}-def-ask" data-value="load" ${off ? 'disabled' : ''}>${ICONS.refresh}기본값 불러오기</button></span>`;

/** 버튼을 누른 뒤 확인 줄 (설정 화면 머리 아래) */
export function defaultsConfirm(pane: DefaultsPane): string {
  if (defaultsAsk.pane !== pane || !defaultsAsk.what) return '';
  const save = defaultsAsk.what === 'save';
  const text = save ? `지금 ${NAME[pane]} 설정을 새 채팅 기본값으로 저장할까요?` : `저장해 둔 ${NAME[pane]} 기본값을 이 채팅에 불러올까요?`;
  return `<div class="st-confirm st-barconfirm ps-defconfirm"><p>${text}</p><div class="gx-row-btns"><button class="gx-mini${save ? ' ps-save' : ' danger'}" data-action="${pane}-def-yes">${save ? '저장' : '불러오기'}</button><button class="gx-mini" data-action="${pane}-def-no">취소</button></div></div>`;
}

/**
 * {pane}-def-ask / -yes / -no. 처리했으면 결과 문구(빈 문자열이면 문구 없음), 이 버튼의 동작이 아니면 null.
 * 실패는 throw. 채팅을 고쳤으면 refresh를 부른다.
 */
export async function defaultsAction(pane: DefaultsPane, action: string, value: string, ctx: ChatContext, refresh: () => Promise<void>): Promise<string | null> {
  const sub = action.slice(pane.length + 1);
  if (sub === 'def-ask') {
    defaultsAsk.pane = pane;
    defaultsAsk.what = value === 'save' || value === 'load' ? value : '';
    return '';
  }
  if (sub === 'def-no') {
    defaultsAsk.pane = '';
    defaultsAsk.what = '';
    return '';
  }
  if (sub !== 'def-yes') return null;
  const what = defaultsAsk.pane === pane ? defaultsAsk.what : '';
  defaultsAsk.pane = '';
  defaultsAsk.what = '';
  if (what === 'save') {
    await saveVarDefaults(PREFIXES[pane], ctx.chat.scriptstate);
    return `지금 ${NAME[pane]} 설정을 새 채팅 기본값으로 저장했어요.`;
  }
  if (what === 'load') {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...loadVarDefaults(PREFIXES[pane], chat.scriptstate) } }));
    await refresh();
    return `새 채팅 기본값을 지금 ${NAME[pane]}에 불러왔어요.`;
  }
  return '';
}
