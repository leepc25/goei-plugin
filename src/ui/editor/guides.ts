// 지침 편집 (docs/설계안_세계편집.md 3장): 글칸 하나 + 자리표 안내 + 토큰. 고친 글은 이 기기 설정(prefs.guides)에 두고 core/guides.ts 가 요청에 쓴다.
import { guideDefault, guideOverridden, guideText, GUIDE_LABEL, setGuideOverride, type GuideName } from '../../core/guides';
import { tokens } from '../../core/gnet';
import { savePrefs } from '../../host/prefs';
import { ICONS } from '../icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const guideUi = { draft: {} as Partial<Record<GuideName, string>>, info: '' };

const HELP: Record<GuideName, string> = {
  GNet: '괴담넷 게시판 글 생성 지침. @@SECTION 이름 … @@END 묶음을 플러그인이 요청마다 골라 써요. 섹션 이름·구분 줄은 그대로 두세요.',
  Phone: '괴담톡(연락처·문자) 생성 지침. @@SECTION 묶음 구조는 그대로 두세요.',
  Wiki: '위키 문서 생성 지침. @@SECTION 묶음 구조는 그대로 두세요.',
  Directive: '요원 이동·커스텀 임무 때 모델에 주는 장면 지시문. ===COMMON=== ===OPENING=== ===CONTINUATION=== ===CONTEXT=== ===FORMAT===(JSON) 절이 모두 있어야 해요.',
  Visit: '본부 방문 대화 지침. @@SECTION COMMON·REPLY·OUTPUT_REPLY(·INTERJECT·OUTPUT_GROUP) 가 있어야 해요. __LIMIT_LINE__ 은 설정의 글자 수로 바뀌어요.',
  RP: '카드 description 에 있던 RP 지침(세계 설정·진행 원칙). 요청 맨 앞 로어 덩어리에 들어가요. 카드 description 에 「## RP Guidance」가 남아 있으면 넣지 않아요.',
  Tag: '상황판 태그 지침. 상태창 절은 `{status_section}` 자리에 설정 「상황판 → 상태창 칸」의 구성대로 자동으로 만들어져요(형식·규칙·예시). 그 자리표와 {{getvar::…}} 자리표는 그대로 두세요.',
};

export function guidePage(name: GuideName): string {
  const text = guideUi.draft[name] ?? guideText(name);
  const dirty = guideUi.draft[name] !== undefined && guideUi.draft[name] !== guideText(name);
  return `<div class="gw-page"><header class="gw-head"><h2>${esc(GUIDE_LABEL[name])} 지침<small>이 기기 공통${guideOverridden(name) ? ' · 고침' : ' · 기본'}</small></h2>
      <div class="gw-head-act"><span class="gw-tokens">약 ${tokens(text).toLocaleString()}토큰</span>
        <button class="gx-mini" data-action="ed-guide-save" data-value="${name}" ${dirty ? '' : 'disabled'}>${ICONS.pen}지침 저장</button>
        <button class="gx-mini" data-action="ed-guide-reset" data-value="${name}" ${guideOverridden(name) || dirty ? '' : 'disabled'}>기본으로</button></div>
      <p class="gx-muted">${esc(HELP[name])}</p>${guideUi.info ? `<p class="gx-hint">${esc(guideUi.info)}</p>` : ''}</header>
    <textarea class="gw-guide" data-input="ed-guide" data-key="${name}" rows="30" spellcheck="false">${esc(text)}</textarea>
  </div>`;
}

export function guideInput(input: string, key: string, value: string): boolean {
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
