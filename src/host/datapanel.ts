// 세계 자료(goei-data-world)를 받지 못했을 때 본체가 띄우는 작은 창: 까닭 · 다시 받기 · 닫기 (QC 개선 나1).
// 시작기의 받기 창(loader/panel.ts)과 같은 모양(PANEL_CSS). 왜 본체가 띄우나: 옛 시작기(release/goei-plugin.js)는 본체 start() 가 던지면
// 로그만 남기고 아무 창도 띄우지 않는다. 새 시작기(src/main.ts)는 이 창이 떠 있으면(__goeiBodyPanel) 자기 창을 띄우지 않고,
// 다시 받기에 성공하면 __goeiRelaunch 로 본체를 다시 띄운다. 옛 시작기에는 그 고리가 없어 채팅을 그대로 다시 저장해(Risu 가 다시 그림 →
// display 처리기 → 시작기가 본체를 다시 시작) 띄우고, 메시지가 없는 채팅이면 다음 메시지·요청·카드 열기 때 뜬다 (창에 안내).
import { PANEL_CSS } from '../loader/panel';
import { loadWorldData } from './datapack';

const MARK = 'data-gl-world';
type G = { __goeiBodyPanel?: boolean; __goeiRelaunch?: () => void };
const g = globalThis as G;

/** 지금 떠 있는 창 (옛 시작기가 본체를 다시 실행하면 모듈 상태가 새로 생기므로 DOM 으로 찾는다) */
const current = (): HTMLElement | null => document.querySelector<HTMLElement>(`[${MARK}]`);

export function closeWorldDataPanel(): void {
  const root = current();
  if (!root) return;
  root.remove();
  g.__goeiBodyPanel = false;
  void risuai.hideContainer();
}

/** 받기 실패 창. 이미 떠 있으면 까닭만 바꾼다 */
export function showWorldDataPanel(reason: string): void {
  const had = current();
  if (had) {
    const msg = had.querySelector<HTMLElement>('.gl-msg');
    if (msg) (msg.hidden = false), (msg.textContent = reason);
    return;
  }
  const root = document.createElement('div');
  root.setAttribute(MARK, '1');
  root.innerHTML = `<style>${PANEL_CSS}</style><div class="gl-back"><div class="gl-card" role="dialog" aria-label="괴이 ː ANOMALY">
      <b>괴이 ː ANOMALY</b>
      <p>세계 자료(요원·조직·괴이 기록)를 받지 못했어요. 플러그인은 이 자료를 받아 둔 뒤에 켜져요. 네트워크를 확인하고 다시 받아 주세요.</p>
      <p class="gl-msg"></p>
      <div class="gl-act"><button class="primary" data-gl="get">다시 받기</button><button data-gl="close">닫기</button></div>
    </div></div>`;
  document.body.append(root);
  g.__goeiBodyPanel = true;
  void risuai.showContainer('fullscreen');
  const msg = root.querySelector<HTMLElement>('.gl-msg')!;
  const btns = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const say = (t: string) => ((msg.hidden = !t), (msg.textContent = t));
  say(reason);
  root.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement).closest<HTMLElement>('[data-gl]')?.dataset.gl;
    if (act === 'close') closeWorldDataPanel();
    else if (act === 'get') {
      btns.forEach((b) => (b.disabled = true));
      say('받는 중');
      void loadWorldData(true)
        .then(async () => {
          closeWorldDataPanel();
          await relaunch();
        })
        .catch((e: unknown) => {
          say(e instanceof Error ? e.message : String(e));
          btns.forEach((b) => (b.disabled = false));
        });
    }
  });
}

/** 받은 뒤 본체를 다시 띄운다: 새 시작기는 고리(__goeiRelaunch), 옛 시작기는 채팅 다시 저장으로 Risu 가 다시 그리게 */
async function relaunch(): Promise<void> {
  if (typeof g.__goeiRelaunch === 'function') {
    g.__goeiRelaunch();
    return;
  }
  try {
    const ci = await risuai.getCurrentCharacterIndex();
    const chi = await risuai.getCurrentChatIndex();
    const chat = (await risuai.getChatFromIndex(ci, chi)) as { message?: unknown[] } | null;
    if (chat && Array.isArray(chat.message) && chat.message.length) await risuai.setChatToIndex(ci, chi, chat);
  } catch {
    // 다시 그리지 못해도 다음 메시지·요청·카드 열기 때 시작기가 본체를 띄운다
  }
}
