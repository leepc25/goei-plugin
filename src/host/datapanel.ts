// 세계 자료(goei-data-world)를 받지 못했을 때 본체가 띄우는 작은 창: 까닭 · 다시 받기 · 파일로 넣기 · 닫기 (QC 개선 나1, 검토 반영 09_개선_나_검토반영.md).
// 시작기의 받기 창(loader/panel.ts)과 같은 모양(PANEL_CSS). 본체가 띄우는 까닭: 세계 자료는 본체가 받으므로 까닭·다시 받기·파일 넣기를 아는 쪽이 본체다.
// 시작기(src/main.ts)는 이 창이 떠 있으면(__goeiBodyPanel) 자기 창을 띄우지 않고(파일로 넣기 뒤에도 자기 창을 거둔다),
// 다시 받기·파일 넣기에 성공하면 본체가 __goeiRelaunch 로 다시 띄워 달라고 한다.
// 창을 띄우는 때(시작기 창의 prompt 정책과 같게): 카드를 열었거나 단추를 눌렀을 때(prompt) 는 늘, 메시지 표시·요청으로 조용히 다시 시작했을 때는
// 사용자가 「닫기」로 닫은 적이 없을 때만. 닫음 표시는 전역(__goeiWorldDismissed, host/datapack.ts)이라 본체가 다시 실행돼도 남고, 자료가 들어오면 지워진다.
// 파일로 넣기: 릴리스 zip 의 goei-data-world.txt(조각을 이은 팩 글 하나). 네트워크가 막힌 환경에서 본체(goei-body.js)와 함께 넣으면 켜진다.
import { PANEL_CSS } from '../loader/panel';
import { installWorldFile, loadWorldData, type WorldGlobals } from './datapack';

const MARK = 'data-gl-world';
type G = WorldGlobals & { __goeiBodyPanel?: boolean; __goeiRelaunch?: () => void };
const g = globalThis as G;

/** 지금 떠 있는 창 (본체가 다시 실행되면 모듈 상태가 새로 생기므로 DOM 으로 찾는다) */
const current = (): HTMLElement | null => document.querySelector<HTMLElement>(`[${MARK}]`);

/** byUser: 사용자가 「닫기」를 눌렀다 → 카드를 다시 열기 전에는 조용한 재시작(표시·요청)에서 다시 띄우지 않는다 */
export function closeWorldDataPanel(byUser = false): void {
  const root = current();
  if (!root) return;
  root.remove();
  g.__goeiBodyPanel = false;
  if (byUser) g.__goeiWorldDismissed = true;
  void risuai.hideContainer();
}

/**
 * 받기 실패 창. 이미 떠 있으면 까닭만 바꾼다. prompt 가 아니고(메시지 표시·요청으로 조용히 다시 시작) 사용자가 닫은 적이 있으면 띄우지 않고 로그만
 * (옛 시작기처럼 prompt 를 넘기지 않는 시작기는 처음 실패에만 창이 뜬다)
 */
export function showWorldDataPanel(reason: string, prompt = false): void {
  const had = current();
  if (had) {
    const msg = had.querySelector<HTMLElement>('.gl-msg');
    if (msg) (msg.hidden = false), (msg.textContent = reason);
    return;
  }
  if (!prompt && g.__goeiWorldDismissed) {
    console.log(`[goei] 세계 자료 받기 창은 닫혀 있어 다시 띄우지 않아요 (카드를 다시 열면 띄움): ${reason}`);
    return;
  }
  delete g.__goeiWorldDismissed;
  const root = document.createElement('div');
  root.setAttribute(MARK, '1');
  root.innerHTML = `<style>${PANEL_CSS}</style><div class="gl-back"><div class="gl-card" role="dialog" aria-label="괴이 ː ANOMALY">
      <b>괴이 ː ANOMALY</b>
      <p>세계 자료(요원·조직·괴이 기록)를 받지 못했어요. 플러그인은 이 자료를 받아 둔 뒤에 켜져요. 네트워크를 확인하고 다시 받거나, 릴리스 zip에 든 goei-data-world.txt를 넣어 주세요.</p>
      <p class="gl-msg"></p>
      <div class="gl-act"><button class="primary" data-gl="get">다시 받기</button><button data-gl="file">파일로 넣기</button><button data-gl="close">닫기</button></div>
    </div></div>`;
  document.body.append(root);
  g.__goeiBodyPanel = true;
  void risuai.showContainer('fullscreen');
  const msg = root.querySelector<HTMLElement>('.gl-msg')!;
  const btns = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const say = (t: string) => ((msg.hidden = !t), (msg.textContent = t));
  say(reason);
  /** 받기·파일 넣기 한 번: 성공하면 창을 닫고 본체를 다시 띄운다, 실패하면 까닭을 창에 */
  const run = (job: () => Promise<void>, busy: string) => {
    btns.forEach((b) => (b.disabled = true));
    say(busy);
    void job()
      .then(() => done(root, say, btns))
      .catch((e: unknown) => {
        say(e instanceof Error ? e.message : String(e));
        btns.forEach((b) => (b.disabled = false));
      });
  };
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.txt,.json';
  picker.hidden = true;
  root.append(picker);
  picker.addEventListener('change', () => {
    const f = picker.files?.[0];
    picker.value = '';
    if (f) run(async () => installWorldFile(await f.text()), '넣는 중');
  });
  root.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement).closest<HTMLElement>('[data-gl]')?.dataset.gl;
    if (act === 'close') closeWorldDataPanel(true);
    else if (act === 'file') picker.click();
    else if (act === 'get') run(() => loadWorldData(true).then(() => undefined), '받는 중');
  });
}

/**
 * 자료가 들어온 뒤: 새 시작기는 고리(__goeiRelaunch)로 바로 다시 띄운다 → 창을 닫는다.
 * 고리가 없는 시작기(판이 같은 옛 모양의 시작기, 또는 언로드 뒤)는 다시 띄울 길이 없으므로 창을 닫지 않고 「받았어요」와 닫기만 남긴다
 * — 채팅을 다시 저장해 억지로 그리게 하지 않는다(요청 도중이면 응답이 사라질 수 있다, body.ts). 다음 메시지·카드 열기 때 시작기가 띄운다
 */
function done(root: HTMLElement, say: (t: string) => void, btns: HTMLButtonElement[]): void {
  if (typeof g.__goeiRelaunch === 'function') {
    closeWorldDataPanel();
    g.__goeiRelaunch();
    return;
  }
  say('받았어요. 카드를 다시 열거나 메시지를 보내면 켜져요.');
  for (const b of btns) {
    b.disabled = false;
    if (b.dataset.gl !== 'close') b.hidden = true;
  }
  root.setAttribute('data-gl-done', '1');
}
