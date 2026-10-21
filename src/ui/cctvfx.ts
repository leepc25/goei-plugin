// CCTV 괴이 효과 (2026-10-21 사용자: 상황판·상세 창 CCTV를 더 괴이스럽게). 그림은 새로 안 쓰고 CSS 클래스만 잠깐 붙였다 뗀다.
// 찢김(tear)·신호 끊김(lost)·렌즈 앞을 스치는 형체(shade)·글자 깨짐(text)·붉은 숨(breath, 가끔만: 사용자가 늘 켜 둔 건 과하다 함).
// 괴이는 등급이 높을수록 자주, 사건·특수는 찢김·끊김만 드물게. 화면 다시 그리기가 클래스를 지워도 다음 틱에 다시 고른다.

type Fx = 'tear' | 'lost' | 'shade' | 'text' | 'breath';

/** 1초 틱마다 일어날 확률 (B등급 괴이 기준) */
const BASE: Record<Fx, number> = { tear: 0.12, lost: 0.03, shade: 0.04, text: 0.05, breath: 0.04 };
/** 효과가 붙어 있는 시간(ms) */
const LAST: Record<Fx, number> = { tear: 260, lost: 1500, shade: 1400, text: 750, breath: 4200 };
/** 신호 끊김 뒤 돌아오는 연출 시간(ms) */
const BACK_MS = 1300;
/** 돌아올 때 형체 연출: 붉은 장면에 렌즈 앞에 서 있음 · 켜지자 옆으로 휙 도망 · 멀리 서 있다가 깜빡일 때마다 다가옴 · 화면 끝에 숨어 있다 빠져나감 · 렌즈에 바짝 붙어 있다 떨어짐 */
const BACKS = ['stand', 'flee', 'near', 'peek', 'lens'];
/** 괴이만 쓰는 효과 */
const AN_ONLY: Fx[] = ['shade', 'text', 'breath'];
/** 같은 효과가 다시 나기까지 최소 간격(ms): 확률이 겹쳐도 연달아 나오지 않게 */
const GAP: Record<Fx, number> = { tear: 4000, lost: 20000, shade: 20000, text: 10000, breath: 15000 };
/** 화면이 새로 뜰 때마다 하나 (사용자: 1분씩 들여다보는 사람은 없다). 직전 틱에 없던 화면이면 새로 뜬 것 */
const FIRST: Fx[] = ['shade', 'shade', 'text', 'text', 'tear', 'lost'];
let visible = new Set<string>();
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
  setTimeout(() => {
    view.classList.remove(cls);
    // 신호가 돌아올 때 (2026-10-21 사용자: 그냥 쓱 켜지지 말고 오싹하게, 숨어 있다 도망가거나 다양하게):
    // 브라운관처럼 한 줄에서 펴지고 반전·세로 흘림 뒤, 매번 다른 형체 연출 하나 (CSS fx-back[data-back])
    if (fx === 'lost' && view.isConnected) {
      view.dataset.back = BACKS[Math.floor(Math.random() * BACKS.length)];
      view.classList.add('fx-back');
      setTimeout(() => view.classList.remove('fx-back'), BACK_MS);
    }
  }, LAST[fx]);
}

function tick(root: HTMLElement): void {
  const now = new Set<string>();
  for (const view of root.querySelectorAll<HTMLElement>('.gx-opview.feed:not(.ended):not(.nosig)')) {
    const an = view.classList.contains('k-an');
    // 처음 보는 화면: 1~2.5초 안에 하나 (괴이는 아무거나, 사건·특수는 찢김)
    const key = view.dataset.fxkey ?? '';
    now.add(key);
    if (key && !visible.has(key)) {
      const fx = an ? FIRST[Math.floor(Math.random() * FIRST.length)] : 'tear';
      lastAt.set(fx, Date.now());
      setTimeout(() => view.isConnected && fireFx(view, fx), Math.random() * 1500);
      continue;
    }
    const scale = an ? GRADE[view.dataset.grade ?? ''] ?? 1 : 0.4;
    for (const fx of Object.keys(BASE) as Fx[]) {
      if (!an && AN_ONLY.includes(fx)) continue;
      if (Date.now() - (lastAt.get(fx) ?? 0) < GAP[fx] || Math.random() >= BASE[fx] * scale) continue;
      lastAt.set(fx, Date.now());
      fireFx(view, fx);
    }
  }
  visible = now;
}

export function startCctvFx(root: HTMLElement): void {
  if (timer || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = setInterval(() => tick(root), 1000);
  tick(root);
}

export function stopCctvFx(): void {
  if (timer) clearInterval(timer);
  timer = null;
  visible = new Set();
}
