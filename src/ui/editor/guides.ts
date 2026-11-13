// 지침 편집 (docs/설계안_세계편집.md 3장): 글칸 하나 + 자리표 안내 + 토큰. 고친 글은 이 기기 설정(prefs.guides)에 두고 core/guides.ts 가 요청에 쓴다.
import { guideDefault, guideOverridden, guideText, GUIDE_LABEL, isGuideName, joinGuide, setGuideOverride, splitGuide, type GuideName } from '../../core/guides';
type GuidePart = ReturnType<typeof splitGuide>[number];
import { tokenizerName } from '../../core/tokenizer';
import { tokens } from '../../core/gnet';
import { savePrefs } from '../../host/prefs';
import { copyBtn } from '../copy';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const guideUi = { draft: {} as Partial<Record<GuideName, string>>, info: '' };
/** 화면에 그린 절 나눔. 입력 중에는 다시 나누지 않는다: 본문에 친 ##·### 줄이 새 절이 되면 칸 순번이 어긋나 다른 절을 덮었다 (전수검사 11-13) */
const drawn: Partial<Record<GuideName, GuidePart[]>> = {};
/** 입력할 절: 그린 나눔이 지금 글과 같으면 그대로, 아니면(다른 데서 바뀜) 새로 나눈다 */
function partsNow(name: GuideName): GuidePart[] {
  const text = guideUi.draft[name] ?? guideText(name);
  const kept = drawn[name];
  return kept && joinGuide(kept) === text ? kept : splitGuide(text);
}
/** 저장 상한 (core/settings.ts setPrefs 와 같은 값) */
export const GUIDE_MAX = 120000;

const HELP: Record<GuideName, string> = {
  GNet: '괴담넷 게시판 글 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Gal: '괴담갤 게시판 글 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Wpf: '세정게 게시판 글 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Salmon: '연어 마켓 거래 글 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Hs: '망상홈쇼핑 지침: 편성(상품)·큐시트·채팅을 한 번에 짓는 글이에요. 상점 지침과 같은 절에 방송 절(BROADCAST)이 붙어 있어요. {cue}·{chat}·{cuts}·{moods}·{moods_b}·{events} 자리는 설정과 방송 그림에서 채워져요.',
  Cos: '우주 쇼핑몰 지침: 물건 목록 짜기·운영자 문의 답. 절마다 플러그인이 요청에 따라 골라 써요. {size}·{line}·{price}·{prev} 자리는 플러그인이 채워요.',
  Bm: '백일몽 포인트몰 지침: 물건 목록 짜기. 절마다 플러그인이 요청에 따라 골라 써요. {size}·{line}·{price}·{prev} 자리는 플러그인이 채워요.',
  BmDesk: '백일몽 포인트몰 1:1 상담 지침: 상담사 만들기(MAKE)·복지몰 상담 매뉴얼(MANUAL, 작중 규정)·대화 규칙(TALK). 예시 대사·소재 목록을 넣으면 상담사들이 같은 말을 되풀이하니 규칙만 적어 주세요. 상담사 주사위 칸은 포인트몰 설정에 있어요.',
  Consult: '설정 창의 AI 상담 지침: 답하는 태도(COMMON)·증상과 설정을 잇는 사실(KNOWLEDGE)·설정을 바꾸는 순서(CHANGE)·응답 꼴(OUTPUT). 메뉴와 줄, 지금 값, 호출 흐름, 지난 턴 기록은 플러그인이 설정 화면과 기록에서 뽑아 넣어요. <say>·<set>·<apply>·<open>·<go> 꼴은 그대로 두세요.',
  Phone: '괴담톡(연락처·문자) 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Wiki: '위키 문서 생성 지침. 절마다 플러그인이 요청에 따라 골라 써요.',
  Directive: '요원 이동·커스텀 임무 때 모델에 주는 장면 지시문. COMMON·OPENING·CONTINUATION·CONTEXT·FORMAT(JSON) 절.',
  RP: '카드 description 에 있던 RP 지침(세계 설정·진행 원칙). 요청 맨 앞 로어 덩어리에 들어가요. 카드 description 에 「## RP Guidance」가 남아 있으면 넣지 않아요.',
  Tag: '상황판 태그 지침(괴이·사건·거점 출력 규칙). 상태창 절은 `{status_section}` 자리에 설정 「상황판 → 상태창 칸」의 구성대로 자동으로 만들어져요(형식·규칙·예시). 그 자리표와 {{getvar::…}} 자리표는 그대로 두세요.',
  Shop: '상점 지침: 진열대 짜기·주인 대화·판매 값·메인 응답의 상점 표식. 절마다 플러그인이 요청에 따라 골라 써요. {size}·{line}·{price}·{prev} 자리는 플러그인이 채워요. 상점 판단: SHOP_RULE 은 「지금 상점이 있나」 공용 기준이라 메인 모델 표식 지침(MAIN_TAG)과 갱신기가 같은 글을 읽어요(한 곳만 고치면 양쪽에 들어가요). OWN_SHOPS 는 설정 → 상점 「고유 상점」 표의 켜진 줄({list})이 있을 때 SHOP_RULE 의 {own} 자리에 붙어요. SHOP_JUDGE 는 상점 판단을 갱신기가 맡을 때 갱신기만 더 받는 판단 요령이에요.',
  Updater: '인물 기록 갱신기(자세히판): 응답마다 보조 모델이 인물·사건·장소·세력·소지품 기록을 고칠 때 주는 지침. <<SECTION:이름>>…<<END:이름>> 표식은 설정에서 끈 기능의 절을 빼는 자리라 지우지 마세요.',
  UpdaterCompact: '인물 기록 갱신기(간결판): 설정 「갱신기 지침」을 간결로 골랐을 때 쓰는 지침. 표식은 자세히판과 같아요.',
  Director: 'Director 기본 지침: 메인 요청 전에 보조 모델이 이번 턴 인물 자료를 정리할 때 주는 글. FACTS 절은 사실형·연출형 모두, SCENE 절은 연출형에만 붙어요. 기능별 절(APPLY.*)·검색(SEARCH·PASS2)·출력 형식(OUTPUT)·고침 요청(REPAIR)은 설정에 따라 플러그인이 골라 덧붙이고, MAIN_NOTE 는 메인 요청에 넣는 메모의 머리말이에요. {{LANG}}·{{LINES}} 자리는 그대로 두세요.',
  Common: '여러 기능의 요청에 공통으로 붙는 글이에요: 인터넷·괴담톡 자동 확인을 한 번에 묶는 틀(JOINT.*), 형식이 틀렸을 때 다시 묻는 글(RETRY.*), 다시 보기(REITERATE), 생각 단계 머리말(THOUGHTS.*), 첨부 안내(ATTACH.*), 생성 언어 문장(LANGUAGE.*). {count}·{keys}·{reason} 같은 자리는 플러그인이 채워요.',
  Main: '메인 요청에 플러그인이 붙이는 글이에요: 직전 상태창 안내(STATUS.NOTE·STATUS.FIRST), 상태창 칸 규칙(STATUS.RULE.*, 상황판 태그 지침의 상태창 절에 들어가요), 소지품 안내(INVENTORY.*), 잠긴 부록 안내(LORE.LOCKED), 인물 기록 머리말(PEOPLE.*·SEXUAL.POLICY), 세력·명부 머리말(FACTION.*·ROSTER.INTRO). {이름} 자리는 플러그인이 채워요.',
  UpdaterExtra: '인물 기록 갱신기에 설정에 따라 덧붙는 글이에요: 기록 언어 영어(LANG_EN), 추적 인물(TRACKING_RULE), 태그 신호(SIGNAL_STATE), 상점 판단 칸(SHOP_KEY), 말투 다변화(SPEECH.*), 성적 프로필(SEXUAL.*). CONSOLIDATE 는 기록 정리 요청의 지침이에요. {이름} 자리는 플러그인이 채워요.',
  Asset: '보조 모델이 완성된 본문에 캐릭터 이미지 태그를 넣을 때 주는 지침이에요 (설정 → 캐릭터 이미지에서 「보조 모델」 방식일 때). {limit}·{names}·{keywords}·{narrative} 같은 자리는 플러그인이 채워요. 메인 모델이 직접 넣는 방식의 지침은 「이미지(메인 모델)」 항목에 있어요.',
  Router: 'Router 기본 지침: 메인 요청 전에 보조 모델이 장면에 필요한 인물을 고를 때 주는 글. ROLE(역할·입력)·RULES(고르는 규칙·출력) 절. {{MAX}} 자리(최대 인원)는 그대로 두세요.',
};

export function guidePage(name: GuideName, crumb = ''): string {
  const text = guideUi.draft[name] ?? guideText(name);
  // 절 단위 글칸 (2026-10-27 사용자): 구분 줄(@@SECTION·===·##)은 플러그인이 들고, 사용자는 절 본문만 고친다
  // 글칸 첫 줄바꿈 하나는 HTML 이 떼어 버리므로(<textarea>\n…) 하나를 더 넣어 본문이 줄바꿈으로 시작해도 그대로 보이게 (2026-10-28 QC: 제목 뒤 빈 줄이 사라졌다)
  const parts = splitGuide(text);
  drawn[name] = parts.map((p) => ({ ...p }));
  // 제목 줄 (2026-11-05 사용자: 구분 표시(##·===COMMON===)는 보이지 않게, 제목은 고칠 수 있게)
  //  - ##·### 머리글: 모델에게 가는 글의 제목이라 그대로 고칠 수 있다 (### 는 한 단 들여 보임)
  //  - @@SECTION·=== 이름: 플러그인이 요청마다 절을 고르는 이름표라 글자를 바꾸면 못 찾는다 → 이름만 보여 주고 잠근다
  const rows = parts
    .map((p, i) => {
      const md = /^(#{2,3}) /.exec(p.head);
      const fixed = !md && p.head.trim() !== '';
      const head = md
        ? `<input class="gw-gtitle" data-input="ed-guide-title" data-key="${name}|${i}" value="${esc(p.title)}" spellcheck="false" aria-label="절 제목">`
        : `<b>${esc(p.title)}</b>${fixed ? '<button class="gw-fhint" type="button" data-action="ed-hint" data-hint="이 이름은 플러그인이 요청마다 절을 골라 쓸 때 쓰는 이름표예요. 그래서 바꿀 수 없고, 본문만 고칠 수 있어요.">?</button>' : ''}`;
      return `<div class="gw-field gw-copyto${md?.[1] === '###' ? ' gw-sub' : ''}"><div class="gw-field-head">${head}<span class="gw-ftok">${tokens(p.body) ? `${tokens(p.body).toLocaleString()}토큰` : ''}</span>${copyBtn()}</div>
      <textarea data-input="ed-guide-sec" data-key="${name}|${i}" rows="${p.body.trim() ? 3 : 1}" spellcheck="false">\n${esc(p.body)}</textarea></div>`;
    })
    .join('');
  const title = crumb
    ? `<h2>${esc(GUIDE_LABEL[name])}<small>이 기기 공통${guideOverridden(name) ? ' · 고침' : ' · 기본'} · ${parts.length}절</small></h2>`
    : `<h3>${esc(GUIDE_LABEL[name])} 지침<small>이 기기 공통${guideOverridden(name) ? ' · 고침' : ' · 기본'} · ${parts.length}절</small></h3>`;
  return `<div class="gw-page${crumb ? ' gw-set' : ''}"><header class="gw-head">${title}
      <div class="gw-head-act"><span class="gw-tokens">${tokenizerName() ? '' : '약 '}${tokens(text).toLocaleString()}토큰</span></div>
      <p class="gx-muted">${esc(HELP[name])}</p>${guideUi.info ? `<p class="gx-hint">${esc(guideUi.info)}</p>` : ''}</header>
    <div class="gw-fields gw-guide-secs">${rows}</div>
  </div>`;
}

/** 입력 중 머리의 토큰 수만 맞춘다 (창 전체를 다시 그리면 커서가 날아간다).
 *  입력이 멈추고 0.3초 뒤에 센다: 글자마다 지침 전체(갱신기 11만 자)를 세면 입력이 버벅였다 (전수검사 11-13) */
let barTimer: ReturnType<typeof setTimeout> | undefined;
export function guideBarSync(root: ParentNode, name: string): void {
  if (!isGuideName(name)) return;
  if (barTimer !== undefined) clearTimeout(barTimer);
  barTimer = setTimeout(() => {
    barTimer = undefined;
    // 그새 다른 지침으로 옮겼으면 그 머리에 쓰지 않는다
    if (!root.querySelector(`[data-key^="${name}|"]`)) return;
    const text = guideUi.draft[name] ?? guideText(name);
    const tok = root.querySelector('.gw-head .gw-tokens');
    if (tok) tok.textContent = `${tokenizerName() ? '' : '약 '}${tokens(text).toLocaleString()}토큰`;
  }, 300);
}

export function guideInput(input: string, key: string, value: string): boolean {
  if (input === 'ed-guide-title') {
    const at = key.lastIndexOf('|');
    const name = key.slice(0, at) as GuideName;
    const i = Number(key.slice(at + 1));
    const parts = partsNow(name);
    const md = parts[i] && /^(#{2,3}) /.exec(parts[i].head);
    if (!md) return true;
    const title = value.replace(/[\r\n]/g, ' ').trim();
    parts[i] = { ...parts[i], title, head: `${md[1]} ${title}\n` };
    drawn[name] = parts;
    guideUi.draft[name] = joinGuide(parts);
    guideUi.info = '';
    return true;
  }
  if (input === 'ed-guide-sec') {
    const at = key.lastIndexOf('|');
    const name = key.slice(0, at) as GuideName;
    const i = Number(key.slice(at + 1));
    const parts = partsNow(name);
    if (!parts[i]) return true;
    parts[i] = { ...parts[i], body: value.replace(/\r/g, '') };
    drawn[name] = parts;
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
    // 저장하는 동안 더 친 글은 남긴다 (예약된 다음 저장이 넣는다) (전수검사 11-13)
    if (guideUi.draft[name] === text) delete guideUi.draft[name];
    // 바로 저장이라 저장 알림은 띄우지 않는다 (2026-11-08 사용자)
    return true;
  }
  return false;
}
