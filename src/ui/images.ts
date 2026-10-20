// 창에서 쓰는 카드·모듈 에셋 이미지(세력 사진, 요원·연락처 초상). 처음 부를 때 읽기 시작하고,
// 다 읽히면 창을 한 번 다시 그린다. 못 읽은 이미지는 글자 아바타로 둔다.
import { assetUrl, facePic, mainPic, splitPic } from '../host/assets';
import { factionList } from '../core/factions';
import type { Faction } from '../core/types';
import { readDirectory } from '../core/world/directory';
import type { LoreEntry } from '../core/types';
import type { CharacterSnapshot } from '../host/risu';

const urls = new Map<string, string | null | 'loading'>();
let redraw: () => void = () => {};
let queued = false;

/** 카드 사진을 바꾼 뒤: 읽어 둔 이미지를 잊고 다시 읽는다 */
export function forgetImages(): void {
  urls.clear();
  schedule();
}

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
/** 얼굴로 자른 사진의 한 변 (작은 사진이라 이 정도면 충분) */
const FACE_SIDE = 256;
/** crop: 얼굴 틀 [가로 중심, 세로 중심, 한 변(그림 너비 대비)] % */
async function shrink(url: string, crop: [number, number, number] | null = null): Promise<string> {
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const W = im.naturalWidth;
    const H = im.naturalHeight;
    // 자를 네모 (원본 좌표). 그림 밖으로 나가지 않게 민다
    let [sx, sy, sw, sh] = [0, 0, W, H];
    if (crop) {
      const side = Math.min(W, H, (crop[2] / 100) * W);
      sx = Math.min(W - side, Math.max(0, (crop[0] / 100) * W - side / 2));
      sy = Math.min(H - side, Math.max(0, (crop[1] / 100) * H - side / 2));
      sw = sh = side;
    }
    const scale = Math.min(1, (crop ? FACE_SIDE : MAX_SIDE) / Math.max(sw, sh));
    if (!crop && !(scale < 1)) return url;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const g = canvas.getContext('2d');
    if (!g) return url;
    g.imageSmoothingQuality = 'high';
    g.drawImage(im, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.88));
    return blob ? URL.createObjectURL(blob) : url;
  } catch {
    return url;
  }
}

/** 이름의 에셋 URL (「이름#가로,세로,크기」면 그 틀로 자른 얼굴). 아직 읽는 중이거나 없으면 null */
export function imageUrl(char: CharacterSnapshot, pic: string | undefined): string | null {
  if (!pic) return null;
  const key = `${String(char.chaId ?? char.name ?? '')}|${pic}`;
  const hit = urls.get(key);
  if (hit === undefined) {
    urls.set(key, 'loading');
    const { name, crop } = splitPic(pic);
    void assetUrl(char, name).then(async (raw) => {
      const url = raw ? await shrink(raw, crop) : null;
      urls.set(key, url);
      if (url) schedule();
    });
    return null;
  }
  return hit === 'loading' ? null : hit;
}

const escAttr = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 요원 얼굴 사진 이름 (영문명으로 명부의 요원을 찾아 고른 얼굴·대표 사진까지 본다) */
export function agentFace(char: CharacterSnapshot, english: string | undefined): string {
  if (!english) return '';
  const a = readDirectory((char.globalLore ?? []) as LoreEntry[]).agents.find((x) => x.english === english);
  return facePic(char, a ?? { english }, true);
}

/** 세력·조직 사진 이름 (명부 조직 칸의 고른 사진·영문명). slot: 대표(main) 또는 얼굴(face) */
export function factionPic(char: CharacterSnapshot, f: Pick<Faction, 'code' | 'affiliation'> & { photo?: string; english?: string }, slot: 'main' | 'face' = 'main'): string {
  const o = readDirectory((char.globalLore ?? []) as LoreEntry[]).orgs.find((x) => (x.faction ? x.faction === f.code : x.name === f.affiliation));
  const src = { photo: o?.spec.photo ?? f.photo, face: o?.spec.face, crop: o?.spec.crop, english: o?.spec.english || f.english };
  return slot === 'face' ? facePic(char, src) : mainPic(char, src);
}

/** 원형 아바타: 그 이름의 사진이 있으면 사진, 없으면 첫 글자 */
export function picAvatar(char: CharacterSnapshot, pic: string, name: string, cls = ''): string {
  const url = imageUrl(char, pic);
  const first = escAttr(Array.from(name.trim())[0] ?? '?');
  return `<span class="gx-ava${cls ? ` ${cls}` : ''}">${url ? `<img src="${escAttr(url)}" alt="" loading="lazy">` : `<span>${first}</span>`}</span>`;
}

/** 요원 아바타 (영문명으로 얼굴 사진을 찾는다) */
export const avatar = (char: CharacterSnapshot, english: string | undefined, name: string, cls = ''): string => picAvatar(char, agentFace(char, english), name, cls);

/** 시작 화면 세력 사진을 미리 읽는다. 괴이봇 Lite 채팅에 들어왔을 때 부른다 */
export function prefetchFactions(char: CharacterSnapshot): void {
  for (const f of factionList(char.globalLore)) if (!f.hidden) imageUrl(char, factionPic(char, f));
}

/** 요원 상태 색 (상황판·편성 공통) */
/** 화면에 보이는 상태 이름 (모델 태그 값은 그대로 「작전투입」, 사용자 요청으로 표시만 짧게) */
export const stLabel = (st: string) => (st === '작전투입' ? '작전' : st);

const AGENT_COLOR: Record<string, string> = { 작전투입: 'var(--signal)', 외근: 'var(--blue)', 부상: 'var(--amber)', 실종: 'var(--danger)', 격리: 'var(--danger)', 사망: 'var(--danger)', 비번: 'var(--dim)' };

/** 요원 상태 딱지 (상황판·편성·괴담톡 연락처 공통) */
export const stChip = (st: string) => `<em class="gx-st" style="--st:${AGENT_COLOR[st] ?? 'var(--dim)'}">${escAttr(stLabel(st))}</em>`;

/** 요원 카드 속: 둥근 네모 사진 + 이름·상태 + 소속 부서·직급 (+ 현재 상황) */
/** act: 톡·위키 버튼. 사진과 한 칸(.gx-acard-side)에 넣어 모바일에서는 사진 바로 아래 나란히 둔다 (PC는 카드 오른쪽 위) */
export function agentInner(char: CharacterSnapshot, p: { english?: string; name: string; department?: string; rank?: string }, st: string, situation = '', act = ''): string {
  const role = [p.department, p.rank].filter(Boolean).join(' · ');
  return `<span class="gx-acard-side">${avatar(char, p.english, p.name, 'sq')}${act}</span><span class="gx-acard-txt"><span class="gx-acard-top"><b>${escAttr(p.name)}</b>${stChip(st)}</span>${role ? `<small>${escAttr(role)}</small>` : ''}${situation ? `<span class="gx-acard-sit">${escAttr(situation)}</span>` : ''}</span>`;
}

/** 모바일 ID카드 창: 요원 정보 창과 같은 틀에 카드만 넣는다 */
export function showIdCard(html: string): void {
  const box = document.createElement('div');
  box.className = 'gx gx-agpop gx-idpop';
  box.setAttribute('role', 'dialog');
  box.innerHTML = `<div class="gx-idpop-card">${html}<button class="gx-agpop-x" aria-label="닫기">✕</button></div>`;
  const theme = document.querySelector('.gx')?.getAttribute('data-theme');
  if (theme) box.setAttribute('data-theme', theme);
  box.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.gx-idpop-card') && !(e.target as HTMLElement).closest('.gx-agpop-x')) return;
    box.remove();
  });
  document.body.appendChild(box);
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

/** 조직·외부인 이름의 얼굴 사진 (상황판 투입 칩). 명부 조직 이름·세력 표시 이름으로 찾고, 프리랜서·민간인은 공용 그림 */
export function orgFace(char: CharacterSnapshot, name: string, display: Record<string, string> = {}): string {
  const orgs = readDirectory((char.globalLore ?? []) as LoreEntry[]).orgs;
  const o = orgs.find((x) => x.name === name || (x.faction && display[x.faction] === name)) ?? orgs.find((x) => name.startsWith(x.name));
  if (o) return facePic(char, { photo: o.spec.photo, face: o.spec.face, crop: o.spec.crop, english: o.spec.english });
  if (name.startsWith('프리랜서')) return facePic(char, { english: 'Freelancer' });
  if (name.startsWith('민간인') || name.startsWith('일반인')) return facePic(char, { english: 'Civilian' });
  return '';
}
