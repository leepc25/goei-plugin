// 괴담톡·괴담넷·위키 설정 오른쪽 위 「덮어쓰기」「불러오기」 (v0.16.26, 사용자 설계: 메인 설정과 같은 동작).
// 덮어쓰기: 지금 채팅의 값을 새 채팅 기본값으로. 불러오기: 저장해 둔 기본값을 지금 채팅에. 누르면 확인을 한 번 더 받는다.
import { loadVarDefaults, saveVarDefaults } from '../host/prefs';
import { updateChat, type ChatContext } from '../host/risu';
import { ICONS } from './icons';

export type DefaultsPane = 'ph' | 'gn' | 'wiki' | 'visit' | 'pp';

const PREFIXES: Record<DefaultsPane, string[]> = {
  ph: ['$ph_'],
  gn: ['$lb_cfg_lb-gn.', '$gn_storage_'],
  wiki: ['$nw_'],
  visit: ['$hq_'],
  /** 인물 기록 (core/people/settings.ts PP). 메인 설정의 「덮어쓰기/불러오기」도 같은 접두어를 함께 다룬다 */
  pp: ['$pp_'],
};
/** 메인 설정의 「덮어쓰기/불러오기」가 기능 설정과 함께 다루는 접두어 */
export const MAIN_PREFIXES = ['$gen_', '$hq_adv_', '$pp_'];
/** 설정 창 머리의 「기본값으로 저장」「기본값 불러오기」가 한 번에 다루는 채팅 변수 접두어 전부 (2026-10-29 사용자: 「현재 모든 상태가 한방에」).
 *  화면·이미지·상황판·괴이 발생·테마는 settings.ts set-bar-yes 가 따로 더한다 */
export const ALL_PREFIXES = [...new Set([...MAIN_PREFIXES, ...Object.values(PREFIXES).flat()])];
const NAME: Record<DefaultsPane, string> = { ph: '괴담톡', gn: '괴담넷', wiki: '위키', visit: '필드', pp: '인물 기록' };

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
