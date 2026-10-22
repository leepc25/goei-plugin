// 본문의 캐릭터 이미지 태그 <img=이름_표정>를 그림 칸으로 바꾼다. 원본 카드 정규식 「🖼️에셋출력」을 대신한다.
// 원본은 태그마다 {{module_assetlist::ANOM2}}로 에셋 목록 전체를 문자열로 만들어 이름을 찾았다(메시지가 쌓이면 무거움).
// 여기서는 플러그인이 읽어 둔 모듈 에셋 이름으로 고르고, 주소만 Risu의 {{raw::}}에 맡긴다
// (플러그인 화면 처리는 Risu가 CBS를 해석하기 전에 돈다).
// 크기·접는 정도·숨기기는 본 화면 style(host/overlay.ts)이 imgCss로 정한다.

/** 이름_표정. 따옴표로 감싼 꼴(<img="이름_표정">)도 받는다 */
const TAG = /\s*<img=["']?([^_>"']+)_([^>"']+)["']?>\s*/g;

export function hasImgTag(text: string): boolean {
  return text.includes('<img=');
}

/**
 * 태그를 그림 칸으로. pick(이름)은 에셋에 있으면 실제 이름(대소문자 맞춤), 없으면 null.
 * pick이 없으면(에셋 목록을 못 읽었으면) 태그 이름을 그대로 쓴다.
 * 그 표정이 없으면 이름_default, 그것도 없으면 칸을 그리지 않는다 (원본과 같음)
 */
export function renderImgTags(text: string, pick?: (name: string) => string | null): string {
  return text.replace(TAG, (_m, who: string, expr: string) => {
    const want = `${who.trim()}_${expr.trim()}`;
    const name = pick ? pick(want) ?? pick(`${who.trim()}_default`) : want;
    if (!name || /[{}'"<>\\]/.test(name)) return '\n\n';
    return `\n\n<div class="gim" style="background-image:url('{{raw::${name}}}')" tabindex="0"></div>\n\n`;
  });
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
  return `${g}{display:block;box-sizing:border-box;margin:auto;width:100%;max-width:${Math.round(BASE_EM * size) / 100}em;aspect-ratio:${folded};`
    + 'overflow:hidden;border-radius:20px;background-color:transparent;background-repeat:no-repeat;background-size:100% auto;background-position:center top;'
    + `cursor:${open ? 'default' : 'pointer'};outline:none;transition:aspect-ratio .45s ease;-webkit-mask-image:-webkit-radial-gradient(white,black)}`
    + (open ? '' : `${g}:hover,${g}:focus{aspect-ratio:${W}/${H}}`);
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
