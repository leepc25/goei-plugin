// 게임 저장 칸: pluginStorage에 칸마다 한 값(goei:game:slot:N)과 목록 하나(goei:game:slots).
// 본문은 게임(본부)이 정한 문자열 그대로 둔다. 카드·채팅과 무관하게 이 기기의 Risu에 남는다.
// 쓰기는 차례로 한다 (자동 저장과 수동 저장이 겹쳐도 목록이 어긋나지 않게).
import { SLOT_IDS, type GameSaves, type SlotId, type SlotInfo } from '../../game/bridge';

const SLOT_KEY = (n: SlotId) => `goei:game:slot:${n}`;
const LIST_KEY = 'goei:game:slots';

interface ListData {
  slots: SlotInfo[];
  last: SlotId | null;
}

let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(f: () => Promise<T>): Promise<T> => {
  const run = queue.then(f);
  queue = run.catch(() => {});
  return run;
};

const isSlot = (n: unknown): n is SlotId => SLOT_IDS.includes(n as SlotId);

async function readList(): Promise<ListData> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(LIST_KEY);
    const v = typeof raw === 'string' ? (JSON.parse(raw) as ListData) : null;
    if (v && Array.isArray(v.slots)) return { slots: v.slots.filter((s) => isSlot(s?.slot)), last: isSlot(v.last) ? v.last : null };
  } catch {
    /* 깨졌으면 비운다 */
  }
  return { slots: [], last: null };
}

const writeList = (l: ListData) => risuai.pluginStorage.setItem(LIST_KEY, JSON.stringify(l));

export const gameSaves: GameSaves = {
  list: async () => {
    await queue;
    return (await readList()).slots.sort((a, b) => a.slot - b.slot);
  },
  read: async (slot) => {
    if (!isSlot(slot)) return null;
    await queue;
    const v: unknown = await risuai.pluginStorage.getItem(SLOT_KEY(slot));
    return typeof v === 'string' ? v : null;
  },
  write: (slot, data, info) =>
    serial(async () => {
      if (!isSlot(slot)) throw new Error(`저장 칸 ${slot}은 없어요.`);
      await risuai.pluginStorage.setItem(SLOT_KEY(slot), data);
      const l = await readList();
      const row: SlotInfo = { slot, savedAt: Date.now(), title: String(info.title ?? ''), summary: String(info.summary ?? ''), schema: String(info.schema ?? ''), size: data.length };
      l.slots = [...l.slots.filter((s) => s.slot !== slot), row];
      l.last = slot;
      await writeList(l);
    }),
  remove: (slot) =>
    serial(async () => {
      if (!isSlot(slot)) return;
      await risuai.pluginStorage.removeItem(SLOT_KEY(slot));
      const l = await readList();
      l.slots = l.slots.filter((s) => s.slot !== slot);
      if (l.last === slot) l.last = l.slots.sort((a, b) => b.savedAt - a.savedAt)[0]?.slot ?? null;
      await writeList(l);
    }),
  last: async () => {
    await queue;
    return (await readList()).last;
  },
};

/** 한 칸을 다른 칸으로 (자동 저장 → 수동 칸 보관) */
export async function copySlot(from: SlotId, to: SlotId): Promise<boolean> {
  const data = await gameSaves.read(from);
  const info = (await gameSaves.list()).find((s) => s.slot === from);
  if (data == null || !info) return false;
  await gameSaves.write(to, data, info);
  return true;
}
