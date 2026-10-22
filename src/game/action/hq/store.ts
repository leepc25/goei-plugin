// 저장소. 실제 Risu에서는 「리스 플러그인 탑재」 스레드의 bridge.saves(pluginStorage 슬롯: 0 = 자동, 1~3 = 수동)를 쓴다.
// 시연판·시험은 같은 모양의 IndexedDB 대용(idbSaves)이나 메모리(memorySaves)를 쓴다.
export interface SaveMeta {
  slot: number;
  savedAt: number;
  title: string;
  summary: string;
  schema: string;
}
export interface SaveSlots {
  read(slot: number): Promise<string | null>;
  write(slot: number, data: string, meta: { title: string; summary: string; schema: string }): Promise<void>;
  list(): Promise<SaveMeta[]>;
  /** 수동 저장 전체를 현재 자동 저장으로 복원. 반환 문자열은 본부 데이터. */
  restore?(slot: number): Promise<string | null>;
}

export function memorySaves(): SaveSlots {
  const data = new Map<number, string>();
  const metas = new Map<number, SaveMeta>();
  return {
    read: async (slot) => data.get(slot) ?? null,
    write: async (slot, d, m) => {
      data.set(slot, d);
      metas.set(slot, { slot, savedAt: Date.now(), ...m });
    },
    list: async () => [...metas.values()].sort((a, b) => a.slot - b.slot),
  };
}

/** IndexedDB 대용. pluginStorage와 같은 키 이름(goei:game:slot:N, goei:game:slots)을 쓴다. 막히면 메모리로. */
export function idbSaves(dbName = 'goei-hq-demo'): SaveSlots {
  let dbp: Promise<IDBDatabase> | null = null;
  const fallback = memorySaves();
  const open = () =>
    (dbp ??= new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }));
  const get = async (key: string): Promise<unknown> => {
    const db = await open();
    return new Promise((res, rej) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };
  const put = async (key: string, v: unknown) => {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  };
  let broken = false;
  const safe = async <T>(f: () => Promise<T>, alt: () => Promise<T>) => {
    if (broken) return alt();
    try {
      return await f();
    } catch {
      broken = true;
      return alt();
    }
  };
  return {
    read: (slot) => safe(async () => ((await get(`goei:game:slot:${slot}`)) as string | undefined) ?? null, () => fallback.read(slot)),
    write: (slot, d, m) =>
      safe(
        async () => {
          await put(`goei:game:slot:${slot}`, d);
          const list = ((await get('goei:game:slots')) as SaveMeta[] | undefined) ?? [];
          await put('goei:game:slots', [...list.filter((x) => x.slot !== slot), { slot, savedAt: Date.now(), ...m }].sort((a, b) => a.slot - b.slot));
        },
        () => fallback.write(slot, d, m),
      ),
    list: () => safe(async () => ((await get('goei:game:slots')) as SaveMeta[] | undefined) ?? [], () => fallback.list()),
  };
}
