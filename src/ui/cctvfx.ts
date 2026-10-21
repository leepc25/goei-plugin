// CCTV 괴이 효과 (2026-10-21 사용자: 상황판·상세 창 CCTV를 더 괴이스럽게). 그림은 새로 안 쓰고 CSS 클래스만 잠깐 붙였다 뗀다.
// 찢김(tear)·신호 끊김(lost)·렌즈 앞을 스치는 형체(shade)·글자 깨짐(text)·붉은 숨(breath, 가끔만: 사용자가 늘 켜 둔 건 과하다 함).
// 괴이는 등급이 높을수록 자주, 사건·특수는 찢김·끊김만 드물게. 화면 다시 그리기가 클래스를 지워도 다음 틱에 다시 고른다.

type Fx = 'tear' | 'lost' | 'shade' | 'text' | 'breath';

/** 1초 틱마다 일어날 확률 (B등급 괴이 기준) */
const BASE: Record<Fx, number> = { tear: 0.09, lost: 0.018, shade: 0.012, text: 0.03, breath: 0.02 };
/** 효과가 붙어 있는 시간(ms) */
const LAST: Record<Fx, number> = { tear: 260, lost: 1500, shade: 1400, text: 750, breath: 4200 };
/** 괴이만 쓰는 효과 */
const AN_ONLY: Fx[] = ['shade', 'text', 'breath'];
/** 같은 효과가 다시 나기까지 최소 간격(ms): 확률이 겹쳐도 연달아 나오지 않게 */
const GAP: Record<Fx, number> = { tear: 4000, lost: 30000, shade: 60000, text: 15000, breath: 25000 };
const lastAt = new Map<Fx, number>();
const GRADE: Record<string, number> = { s: 1.8, a: 1.35, b: 1, c: 0.6, d: 0.35 };
const BLOCKS = '█▓▒░#?¿§';
const JAMO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ';

let timer: ReturnType<typeof setInterval> | null = null;

const any = (set: string) => set[Math.floor(Math.random() * set.length)];
/** 글자 하나 깨기: 한글은 다른 음절·낱자로, 숫자·영문은 블록 글자로. 빈칸은 그대로 */
function garble(ch: string): string {
  if (/\s/.test(ch) || Math.random() > 0.45) return ch;
  if (/[가-힣]/.test(ch)) return Math.random() < 0.5 ? any(JAMO) : String.fromCharCode(0xac00 + Math.floor(Math.random() * 11172));
  return any(BLOCKS);
}

/** 화면 위 글자(OSD·제목·설명) 전부를 잠깐 깨뜨렸다 되돌린다. 몇 번 바꿔 가며 떨린다 */
function textGlitch(view: HTMLElement): void {
  const nodes: Text[] = [];
  for (const box of view.querySelectorAll('.gx-oposd, .gx-opcap')) {
    const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue?.trim()) nodes.push(n as Text);
  }
  const real = nodes.map((n) => n.nodeValue ?? '');
  const shake = () => nodes.forEach((n, i) => (n.nodeValue = Array.from(real[i]).map(garble).join('')));
  shake();
  const steps = [130, 280, 470].map((ms) => setTimeout(shake, ms));
  setTimeout(() => {
    steps.forEach(clearTimeout);
    nodes.forEach((n, i) => (n.nodeValue = real[i]));
  }, LAST.text - 10);
}

/** 이 화면에 효과 하나를 바로 건다 (다음 틱 기다리지 않음) */
export function fireFx(view: HTMLElement, fx: Fx): void {
  const cls = `fx-${fx}`;
  if (view.classList.contains(cls)) return;
  if (fx === 'text') textGlitch(view);
  view.classList.add(cls);
  setTimeout(() => view.classList.remove(cls), LAST[fx]);
}

function tick(root: HTMLElement): void {
  for (const view of root.querySelectorAll<HTMLElement>('.gx-opview.feed:not(.ended):not(.nosig)')) {
    const an = view.classList.contains('k-an');
    const scale = an ? GRADE[view.dataset.grade ?? ''] ?? 1 : 0.4;
    for (const fx of Object.keys(BASE) as Fx[]) {
      if (!an && AN_ONLY.includes(fx)) continue;
      if (Date.now() - (lastAt.get(fx) ?? 0) < GAP[fx] || Math.random() >= BASE[fx] * scale) continue;
      lastAt.set(fx, Date.now());
      fireFx(view, fx);
    }
  }
}

export function startCctvFx(root: HTMLElement): void {
  if (timer || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = setInterval(() => tick(root), 1000);
}

export function stopCctvFx(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
