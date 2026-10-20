// 가짜 팩 부하 시험 (구현가능성 검토 5.1): 노이즈 PNG를 실제 규격·장수로 만들어 저장·읽기·디코딩·교체를 재고 숫자를 돌려준다.
export interface LoadSpec {
  size: 128 | 96 | 80;
  agents: number;
  framesPerAgent: number;
  enemies: number;
  framesPerEnemy: number;
  tilesets: number;
}
export interface LoadResult {
  lines: string[];
  files: number;
  bytes: number;
  decodedBytes: number;
  encodeMs: number;
  storeMs: number;
  readMs: number;
  decodeMs: number;
  swapMs: number;
  heapBefore: number;
  heapAfter: number;
  uaMemory: number | null;
}
const canvasFor = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
async function noisePng(w: number, h: number, seed: number): Promise<Blob> {
  const c = canvasFor(w, h),
    ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  let s = seed >>> 0;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = s & 255;
    d[i + 1] = (s >>> 8) & 255;
    d[i + 2] = (s >>> 16) & 255;
    d[i + 3] = (s >>> 24) & 255 ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('toBlob 실패'))), 'image/png'));
}
const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
async function uaMem(): Promise<number | null> {
  const f = (performance as unknown as { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> }).measureUserAgentSpecificMemory;
  if (!f) return null;
  try {
    return (await f.call(performance)).bytes;
  } catch {
    return null;
  }
}
function idb(): Promise<IDBDatabase> {
  return new Promise((ok, no) => {
    const r = indexedDB.open('goei-graybox-loadtest', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
function idbPut(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((ok, no) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').put(value, key);
    t.oncomplete = () => ok();
    t.onerror = () => no(t.error);
  });
}
function idbGet(db: IDBDatabase, key: string): Promise<string> {
  return new Promise((ok, no) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => ok(String(r.result ?? ''));
    r.onerror = () => no(r.error);
  });
}
const toB64 = (buf: ArrayBuffer) => {
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

export async function runLoadTest(spec: LoadSpec, progress: (s: string) => void): Promise<LoadResult> {
  const canvas = spec.size === 128 ? 160 : spec.size === 96 ? 128 : 96;
  // 트리밍 가정: 실제 몸은 캔버스의 60%×100%
  const bodyW = Math.round(canvas * 0.6),
    bodyH = canvas;
  const items: { w: number; h: number; tag: string }[] = [];
  for (let a = 0; a < spec.agents; a++) for (let i = 0; i < spec.framesPerAgent; i++) items.push({ w: bodyW, h: bodyH, tag: `agent${a}` });
  for (let e = 0; e < spec.enemies; e++) for (let i = 0; i < spec.framesPerEnemy; i++) items.push({ w: bodyW, h: bodyH, tag: `enemy${e}` });
  for (let t = 0; t < spec.tilesets; t++) items.push({ w: 1024, h: 512, tag: `tileset${t}` });
  progress(`PNG ${items.length}장 생성 중…`);
  const t0 = performance.now();
  const blobs: Blob[] = [];
  for (let i = 0; i < items.length; i++) {
    blobs.push(await noisePng(items[i].w, items[i].h, i + 1));
    if (i % 50 === 0) progress(`PNG 생성 ${i}/${items.length}`);
  }
  const encodeMs = performance.now() - t0;
  const bytes = blobs.reduce((s, b) => s + b.size, 0);
  const decodedBytes = items.reduce((s, it) => s + it.w * it.h * 4, 0);
  progress('base64 → IndexedDB 저장 중 (pluginStorage 대용)…');
  const bufs = await Promise.all(blobs.map((b) => b.arrayBuffer()));
  const t1 = performance.now();
  const b64 = bufs.map(toB64);
  const db = await idb();
  await idbPut(db, 'pack', JSON.stringify(b64));
  const storeMs = performance.now() - t1;
  progress('읽기 중…');
  const t2 = performance.now();
  const back = JSON.parse(await idbGet(db, 'pack')) as string[];
  const bytesBack = back.map(fromB64);
  const readMs = performance.now() - t2;
  progress('디코딩 중…');
  const heapBefore = heap();
  const t3 = performance.now();
  let bitmaps: ImageBitmap[] = await Promise.all(bytesBack.map((u) => createImageBitmap(new Blob([u], { type: 'image/png' }))));
  const decodeMs = performance.now() - t3;
  const heapAfter = heap();
  const ua = await uaMem();
  // 층 교체 10회: 유형 팩(타일셋 + 적 절반)을 닫고 다시 디코딩
  progress('층 유형 팩 교체 10회…');
  const t4 = performance.now();
  const swapIdx = items.map((it, i) => (it.tag.startsWith('enemy') || it.tag.startsWith('tileset') ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < 10; k++) {
    for (const i of swapIdx) bitmaps[i].close();
    const fresh = await Promise.all(swapIdx.map((i) => createImageBitmap(new Blob([bytesBack[i]], { type: 'image/png' }))));
    swapIdx.forEach((i, j) => (bitmaps[i] = fresh[j]));
  }
  const swapMs = performance.now() - t4;
  for (const b of bitmaps) b.close();
  bitmaps = [];
  db.close();
  const mb = (n: number) => (n / 1048576).toFixed(1) + 'MB';
  const lines = [
    `규격 ${spec.size}px (캔버스 ${canvas}, 트리밍 ${bodyW}×${bodyH}) · 요원 ${spec.agents}×${spec.framesPerAgent}장 · 적 ${spec.enemies}×${spec.framesPerEnemy}장 · 타일셋 ${spec.tilesets}`,
    `파일 ${items.length}장 · PNG 합계 ${mb(bytes)} (노이즈라 실제 도트보다 큼) · base64 ${mb(bytes * 1.33)}`,
    `펼친(디코딩) 크기 계산값 ${mb(decodedBytes)} ← 이 숫자가 램 부담`,
    `PNG 생성 ${encodeMs.toFixed(0)}ms · 저장 ${storeMs.toFixed(0)}ms · 읽기 ${readMs.toFixed(0)}ms · 디코딩 ${decodeMs.toFixed(0)}ms · 교체 10회 ${swapMs.toFixed(0)}ms`,
    `JS 힙 ${mb(heapBefore)} → ${mb(heapAfter)} (디코딩 비트맵은 힙 밖이라 작게 나옴)${ua !== null ? ` · 브라우저 측정 메모리 ${mb(ua)}` : ' · 브라우저 메모리 API 없음(크롬 작업 관리자로 확인)'}`,
  ];
  return { lines, files: items.length, bytes, decodedBytes, encodeMs, storeMs, readMs, decodeMs, swapMs, heapBefore, heapAfter, uaMemory: ua };
}
export const DEFAULT_SPEC = (size: 128 | 96 | 80): LoadSpec => ({ size, agents: 2, framesPerAgent: 190, enemies: 8, framesPerEnemy: 40, tilesets: 5 });
