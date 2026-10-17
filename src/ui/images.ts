// 창에서 쓰는 카드 에셋 이미지(세력 f01~f05, 요원·연락처 초상). 처음 부를 때 읽기 시작하고,
// 다 읽히면 창을 한 번 다시 그린다. 못 읽은 이미지는 글자 아바타로 둔다.
import { assetUrl } from '../host/assets';
import { factionList } from '../core/factions';
import type { CharacterSnapshot } from '../host/risu';

const urls = new Map<string, string | null | 'loading'>();
let redraw: () => void = () => {};
let queued = false;

export function setImageRedraw(fn: () => void): void {
  redraw = fn;
}

function schedule(): void {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    redraw();
  }, 30);
}

/** 창에 보일 크기보다 훨씬 큰 사진(세력 사진 1200×600 AVIF 등)은 미리 줄인 사본을 쓴다. 매번 큰 원본을 풀고 줄여 그리느라 끊겼다 (v0.10.2) */
const MAX_SIDE = 720;
async function shrink(url: string): Promise<string> {
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const scale = MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight);
    if (!(scale < 1)) return url;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(im.naturalWidth * scale);
    canvas.height = Math.round(im.naturalHeight * scale);
    const g = canvas.getContext('2d');
    if (!g) return url;
    g.imageSmoothingQuality = 'high';
    g.drawImage(im, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.88));
    return blob ? URL.createObjectURL(blob) : url;
  } catch {
    return url;
  }
}

/** 이름의 에셋 URL. 아직 읽는 중이거나 없으면 null */
export function imageUrl(char: CharacterSnapshot, name: string | undefined): string | null {
  if (!name) return null;
  const key = `${String(char.chaId ?? char.name ?? '')}|${name}`;
  const hit = urls.get(key);
  if (hit === undefined) {
    urls.set(key, 'loading');
    void assetUrl(char, name).then(async (raw) => {
      const url = raw ? await shrink(raw) : null;
      urls.set(key, url);
      if (url) schedule();
    });
    return null;
  }
  return hit === 'loading' ? null : hit;
}

const escAttr = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 원형 아바타: 사진이 있으면 사진, 없으면 첫 글자 */
export function avatar(char: CharacterSnapshot, english: string | undefined, name: string, cls = ''): string {
  const url = imageUrl(char, english);
  const first = escAttr(Array.from(name.trim())[0] ?? '?');
  return `<span class="gx-ava${cls ? ` ${cls}` : ''}">${url ? `<img src="${escAttr(url)}" alt="" loading="lazy">` : `<span>${first}</span>`}</span>`;
}

/** 시작 화면 세력 사진(f01~f05, 명부에서 바꾼 사진)을 미리 읽는다. 괴이봇 Lite 채팅에 들어왔을 때 부른다 */
export function prefetchFactions(char: CharacterSnapshot): void {
  for (const f of factionList(char.globalLore)) if (!f.hidden) imageUrl(char, f.photo);
}

/** 요원 상태 색 (상황판·편성 공통) */
/** 화면에 보이는 상태 이름 (모델 태그 값은 그대로 「작전투입」, 사용자 요청으로 표시만 짧게) */
export const stLabel = (st: string) => (st === '작전투입' ? '작전' : st);

const AGENT_COLOR: Record<string, string> = { 작전투입: 'var(--signal)', 외근: 'var(--blue)', 부상: 'var(--amber)', 실종: 'var(--danger)', 격리: 'var(--danger)', 사망: 'var(--danger)', 비번: 'var(--dim)' };

/** 요원 카드 속: 둥근 네모 사진 + 이름·상태 + 소속 부서·직급 (+ 현재 상황) */
/** act: 톡·위키 버튼. 사진과 한 칸(.gx-acard-side)에 넣어 모바일에서는 사진 바로 아래 나란히 둔다 (PC는 카드 오른쪽 위) */
export function agentInner(char: CharacterSnapshot, p: { english?: string; name: string; department?: string; rank?: string }, st: string, situation = '', act = ''): string {
  const role = [p.department, p.rank].filter(Boolean).join(' · ');
  return `<span class="gx-acard-side">${avatar(char, p.english, p.name, 'sq')}${act}</span><span class="gx-acard-txt"><span class="gx-acard-top"><b>${escAttr(p.name)}</b><em class="gx-st" style="--st:${AGENT_COLOR[st] ?? 'var(--dim)'}">${escAttr(stLabel(st))}</em></span>${role ? `<small>${escAttr(role)}</small>` : ''}${situation ? `<span class="gx-acard-sit">${escAttr(situation)}</span>` : ''}</span>`;
}

/** 상황판 요원 카드를 눌렀을 때: 큰 사진(200px)과 잘린 상태 설명까지 전부 보여 주는 작은 창 */
export function showAgentInfo(card: HTMLElement): void {
  const box = document.createElement('div');
  box.className = 'gx gx-agpop';
  box.setAttribute('role', 'dialog');
  const side = card.querySelector('.gx-ava')?.outerHTML ?? '';
  const txt = card.querySelector('.gx-acard-txt')?.innerHTML ?? '';
  box.innerHTML = `<div class="gx-agpop-card">${side}<div class="gx-agpop-txt">${txt}</div><button class="gx-agpop-x" aria-label="닫기">✕</button></div>`;
  const theme = document.querySelector('.gx')?.getAttribute('data-theme');
  if (theme) box.setAttribute('data-theme', theme);
  box.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.gx-agpop-card') && !(e.target as HTMLElement).closest('.gx-agpop-x')) return;
    box.remove();
  });
  document.body.appendChild(box);
}
