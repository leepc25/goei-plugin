import type { SaveSlots } from '../hq/store';
import type { RunCheckpoint } from './checkpoint';

interface Session {
  schema: 'goei-session/1';
  revision: number;
  hq: string | null;
  meta: unknown;
  checkpoint: RunCheckpoint | null;
}
const empty = (): Session => ({ schema: 'goei-session/1', revision: 0, hq: null, meta: null, checkpoint: null });
const parse = (raw: string | null): Session => {
  if (!raw) return empty();
  const value = JSON.parse(raw);
  if (value.schema === 'goei-session/1') return value;
  return { ...empty(), hq: raw }; // 기존 본부 저장을 보존한다.
};

/** 본부·영구 진행·출동을 같은 슬롯에 쓴다. 브리지 쓰기는 순서대로,
 * 닫기 직전 기록은 동기 저널에 먼저 남겨 다음 실행에서 회수한다. */
export class SessionStore {
  private value = empty();
  private queue: Promise<void> = Promise.resolve();
  readonly ready: Promise<void>;
  error: string | null = null;
  readonly hqSaves: SaveSlots;
  constructor(private saves: SaveSlots, private slot: number, private journal?: Pick<Storage, 'getItem' | 'setItem'>) {
    let cached: Session | null = null;
    try { const raw = journal?.getItem(this.key); if (raw) cached = parse(raw); } catch { /* 브리지에서 복구 */ }
    if (cached) this.value = cached;
    this.ready = saves.read(slot).then(raw => {
      const remote = parse(raw);
      if (!cached || remote.revision > cached.revision) this.value = remote;
      if (cached && cached.revision > remote.revision) this.persist();
    }).catch(() => { this.error = '저장 칸을 읽지 못했습니다. 이 기기의 복구 기록을 사용합니다.'; });
    this.hqSaves = {
      list: () => saves.list(),
      read: async n => { await this.ready; return n === slot ? this.value.hq : parse(await saves.read(n)).hq; },
      write: async (n, hq, info) => {
        if (n !== slot) return saves.write(n, JSON.stringify({ ...this.value, hq }), { ...info, schema: 'goei-session/1' });
        this.value.hq = hq;
        this.persist();
        await this.flush();
      },
    };
  }
  private get key() { return `goei-session-journal:${this.slot}`; }
  get checkpoint() { return this.value.checkpoint; }
  get meta() { return this.value.meta; }
  get hasSave() { return !!(this.value.hq || this.value.checkpoint); }
  setMeta(meta: unknown) { this.value.meta = JSON.parse(JSON.stringify(meta)); }
  setCheckpoint(checkpoint: RunCheckpoint | null) { this.value.checkpoint = checkpoint; this.persist(); }
  private persist() {
    this.value.revision = Math.max(Date.now(), this.value.revision + 1);
    const text = JSON.stringify(this.value);
    try { this.journal?.setItem(this.key, text); } catch { this.error = '기기 복구 기록을 쓰지 못했습니다.'; }
    this.queue = this.queue.catch(() => {}).then(() => this.saves.write(this.slot, text, {
      title: this.value.checkpoint ? '출동 중 · 안전 지점' : '자동 저장',
      summary: '본부 · 규칙서 · 출동 기록', schema: 'goei-session/1',
    })).catch(() => { this.error = '자동 저장에 실패했습니다. 기기 복구 기록을 유지합니다.'; });
  }
  flush() { return this.queue; }
}
