// 설정 창 「바뀐 곳만 다시 그리기」 (2026-11-06 사용자, 전수점검 남은 것 6): 새 HTML 과 지금 DOM 을 맞대어 다른 속성·글·요소만 바꾼다.
// innerHTML 로 통째로 갈아 끼우면 스크롤·포커스·입력 중인 글·드로어 열림이 날아가고 긴 화면이 깜빡였다.
// 규칙: 같은 자리의 같은 태그는 그대로 두고 속성만 맞춘다. 태그가 다르면 바꿔 끼운다. 글은 내용만 바꾼다.
// 입력칸(value·checked·selected)은 새 HTML 의 값으로 맞추되, 지금 치고 있는 칸(activeElement)의 글은 건드리지 않는다.
// KEEP 에 든 요소(폰 서랍·하단 바)는 달리는 동안 제 손으로 클래스를 바꾸므로 안을 들여다보지 않는다.

const KEEP = ['.ph-drawer', '.gx-mbar'];

function syncAttrs(a: Element, b: Element): void {
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
}

/** 입력칸의 「지금 값」을 새 HTML 의 값으로 (속성만 맞추면 한 번 손댄 칸은 화면이 안 바뀐다) */
function syncForm(a: Element, b: Element): void {
  const active = document.activeElement === a;
  if (a instanceof HTMLInputElement && b instanceof HTMLInputElement) {
    if (a.type === 'checkbox' || a.type === 'radio') {
      if (a.checked !== b.hasAttribute('checked')) a.checked = b.hasAttribute('checked');
    } else if (a.type !== 'file' && !active && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value') ?? '';
  } else if (a instanceof HTMLTextAreaElement && b instanceof HTMLTextAreaElement) {
    if (!active && a.value !== b.textContent) a.value = b.textContent ?? '';
  } else if (a instanceof HTMLSelectElement && b instanceof HTMLSelectElement) {
    const want = [...b.options].findIndex((o) => o.hasAttribute('selected'));
    if (want >= 0 && a.selectedIndex !== want) a.selectedIndex = want;
  } else if (a instanceof HTMLOptionElement && b instanceof HTMLOptionElement) {
    if (a.selected !== b.hasAttribute('selected')) a.selected = b.hasAttribute('selected');
  }
}

function same(a: Node, b: Node): boolean {
  return a.nodeType === b.nodeType && (a.nodeType !== Node.ELEMENT_NODE || (a as Element).tagName === (b as Element).tagName);
}

function morphNode(a: Node, b: Node): void {
  if (a.nodeType === Node.TEXT_NODE || a.nodeType === Node.COMMENT_NODE) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  const ea = a as Element;
  const eb = b as Element;
  syncAttrs(ea, eb);
  syncForm(ea, eb);
  if (KEEP.some((q) => ea.matches(q))) return;
  morphChildren(ea, eb);
}

function morphChildren(a: Element, b: Element): void {
  const want = [...b.childNodes];
  const have = [...a.childNodes];
  let i = 0;
  for (; i < want.length; i++) {
    const w = want[i]!;
    const h = have[i];
    if (!h) {
      a.appendChild(w.cloneNode(true));
      continue;
    }
    if (same(h, w)) {
      morphNode(h, w);
      continue;
    }
    // 같은 태그가 조금 뒤에 있으면(줄이 하나 빠짐) 그 사이를 지우고 잇는다. 없으면 바꿔 끼운다
    const j = have.findIndex((x, k) => k > i && same(x, w));
    if (j > i && j - i <= 3) {
      for (let k = i; k < j; k++) have[k]!.remove();
      have.splice(i, j - i);
      morphNode(have[i]!, w);
      continue;
    }
    a.replaceChild(w.cloneNode(true), h);
    have[i] = a.childNodes[i]!;
  }
  for (let k = have.length - 1; k >= i; k--) have[k]!.remove();
}

/** root 의 자식들을 html 과 맞춘다 */
export function morph(root: Element, html: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(root, tpl.content as unknown as Element);
}
