// 게임 자산 팩 묶기. 모양: "GOEIPACK" + 머리 길이(uint32 LE) + 머리 JSON + 파일 바이트를 이어 붙인 것.
// 한 번에 받을 수 있게(웹 Risu 프록시는 요청당 약 1MB) base64 없이 바이트 그대로 둔다.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// 새 게임 자산 팩 (src/host/game/packs.ts가 읽는다): game-pack/<폴더>/pack.json {"id", "required"}이 있는 폴더의 모든 파일.
// atlas.json은 머리의 atlas로, 나머지는 확장자를 붙인 이름 그대로 담는다. hash는 내용 지문(바뀐 팩만 다시 받게).
export function buildGamePack(dir) {
  const spec = JSON.parse(readFileSync(`${dir}/pack.json`, 'utf8'));
  const names = readdirSync(dir).filter((f) => f !== 'pack.json' && f !== 'atlas.json' && !f.startsWith('.') && !f.endsWith('.md')).sort();
  const atlas = names.length && readdirSync(dir).includes('atlas.json') ? JSON.parse(readFileSync(`${dir}/atlas.json`, 'utf8')) : null;
  const bufs = names.map((n) => readFileSync(`${dir}/${n}`));
  const h = createHash('sha256');
  h.update(JSON.stringify(atlas));
  names.forEach((n, i) => h.update(n).update(bufs[i]));
  const hash = h.digest('hex').slice(0, 16);
  let at = 0;
  const files = names.map((n, i) => {
    const row = [n, at, bufs[i].length];
    at += bufs[i].length;
    return row;
  });
  const head = Buffer.from(JSON.stringify({ id: spec.id, version: 1, hash, atlas, files }), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length);
  return { id: spec.id, required: spec.required !== false, hash, bytes: Buffer.concat([Buffer.from('GOEIPACK'), len, head, ...bufs]) };
}
