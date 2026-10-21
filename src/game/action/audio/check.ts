// 소리 검사: OfflineAudioContext로 실제 렌더해 무음·폭주(NaN, 지나친 크기)를 잡는다. 시험 페이지와 브라우저 시험이 쓴다.
import { buildGraph } from './engine';
import { SFX, SFX_IDS, type SfxId } from './sfx';
import { Player, compileSong } from './music';
import { SONGS, SONG_IDS, type SongId } from './songs';

export interface RenderStat {
  id: string;
  peak: number;
  rms: number;
  nan: boolean;
  ms: number;
}

function stat(id: string, buf: AudioBuffer, ms: number): RenderStat {
  let peak = 0;
  let sum = 0;
  let nan = false;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) nan = true;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      n++;
    }
  }
  return { id, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), nan, ms: Math.round(ms) };
}

export async function renderSfx(id: SfxId, sec = 2.5): Promise<RenderStat> {
  const ctx = new OfflineAudioContext(2, Math.floor(44100 * sec), 44100);
  const { out } = buildGraph(ctx, ctx.destination);
  const t0 = performance.now();
  SFX[id].fn(out, 0.01, { vol: 1, pan: 0, pitch: 1, dest: out[SFX[id].bus] });
  const buf = await ctx.startRendering();
  return stat(id, buf, performance.now() - t0);
}

export async function renderSong(id: SongId, sec = 6): Promise<RenderStat> {
  const ctx = new OfflineAudioContext(2, Math.floor(44100 * sec), 44100);
  const { out } = buildGraph(ctx, ctx.destination);
  const t0 = performance.now();
  const p = new Player(out, compileSong(SONGS[id]), 0.01);
  p.schedule(sec);
  const buf = await ctx.startRendering();
  return stat(id, buf, performance.now() - t0);
}

export async function checkAll() {
  const sfx: RenderStat[] = [];
  for (const id of SFX_IDS) sfx.push(await renderSfx(id));
  const songs: RenderStat[] = [];
  for (const id of SONG_IDS) songs.push(await renderSong(id));
  return { sfx, songs };
}
