// 지침 탭 「추가 규칙」: 규칙마다 제목·붙일 곳·켬/끔·본문. 이 기기 설정(prefs.rules)에 두고
// core/guides.ts guidePrompt 가 붙일 지침의 늘 쓰이는 절 끝에 넣는다. 바꾸면 바로 저장 (글은 잠깐 모아서).
import { getUserRules, RULE_TARGET_LABEL, RULE_TARGETS, setUserRules, type RuleTarget, type UserRule } from '../../core/guides';
import { tokens } from '../../core/gnet';
import { tokenizerName } from '../../core/tokenizer';
import { savePrefs } from '../../host/prefs';
import { switchHtml } from '../controls';
import { ICONS } from '../icons';
import { copyBtn } from '../copy';
import { keepOpen, markOpen } from '../panels';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const ruleUi = { confirmDel: '', info: '' };
/** 저장 상한 (core/settings.ts setPrefs 와 같은 값) */
export const RULE_MAX = 100;
export const RULE_TITLE_MAX = 80;
export const RULE_TEXT_MAX = 20000;

export const isRuleNode = (n: string): n is `rule:${string}` => n.startsWith('rule:');
export const ruleId = (n: string): string => n.slice(5);

const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function saveRules(next: UserRule[]): Promise<void> {
  setUserRules(next);
  await savePrefs((p) => (next.length ? { ...p, rules: next } : (({ rules: _r, ...rest }) => rest)(p)));
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: UserRule[] | null = null;
/** 글 입력은 0.4초 모아서 저장 (키 하나마다 저장소를 쓰지 않게) */
function saveSoon(next: UserRule[]): void {
  setUserRules(next);
  pending = next;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const p = pending;
    pending = null;
    if (p) void saveRules(p);
  }, 400);
}

/** 왼쪽 목록 항목: [노드, 이름, 배지 HTML]. 11-09 사용자: 규칙마다 메뉴가 늘어나지 않게 「추가 규칙」 한 항목에 모은다 */
export function ruleTreeItems(): [string, string, string][] {
  const n = getUserRules().length;
  return [['rule:all', '추가 규칙', n ? `<i class="gw-tree-badge">${n}</i>` : '']];
}

/** 규칙 하나의 편집 칸 (접는 칸 안) */
function ruleBox(r: UserRule): string {
  const chips = RULE_TARGETS.map((t) => `<button class="gx-chip${r.to.includes(t) ? ' on' : ''}" data-action="ed-rule-to" data-value="${esc(`${r.id}|${t}`)}" aria-pressed="${r.to.includes(t)}">${RULE_TARGET_LABEL[t]}</button>`).join('');
  const del = ruleUi.confirmDel === r.id
    ? `<button class="gx-mini danger" data-action="ed-rule-del-yes" data-value="${esc(r.id)}">정말 지우기</button><button class="gx-mini" data-action="ed-rule-del-no">취소</button>`
    : `<button class="gx-mini danger" data-action="ed-rule-del" data-value="${esc(r.id)}">${ICONS.trash}지우기</button>`;
  const key = `rule-${r.id}`;
  return `<details class="ps-adv gw-rule" data-keep="${esc(key)}"${keepOpen(key)}><summary class="ps-adv-sum"><b>${esc(r.title.trim() || '(제목 없음)')}</b><span class="adv-count">${r.to.map((t) => RULE_TARGET_LABEL[t]).join(' · ') || '붙일 곳 없음'} · ${tokenizerName() ? '' : '약 '}${tokens(r.text).toLocaleString()}토큰</span><span class="gw-state${r.on ? '' : ' off'}">${r.on ? '켬' : '끔'}</span></summary><div class="ps-adv-body">
    <div class="ps-rows">
      <div class="ps-row"><div class="ps-label"><b>사용</b><small>끄면 어느 지침에도 붙지 않아요. 글은 남아요.</small></div><div class="ps-ctl">${switchHtml({ action: 'ed-rule-on', value: r.id, on: r.on })}</div></div>
      <div class="ps-row"><div class="ps-label"><b>제목</b><small>규칙 글 위에 작은 제목으로 들어가요.</small></div><div class="ps-ctl"><input class="gw-rule-title" data-input="ed-rule-title" data-key="${esc(r.id)}" value="${esc(r.title)}" placeholder="예: 대사 길이" autocomplete="off" maxlength="${RULE_TITLE_MAX}"></div></div>
      <div class="ps-row"><div class="ps-label"><b>붙일 곳</b><small>본편 = RP 지침 끝 · 이동·임무 = COMMON 절 · 괴담넷 = 게시판 절 · 괴담톡·필드 = COMMON 절 · 위키 = 작성 안내 절</small></div><div class="ps-ctl"><div class="dir-chips">${chips}</div></div></div>
      <div class="ps-row"><div class="ps-label"><b>본문</b><small>모델에게 그대로 가요. 지침 언어(영어)와 맞추면 더 잘 따라요.</small></div>
        <div class="gw-copyto gw-copybox"><textarea data-input="ed-rule-text" data-key="${esc(r.id)}" rows="6" placeholder="규칙 글" maxlength="${RULE_TEXT_MAX}">${esc(r.text)}</textarea>${copyBtn()}</div></div>
      <div class="ps-row gw-rel-foot">${del}</div>
    </div></div></details>`;
}

/** 추가 규칙 한 페이지: 규칙마다 접는 칸 (11-09 사용자: 규칙은 별도 메뉴가 아니라 한곳에) */
export function rulePage(_node: string): string {
  const rules = getUserRules();
  return `<div class="gw-page gw-set"><header class="gw-head"><h2>추가 규칙<small>이 기기 공통</small></h2>
      <div class="gw-head-act"><span class="gw-tokens">${rules.length}/${RULE_MAX}</span><button class="gx-mini primary" data-action="ed-rule-new" ${rules.length >= RULE_MAX ? 'disabled' : ''}>${ICONS.plus}새 규칙</button></div>
      ${ruleUi.info ? `<p class="gx-hint">${esc(ruleUi.info)}</p>` : ''}<p class="gx-muted">기본 지침을 고치지 않고 내 규칙을 덧붙여요. 규칙마다 어느 지침에 붙일지 고르면, 그 지침의 늘 쓰이는 절 끝에 「User Rules」로 들어가요. 이 기기의 모든 채팅에 적용돼요. 바꾸면 바로 저장돼요. 예) 「대사 길이」 규칙을 본편·필드에 붙이기: "한 번에 한 사람이 세 문장 넘게 말하지 않는다."</p></header>
    <div class="gx-settings gw-setbody">${rules.length ? rules.map(ruleBox).join('') : '<p class="ps-note">아직 규칙이 없어요. 「새 규칙」을 눌러 하나 만들어요.</p>'}</div>
  </div>`;
}

export function ruleInput(name: string, key: string, value: string): boolean {
  if (name !== 'ed-rule-title' && name !== 'ed-rule-text') return false;
  const next = getUserRules().map((r) => (r.id === key ? { ...r, [name === 'ed-rule-title' ? 'title' : 'text']: value } : r));
  saveSoon(next);
  return true;
}

/** ed-rule-* 동작. 노드를 바꿔야 하면 그 노드를 돌려준다 */
export async function ruleAction(action: string, value: string | undefined): Promise<false | true | `rule:${string}`> {
  if (!action.startsWith('ed-rule-')) return false;
  const rules = getUserRules();
  switch (action) {
    case 'ed-rule-new': {
      // 저장 상한 100개 (core/settings.ts setPrefs). 넘기면 저장소에서 조용히 잘려 「없는 규칙」 화면이 되던 것 (2026-10-28 QC)
      if (rules.length >= RULE_MAX) {
        ruleUi.info = `규칙은 ${RULE_MAX}개까지예요. 안 쓰는 규칙을 지우고 다시 추가해 주세요.`;
        return true;
      }
      const r: UserRule = { id: uid(), title: '', text: '', to: ['RP'], on: true };
      await saveRules([...rules, r]);
      ruleUi.info = '';
      markOpen(`rule-${r.id}`); // 새 규칙 칸은 펼친 채로
      return 'rule:all';
    }
    case 'ed-rule-on':
      await saveRules(rules.map((r) => (r.id === value ? { ...r, on: !r.on } : r)));
      return true;
    case 'ed-rule-to': {
      const [id, t] = (value ?? '').split('|') as [string, RuleTarget];
      if (!RULE_TARGETS.includes(t)) return true;
      await saveRules(rules.map((r) => (r.id === id ? { ...r, to: r.to.includes(t) ? r.to.filter((x) => x !== t) : [...r.to, t] } : r)));
      return true;
    }
    case 'ed-rule-del':
      ruleUi.confirmDel = value ?? '';
      return true;
    case 'ed-rule-del-no':
      ruleUi.confirmDel = '';
      return true;
    case 'ed-rule-del-yes': {
      ruleUi.confirmDel = '';
      await saveRules(rules.filter((r) => r.id !== value));
      return 'rule:all';
    }
  }
  return true;
}
