// 지침 편집 (docs/설계안_세계편집.md 3장): 글칸 하나 + 자리표 안내 + 토큰. 고친 글은 이 기기 설정(prefs.guides)에 두고 core/guides.ts 가 요청에 쓴다.
import { guideDefault, guideOverridden, guideText, GUIDE_LABEL, isGuideName, joinGuide, setGuideOverride, splitGuide, type GuideName } from '../../core/guides';
import { tokenizerName } from '../../core/tokenizer';
import { tokens } from '../../core/gnet';
import { savePrefs } from '../../host/prefs';
import { ICONS } from '../icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const guideUi = { draft: {} as Partial<Record<GuideName, string>>, info: '' };
/** 저장 상한 (core/settings.ts setPrefs 와 같은 값) */
export const GUIDE_MAX = 120000;

const HELP: Record<GuideName, string> = {
  GNet: '괴담넷 게시판 글 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Phone: '괴담톡(연락처·문자) 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Wiki: '위키 문서 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Directive: '요원 이동·커스텀 임무 때 모델에 주는 장면 지시문. COMMON·OPENING·CONTINUATION·CONTEXT·FORMAT(JSON) 절.',
  Visit: '본부 방문 대화 지침. __LIMIT_LINE__ 은 설정의 글자 수로 바뀌어요.',
  RP: '카드 description 에 있던 RP 지침(세계 설정·진행 원칙). 요청 맨 앞 로어 덩어리에 들어가요. 카드 description 에 「## RP Guidance」가 남아 있으면 넣지 않아요.',
  Tag: '상황판 태그 지침. 상태창 절은 `{status_section}` 자리에 설정 「상황판 → 상태창 칸」의 구성대로 자동으로 만들어져요(형식·규칙·예시). 그 자리표와 {{getvar::…}} 자리표는 그대로 두세요.',
};

export function guidePage(name: GuideName, crumb = ''): string {
  const text = guideUi.draft[name] ?? guideText(name);
  const dirty = guideUi.draft[name] !== undefined && guideUi.draft[name] !== guideText(name);
  // 절 단위 글칸 (2026-10-27 사용자): 구분 줄(@@SECTION·===·##)은 플러그인이 들고, 사용자는 절 본문만 고친다
  // 글칸 첫 줄바꿈 하나는 HTML 이 떼어 버리므로(<textarea>\n…) 하나를 더 넣어 본문이 줄바꿈으로 시작해도 그대로 보이게 (2026-10-28 QC: 제목 뒤 빈 줄이 사라졌다)
  const parts = splitGuide(text);
  const rows = parts
    .map((p, i) => `<div class="gw-field"><div class="gw-field-head"><b>${esc(p.title)}</b>${p.head && p.head !== '\n' ? `<small class="gw-ftitle">${esc(p.head.trim())}</small>` : ''}<span class="gw-ftok">${tokens(p.body) ? `${tokens(p.body).toLocaleString()}토큰` : ''}</span></div>
      <textarea data-input="ed-guide-sec" data-key="${name}|${i}" rows="3" spellcheck="false">\n${esc(p.body)}</textarea></div>`)
    .join('');
  const title = crumb
    ? `<h2>${esc(GUIDE_LABEL[name])}<small>이 기기 공통${guideOverridden(name) ? ' · 고침' : ' · 기본'} · ${parts.length}절</small></h2>`
    : `<h3>${esc(GUIDE_LABEL[name])} 지침<small>이 기기 공통${guideOverridden(name) ? ' · 고침' : ' · 기본'} · ${parts.length}절</small></h3>`;
  return `<div class="gw-page${crumb ? ' gw-set' : ''}"><header class="gw-head">${title}
      <div class="gw-head-act"><span class="gw-tokens">${tokenizerName() ? '' : '약 '}${tokens(text).toLocaleString()}토큰</span>
        <button class="gx-mini" data-action="ed-guide-save" data-value="${name}" ${dirty ? '' : 'disabled'}>${ICONS.pen}지침 저장</button>
        <button class="gx-mini" data-action="ed-guide-reset" data-value="${name}" ${guideOverridden(name) || dirty ? '' : 'disabled'}>기본으로</button></div>
      <p class="gx-muted">${esc(HELP[name])}</p>${guideUi.info ? `<p class="gx-hint">${esc(guideUi.info)}</p>` : ''}</header>
    <div class="gw-fields gw-guide-secs">${rows}</div>
  </div>`;
}

/** 입력 중 머리의 「지침 저장」「기본으로」 잠금과 토큰 수만 맞춘다 (창 전체를 다시 그리면 커서가 날아간다, 2026-10-28 QC: 입력해도 저장 단추가 잠긴 채였다) */
export function guideBarSync(root: ParentNode, name: string): void {
  if (!isGuideName(name)) return;
  const text = guideUi.draft[name] ?? guideText(name);
  const dirty = guideUi.draft[name] !== undefined && guideUi.draft[name] !== guideText(name);
  root.querySelector(`[data-action="ed-guide-save"][data-value="${name}"]`)?.toggleAttribute('disabled', !dirty);
  root.querySelector(`[data-action="ed-guide-reset"][data-value="${name}"]`)?.toggleAttribute('disabled', !(guideOverridden(name) || dirty));
  const tok = root.querySelector('.gw-head .gw-tokens');
  if (tok) tok.textContent = `${tokenizerName() ? '' : '약 '}${tokens(text).toLocaleString()}토큰`;
}

export function guideInput(input: string, key: string, value: string): boolean {
  if (input === 'ed-guide-sec') {
    const at = key.lastIndexOf('|');
    const name = key.slice(0, at) as GuideName;
    const i = Number(key.slice(at + 1));
    const parts = splitGuide(guideUi.draft[name] ?? guideText(name));
    if (!parts[i]) return true;
    parts[i] = { ...parts[i], body: value.replace(/\r/g, '') };
    guideUi.draft[name] = joinGuide(parts);
    guideUi.info = '';
    return true;
  }
  if (input !== 'ed-guide') return false;
  guideUi.draft[key as GuideName] = value;
  guideUi.info = '';
  return true;
}

export async function guideAction(action: string, value: string | undefined): Promise<boolean> {
  const name = value as GuideName;
  if (!name) return false;
  if (action === 'ed-guide-save') {
    const text = guideUi.draft[name];
    if (text === undefined) return true;
    // 저장 상한 (core/settings.ts setPrefs 가 120,000자에서 자른다). 넘기면 잘린 채 저장되던 것을 막는다 (2026-10-28 QC)
    if (text.length > GUIDE_MAX) {
      guideUi.info = `지침은 ${GUIDE_MAX.toLocaleString()}자까지예요 (지금 ${text.length.toLocaleString()}자). 줄여 주세요.`;
      return true;
    }
    const isDefault = text.replace(/\r/g, '') === guideDefault(name);
    setGuideOverride(name, isDefault ? '' : text);
    await savePrefs((p) => {
      const guides = { ...(p.guides ?? {}) };
      if (isDefault) delete guides[name];
      else guides[name] = text;
      return { ...p, guides };
    });
    delete guideUi.draft[name];
    guideUi.info = isDefault ? '기본 글과 같아서 기본으로 저장했어요.' : '지침을 저장했어요. 다음 요청부터 쓰여요.';
    return true;
  }
  if (action === 'ed-guide-reset') {
    setGuideOverride(name, '');
    await savePrefs((p) => {
      const guides = { ...(p.guides ?? {}) };
      delete guides[name];
      return { ...p, guides };
    });
    delete guideUi.draft[name];
    guideUi.info = '기본 지침으로 되돌렸어요.';
    return true;
  }
  return false;
}
