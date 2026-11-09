// 채팅 속 「상점 열기」 카드 (2026-11-07, core/shop.ts). 본편 응답 끝의 표식 `[shop: 가게|주인]` 을 화면에서 지우고
// 그 자리(상태창 상자 아래)에 가게 이름과 「상점 열기」 단추를 붙인다. 누르면 창을 열고 상점 팝업을 띄운다 (app.ts openShop).
// 표식은 응답 처리(core/shop.ts settleShop)가 마지막 응답에만 남기므로 카드도 마지막 응답 아래에만 붙는다.
import { findShopTag, stripShopTags, webSiteOfOwner } from '../core/shop';
import { cardPalette, currentTheme } from '../ui/theme';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// 고유 상점에 인터넷으로 접속한 표식(`@web:사이트`, 11-09)이면 「접속하기」: 상황판 없이 인터넷 창만 그 사이트로 연다
let opener: ((site: string) => void) | null = null;
const drawn = new Set<string>();
export function setShopOpener(f: (site: string) => void): void {
  opener = f;
}

/** display: 표식을 지우고 카드를 붙인다. 표식이 없으면 그대로 */
export function renderShopCard(text: string): string {
  const tag = findShopTag(text);
  if (!tag) return text;
  const site = webSiteOfOwner(tag.owner);
  // 아직 정리되지 않은 접속 표식(`@web` 만, 사이트 없음)은 카드 없이 표식만 가린다 — 「상점 열기」로 잘못 뜨지 않게 (11-09 전수점검)
  if (!site && /^@web\b/i.test(tag.owner.trim())) return stripShopTags(text);
  armChatClick('shop');
  if (site) drawn.add(site);
  const p = cardPalette(currentTheme());
  // 채팅 속 다른 카드와 같은 폭 규칙: 상태창처럼 가운데 정렬, 420px 안팎 (2026-11-09 사용자: 상점 여는 단추 전부 상태창처럼 중앙 배열)
  const card = `<div data-goei-card="shop" style="display:flex;align-items:center;gap:12px;width:fit-content;min-width:min(100%,420px);max-width:100%;box-sizing:border-box;margin:10px auto 0;padding:10px 16px;border:1px solid ${p.accentLine};border-radius:14px;background:${p.accentBg};color:${p.sub};font-size:.92em;line-height:1.5">`
    + `<span style="flex:1;min-width:0"><b style="color:${p.signal}">${esc(tag.shop)}</b></span>`
    + `<button type="button" data-goei-shop="${esc(site || '1')}" style="flex:none;height:32px;padding:0 14px;border:1px solid ${p.accentLine};border-radius:10px;background:transparent;color:${p.text};font:inherit;font-size:.95em;font-weight:600;cursor:pointer">${site ? '접속하기' : '상점 열기'}</button></div>`;
  return `${stripShopTags(text)}\n${card}`;
}

let busy = false;
onChatClick('shop', async (doc, x, y) => {
  const list = await elements(doc, '[data-goei-shop]');
  if (!list.length) return 'idle';
  let on = false;
  for (const el of list) if (await hit(el, x, y)) on = true;
  // SafeElement 는 속성을 못 읽는다: 그려 둔 사이트마다 그 단추를 찾아 자리를 맞춰 본다 (statusview 보고서 링크와 같은 방식)
  let site = '';
  if (on) for (const id of drawn) for (const el of await elements(doc, `[data-goei-shop="${id}"]`)) if (await hit(el, x, y)) site = id;
  if (!on || busy) return false;
  busy = true;
  try {
    opener?.(site);
  } finally {
    busy = false;
  }
  return true;
});
