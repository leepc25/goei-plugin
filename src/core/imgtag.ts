// 본문의 캐릭터 이미지 태그 <img=이름_표정>를 그림 칸으로 바꾼다. 원본 카드 정규식 「🖼️에셋출력」을 대신한다.
// 원본은 태그마다 {{module_assetlist::ANOM2}}로 에셋 목록 전체를 문자열로 만들어 이름을 찾았다(메시지가 쌓이면 무거움).
// 여기서는 플러그인이 읽어 둔 모듈 에셋 이름으로 고르고, 주소만 Risu의 {{raw::}}에 맡긴다
// (플러그인 화면 처리는 Risu가 CBS를 해석하기 전에 돈다).
// 크기·접는 정도·숨기기는 본 화면 style(host/overlay.ts)이 imgCss로 정한다.

/** 이름_표정. 따옴표로 감싼 꼴(<img="이름_표정">)도 받는다 */
const TAG = /\s*<img=["']?([^_>"']+)_([^>"']+)["']?>\s*/g;
/** 요청에서 지울 태그 (원본 「🖼️에셋리퀘제거」의 <img=(.*?)>) */
const ANY_TAG = /<img=.*?>/g;

/** 그림을 띄우는·요청에 태그를 남기는 최근 메시지 수 (마지막 메시지 포함). 기본은 원본 정규식의 chat_index >= lastmessageid-5와 같은 6개.
 *  설정(Prefs.imgShow·imgSend)에서 0이면 전부 */
export const IMG_RECENT = { min: 1, max: 30, step: 1, def: 6 };
export const imgRecent = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && (n === 0 || (n >= IMG_RECENT.min && n <= IMG_RECENT.max)) ? n : null;
};

/** 그림 칸 기본 모양. 본 화면 style(imgCss)이 없을 때(화면 접근 권한을 거부했을 때)도 원래 크기로 보이게 */
const BASE_STYLE = 'display:block;margin:auto;width:100%;max-width:32em;aspect-ratio:1/1;overflow:hidden;border-radius:20px;'
  + 'background-repeat:no-repeat;background-size:100% auto;background-position:center top';

export function hasImgTag(text: string): boolean {
  return text.includes('<img=');
}

/** 페르소나 태그(<img=페르소나이름_표정>)에 맞는 에셋이 없을 때 쓰는 그림: Risu의 유저 사진 (표정과 상관없이 한 장).
 *  나중에 「페르소나이름_표정」 에셋을 넣으면 그것이 먼저다 */
const SELF = '{{source::user}}';

/** 카드 표정 세트 (assets/portraits). 에셋 목록을 못 읽었을 때는 이 세트의 표정만 믿는다 */
export const EMOTIONS = new Set('default angry annoyed bored confused contemptuous crying curious dumbfounded embarrassed excited exhausted happy laughing lovestruck lustful nervous proud sad scared serious shy smile smirk smug surprised thinking'.split(' '));

/** 태그 → 에셋 이름. 목록에 없는 이름·표정은 null (칸을 그리지 않는다, 기본 그림으로 바꾸지 않는다. 사용자 2026-10-26).
 *  목록이 없으면 표정이 세트 안일 때만 태그를 믿는다. 페르소나 태그는 유저 사진 */
const tagName = (who: string, expr: string, pick?: (name: string) => string | null, self?: string) => {
  const name = who.trim();
  const want = `${name}_${expr.trim()}`;
  if (self && name === self.trim()) return pick?.(want) ?? SELF;
  if (pick) return pick(want);
  return EMOTIONS.has(expr.trim().toLowerCase()) ? want : null;
};

/** 태그 가운데 에셋에 있는 이름이 하나라도 있는지 (괴이봇 판정 전에도 그려도 되는지. 다른 봇의 같은 꼴 태그는 건드리지 않게).
 *  하나라도 알면 그 메시지는 우리 것이고, 모르는 태그는 그릴 때 빠진다 */
export function imgTagsKnown(text: string, pick?: (name: string) => string | null, self?: string): boolean {
  if (!pick) return false;
  const all = [...text.matchAll(TAG)];
  return all.length > 0 && all.some((m) => !!tagName(m[1], m[2], pick, self));
}

/**
 * 태그를 그림 칸으로. pick(이름)은 에셋에 있으면 실제 이름(대소문자 맞춤), 없으면 null.
 * pick이 없으면(에셋 목록을 못 읽었으면) 태그 이름을 그대로 쓴다.
 * 목록에 없는 이름·표정은 칸을 그리지 않는다 (태그만 지운다). self(페르소나 이름) 태그는 유저 사진.
 * 최근 메시지에만 띄우는 조건은 메시지 번호를 아는 Risu CBS에 맡긴다 (화면 처리기는 번호를 모른다). recent 0이면 전부
 */
export function renderImgTags(text: string, pick?: (name: string) => string | null, recent = IMG_RECENT.def, self?: string): string {
  return text.replace(TAG, (_m, who: string, expr: string) => {
    const name = tagName(who, expr, pick, self);
    if (!name || (name !== SELF && /[{}'"<>\\]/.test(name))) return '\n\n';
    const url = name === SELF ? SELF : `{{raw::${name}}}`;
    const box = `<div class="gim" style="${BASE_STYLE};background-image:url('${url}')" tabindex="0"></div>`;
    return `\n\n${recent > 0 ? `{{#when {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-${recent - 1}}}}}}}${box}{{/when}}` : box}\n\n`;
  });
}

/** 요청: 최근 메시지 recent개 밖의 태그를 지운다 (0이면 그대로). 시스템 글(로어북 등)은 세지 않는다 */
export function stripOldImgTags<M extends { role?: string; content?: unknown }>(messages: M[], recent = IMG_RECENT.def): M[] {
  if (recent <= 0) return messages;
  let seen = 0;
  let changed = false;
  const out = [...messages];
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (!m || m.role === 'system') continue;
    seen++;
    if (seen <= recent || typeof m.content !== 'string' || !m.content.includes('<img=')) continue;
    out[i] = { ...m, content: m.content.replace(ANY_TAG, '') };
    changed = true;
  }
  return changed ? out : messages;
}

/** 이미지 칸 크기 (%): 원본 카드 크기(최대 너비 32em)를 100으로. 채팅 폭보다 넓어지지는 않는다 */
export const IMG_SIZE = { min: 30, max: 200, step: 5, def: 100 };
/** 접힌 칸에 보이는 높이 (%): 그림 전체 높이를 100으로. 원본은 정사각형(832:1216 그림의 약 68%)으로 접혔다가 누르거나 올리면 펼쳐진다 */
export const IMG_FOLD = { min: 20, max: 100, step: 1, def: 68 };
const BASE_EM = 32;
const W = 832;
const H = 1216;

function pct(v: unknown, r: { min: number; max: number }): number | null {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= r.min && n <= r.max ? n : null;
}
export const imgSize = (v: unknown) => pct(v, IMG_SIZE);
export const imgFold = (v: unknown) => pct(v, IMG_FOLD);

/**
 * 본 화면 style에 넣는 그림 칸 CSS. Risu가 채팅 속 class에 붙이는 x-risu- 이름도 같이 잡는다.
 * 플러그인이 Lite 판정 전에 그려진 메시지는 카드 정규식이 그린 칸(ib-asset-hover)이라 그것도 같은 설정을 따르게 한다
 */
export function imgCss(size = IMG_SIZE.def, fold = IMG_FOLD.def, hidden = false): string {
  const g = ':is(.gim,.x-risu-gim,.ib-asset-hover,.x-risu-ib-asset-hover)';
  if (hidden) return `${g}{display:none!important}`;
  const open = fold >= 100;
  const folded = open ? `${W}/${H}` : `${W}/${Math.round(H * fold) / 100}`;
  // 그림 칸에 기본 모양이 style 속성으로 들어 있어 !important로 덮는다
  return `${g}{display:block!important;box-sizing:border-box;margin:auto;width:100%;max-width:${Math.round(BASE_EM * size) / 100}em!important;aspect-ratio:${folded}!important;`
    + 'overflow:hidden;border-radius:20px;background-color:transparent;background-repeat:no-repeat;background-size:100% auto;background-position:center top;'
    + `cursor:${open ? 'default' : 'pointer'};outline:none;transition:aspect-ratio .45s ease;-webkit-mask-image:-webkit-radial-gradient(white,black)}`
    + (open ? '' : `${g}:hover,${g}:focus{aspect-ratio:${W}/${H}!important}`);
}

/** 지금 채팅의 「에셋 출력」이 꺼져 있으면 그림 칸을 숨긴다 (채팅을 바꿀 때·설정을 바꿀 때 정한다) */
let hiddenNow = false;
export const imgHidden = () => hiddenNow;
/** 바뀌었으면 true (그때만 본 화면 style을 다시 쓴다) */
export function setImgHidden(v: boolean): boolean {
  if (v === hiddenNow) return false;
  hiddenNow = v;
  return true;
}
