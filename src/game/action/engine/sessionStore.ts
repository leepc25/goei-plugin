import type { SaveSlots } from '../hq/store';
import type { RunCheckpoint } from './checkpoint';
import { parseSave } from '../hq/state';

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
  if (value?.schema === 'goei-session/1') {
    if (!Number.isFinite(value.revision) || value.revision < 0 || (value.hq !== null && typeof value.hq !== 'string')) throw new Error('손상된 저장 봉투');
    return { ...empty(), ...value };
  }
  if (!parseSave(raw)) throw new Error('지원하지 않는 저장');
  return { ...empty(), hq: raw }; // 기존 본부 저장을 보존한다.
};

/** 본부·영구 진행·출동을 같은 슬롯에 쓴다. 브리지 쓰기는 순서대로,
 * 닫기 직전 기록은 동기 저널에 먼저 남겨 다음 실행에서 회수한다. */
export class SessionStore {
  private value = empty();
  private queue: Promise<void> = Promise.resolve();
  private loaded = false;
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
    }).catch(() => { this.error = '저장 칸을 읽지 못했습니다. 이 기기의 복구 기록을 사용합니다.'; }).then(() => { this.loaded = true; });
    this.hqSaves = {
      list: () => saves.list(),
      read: async n => { await this.ready; return n === slot ? this.value.hq : parse(await saves.read(n)).hq; },
      write: async (n, hq, info) => {
        if (!this.loaded) await this.ready;
        if (n !== slot) {
          let oldRevision = 0;
          try { oldRevision = parse(await saves.read(n)).revision; } catch { /* 명시한 슬롯 덮어쓰기는 손상된 이전 기록에도 가능 */ }
          try { oldRevision = Math.max(oldRevision, parse(this.journal?.getItem(this.keyFor(n)) ?? null).revision); } catch { /* 손상된 저널은 대체 */ }
          const snapshot = { ...this.value, hq, revision: Math.max(Date.now(), this.value.revision + 1, oldRevision + 1) };
          const text = JSON.stringify(snapshot);
          try { this.journal?.setItem(this.keyFor(n), text); } catch { /* 브리지 저장은 계속 */ }
          return saves.write(n, text, { ...info, schema: 'goei-session/1' });
        }
        this.value.hq = hq;
        // Game.endRun은 HQ 정산 직후 체크포인트 제거를 호출한다. 이 둘 사이에도
        // 저널이 복구 가능하도록, 완료한 출동의 HQ와 체크포인트를 한 봉투로 쓴다.
        const completed = parseSave(hq);
        const run = this.value.checkpoint?.run as { runId?: string; launch?: { runId?: string } } | undefined;
        if (!completed?.active && completed?.last && completed.last.runId === (run?.launch?.runId ?? run?.runId)) this.value.checkpoint = null;
        this.persist();
        await this.flush();
      },
      restore: async n => {
        await this.ready;
        await this.flush();
        // 읽기와 복원을 분리한다. 단순 슬롯 조회는 현재 출동을 바꾸지 않는다.
        let remote: Session | null = null, cached: Session | null = null;
        try { remote = parse(await saves.read(n)); } catch { /* 저널에서 복구 */ }
        try { cached = parse(this.journal?.getItem(this.keyFor(n)) ?? null); } catch { /* 브리지에서 복구 */ }
        const next = cached && (!remote || cached.revision > remote.revision) ? cached : remote;
        if (!next?.hq || !parseSave(next.hq)) return null;
        this.value = { ...next, revision: Math.max(next.revision, this.value.revision) };
        this.persist();
        await this.flush();
        return this.value.hq;
      },
    };
  }
  private keyFor(slot: number) { return `goei-session-journal:${slot}`; }
  private get key() { return this.keyFor(this.slot); }
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
