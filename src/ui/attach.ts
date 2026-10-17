// 첨부 화면 (원본 AT.menu·AT.card·AT.gnetRender): 작성칸 아래 첨부 고르기, 말풍선·글 안의 첨부 카드.
import { ATTACH_HINTS, ATTACH_LABELS, ATTACH_MAX, attachUrl, bodyParts, type PartKind, type UserKind } from '../core/attach';
import { photoUrl } from '../host/photo';

/** image: 실제 사진 (asset = 저장 경로, preview = 작성칸 미리보기 주소) */
export type Attachments = { kind: UserKind; content: string; asset?: string; preview?: string }[];

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON: Record<Exclude<PartKind, 'text'>, string> = {
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
  photo: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
  video: svg('<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 4 8 4a2 2 0 0 0 0 4h4Zm0 0s1.5-4 4-4a2 2 0 0 1 0 4h-4Z"/>'),
};

/**
 * 작성칸의 첨부 줄. prefix로 탭을 나눈다 (gn·ph). gift가 kinds에 없으면 막힌 버튼으로 이유를 보여 준다.
 * giftNote: 선물을 못 보내는 이유 (없으면 선물 버튼 자체를 안 그림)
 */
export function attachEditor(prefix: string, items: Attachments, kinds: UserKind[], disabled = false, giftNote = '', showMenu = true): string {
  const rows = items
    .map(
      (a, i) => `<div class="at-item${a.kind === 'image' ? ' at-item-image' : ''}">${a.kind === 'image' ? `<img class="at-thumb" src="${esc(a.preview ?? '')}" data-asset="${a.preview ? '' : esc(a.asset ?? '')}" alt="보낼 사진">` : `<span class="at-kind">${ICON[a.kind]}${ATTACH_LABELS[a.kind]}</span>`}
      <input class="gx-search" data-input="${prefix}-att" data-key="${i}" value="${esc(a.content)}" placeholder="${esc(ATTACH_HINTS[a.kind])}" maxlength="2000" aria-label="${ATTACH_LABELS[a.kind]} 내용" ${disabled ? 'disabled' : ''}>
      <button class="gx-mini" data-action="${prefix}-att-del" data-value="${i}" aria-label="${ATTACH_LABELS[a.kind]} 첨부 빼기" ${disabled ? 'disabled' : ''}>✕</button></div>`,
    )
    .join('');
  const full = items.length >= ATTACH_MAX;
  const all: UserKind[] = giftNote && !kinds.includes('gift') ? [...kinds, 'gift'] : kinds;
  const menu = all
    .map((k) => {
      const blocked = !kinds.includes(k);
      // 실제 사진은 파일 고르기 창을 연다 (붙여넣기·끌어놓기도 됨). photo는 글로 적는 가상 사진
      if (k === 'image') return `<button class="at-add at-add-image" data-pick-photo="${prefix}" ${disabled || full ? 'disabled' : ''} title="붙여넣기(Ctrl+V)나 끌어놓기로도 올릴 수 있어요">${ICON.image}<span>사진 올리기</span></button>`;
      const label = k === 'photo' && kinds.includes('image') ? '사진 묘사' : ATTACH_LABELS[k];
      return `<button class="at-add" data-action="${prefix}-att-add" data-value="${k}" ${disabled || full || blocked ? 'disabled' : ''}${blocked ? ` title="${esc(giftNote)}"` : ''}>${ICON[k]}<span>${label}</span></button>`;
    })
    .join('');
  if (!rows && !showMenu) return '';
  return `<div class="at-editor" data-drop-photo="${prefix}">${rows}${showMenu ? `<div class="at-menu" role="group" aria-label="첨부 추가">${menu}${full ? `<small class="gx-muted">첨부는 ${ATTACH_MAX}개까지예요.</small>` : ''}</div>` : ''}</div>`;
}

/** 첨부 입력칸 (다시 그리지 않음) */
export function attachInput(items: Attachments, key: string | undefined, value: string): boolean {
  const row = items[Number(key)];
  if (!row) return false;
  row.content = value;
  return true;
}

/** 첨부 추가·빼기 버튼. 처리했으면 true */
export function attachAction(items: Attachments, op: 'add' | 'del', value: string, kinds: UserKind[]): boolean {
  if (op === 'add') {
    if (items.length >= ATTACH_MAX || value === 'image' || !kinds.includes(value as UserKind)) return false;
    items.push({ kind: value as UserKind, content: '' });
    return true;
  }
  const i = Number(value);
  if (!Number.isInteger(i) || !items[i]) return false;
  const [gone] = items.splice(i, 1);
  if (gone.preview?.startsWith('blob:')) URL.revokeObjectURL(gone.preview);
  return true;
}

/** 저장을 마친 사진을 첨부로. 자리가 없으면 false */
export function addPhoto(items: Attachments, asset: string, preview: string): boolean {
  if (items.length >= ATTACH_MAX) return false;
  items.push({ kind: 'image', content: '', asset, preview });
  if (preview.startsWith('blob:')) photos.set(asset, preview);
  return true;
}

/** 빈 내용이 있는 첨부 (보내기 전에 알림). 사진 설명은 비워도 된다 */
export const emptyAttachment = (items: Attachments) => items.find((a) => a.kind !== 'image' && !a.content.trim());

// ── 실제 사진 표시: 저장소에서 읽어 온 주소를 기억해 두고, 다시 그린 뒤 빈 그림에만 채운다 (창을 다시 그리지 않음) ──

const photos = new Map<string, string | null>();
const loading = new Map<string, Promise<string | null>>();

function loadPhoto(asset: string): Promise<string | null> {
  let p = loading.get(asset);
  if (!p) {
    p = photoUrl(asset).then((url) => {
      photos.set(asset, url);
      return url;
    });
    loading.set(asset, p);
  }
  return p;
}

/** 다시 그린 뒤 부른다: 아직 주소가 없는 사진을 채운다 */
export function hydratePhotos(scope: ParentNode): void {
  scope.querySelectorAll<HTMLImageElement>('img[data-asset]').forEach((img) => {
    const asset = img.dataset.asset;
    if (!asset || img.getAttribute('src')) return;
    const fill = (url: string | null) => {
      if (url) img.src = url;
      else img.closest('.at-card-image')?.classList.add('broken');
    };
    if (photos.has(asset)) fill(photos.get(asset)!);
    else void loadPhoto(asset).then(fill);
  });
}

/** 사진 크게 보기 */
export function zoomPhoto(src: string, alt: string): void {
  const box = document.createElement('div');
  box.className = 'gx at-zoom';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', '사진 크게 보기');
  box.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}"><button class="at-zoom-x" aria-label="닫기">✕</button>`;
  const close = () => {
    box.remove();
    document.removeEventListener('keydown', key, true);
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return;
    ev.stopPropagation();
    close();
  };
  box.addEventListener('click', close);
  document.addEventListener('keydown', key, true);
  document.body.appendChild(box);
}

function card(kind: Exclude<PartKind, 'text'>, text: string, asset?: string): string {
  const label = ATTACH_LABELS[kind];
  if (kind === 'image') {
    const src = asset ? photos.get(asset) : null;
    return `<figure class="at-card at-card-image${asset && photos.get(asset) === null ? ' broken' : ''}"><button class="at-photo" data-zoom-photo aria-label="사진 크게 보기"><img src="${esc(src ?? '')}" data-asset="${esc(asset ?? '')}" alt="${esc(text || label)}" loading="lazy"></button>
      <span class="at-broken">${ICON.image}<small>사진을 불러오지 못했어요</small></span>${text.trim() ? `<figcaption>${esc(text)}</figcaption>` : ''}</figure>`;
  }
  if (kind === 'file') {
    return `<div class="at-card at-card-file"><span class="at-ico">${ICON.file}</span><div class="at-copy"><b>${esc(text)}</b><small class="at-save">저장 · 다른 이름으로 저장</small></div></div>`;
  }
  if (kind === 'link') {
    const url = attachUrl(text);
    const go = url ? `<a class="at-go" href="${esc(url)}" target="_blank" rel="noopener noreferrer">여기를 눌러 링크를 확인하세요.</a>` : '<small>여기를 눌러 링크를 확인하세요.</small>';
    return `<div class="at-card at-card-link"><span class="at-ico">${ICON.link}</span><div class="at-copy"><b>${esc(text)}</b>${go}</div></div>`;
  }
  if (kind === 'gift') return `<div class="at-card at-card-gift"><span class="at-ico">${ICON.gift}</span><div class="at-copy"><b>${esc(text)}</b><small>선물이 도착했습니다</small></div></div>`;
  return `<div class="at-card at-card-${kind}"><span class="at-ico">${ICON[kind]}</span><div class="at-copy"><small>${label}</small><span>${esc(text).replace(/\n/g, '<br>')}</span></div></div>`;
}

/** 말풍선·댓글 본문. board: 글·쪽지처럼 파일·링크를 아래 문서 목록으로 모은다 (원본 AT.gnetRender) */
export function attachBody(text: string, board = false): string {
  const out: string[] = [];
  const files: string[] = [];
  for (const p of bodyParts(text)) {
    if (p.kind === 'text') out.push(`<p>${esc(p.text.trim()).replace(/\n/g, '<br>')}</p>`);
    else if (board && (p.kind === 'file' || p.kind === 'link')) files.push(card(p.kind, p.text));
    else out.push(card(p.kind, p.text, p.asset));
  }
  if (files.length) out.push(`<div class="at-files">${files.join('')}</div>`);
  return out.join('');
}
