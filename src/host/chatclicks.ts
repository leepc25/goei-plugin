// 채팅 메시지 속 버튼(요청 취소, 상태창 말풍선·위키 이름)을 누를 때.
// Risu SafeElement 리스너는 건 요소 안의 이벤트만 받아서(2026-10 #1610) body에 하나 걸고, 좌표로 맞춰 본다.
// 해당 카드를 그린 적이 있을 때만(arm) 클릭마다 찾는다. 다른 봇·평소에는 아무 일도 안 한다.
import { body } from './overlay';

type Root = NonNullable<Awaited<ReturnType<typeof body>>>;
export type Doc = Root['doc'];
type El = Awaited<ReturnType<Doc['createElement']>>;
export interface Rect { left: number; top: number; width: number; height: number }

/** 처리기: 이 클릭을 맡았으면 true. 처리할 카드가 화면에 없으면 'idle' (그러면 다시 arm될 때까지 쉰다) */
type Handler = (doc: Doc, x: number, y: number) => Promise<boolean | 'idle'>;

const handlers = new Map<string, { run: Handler; armed: boolean }>();
let listening = false;

export function onChatClick(name: string, run: Handler): void {
  handlers.set(name, { run, armed: handlers.get(name)?.armed ?? false });
}

/** 그 카드를 채팅에 그릴 때 부른다 (display). 리스너는 처음 한 번만 건다 */
export function armChatClick(name: string): void {
  const h = handlers.get(name);
  if (h) h.armed = true;
  if (!listening) void listen();
}

async function listen(): Promise<void> {
  listening = true;
  try {
    const root = await body();
    if (!root) return void (listening = false);
    await root.body.addEventListener('click', ((ev: { clientX?: number; clientY?: number }) => void dispatch(root.doc, ev.clientX ?? -1, ev.clientY ?? -1)) as (e: unknown) => void, { passive: true });
  } catch {
    listening = false;
  }
}

async function dispatch(doc: Doc, x: number, y: number): Promise<void> {
  for (const h of handlers.values()) {
    if (!h.armed) continue;
    try {
      const r = await h.run(doc, x, y);
      if (r === 'idle') h.armed = false;
      else if (r) return;
    } catch (error) {
      console.log(`[goei] 채팅 클릭 처리 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function elements(doc: Doc, selector: string): Promise<El[]> {
  return (await risuai.unwarpSafeArray(await doc.querySelectorAll(selector)).catch(() => [])) as El[];
}

export async function hit(el: El, x: number, y: number): Promise<boolean> {
  const r = (await el.getBoundingClientRect().catch(() => null)) as Rect | null;
  return !!r && r.width > 0 && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
}
