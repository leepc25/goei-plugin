// 게임 그림 팩 묶기: game-pack/<id>/의 PNG와 atlas.json을 파일 하나(.pack)로 묶는다.
// 모양: "GOEIPACK" + 머리 길이(uint32 LE) + 머리 JSON {id, version, atlas, files:[[이름, 시작, 길이]]} + PNG 바이트를 이어 붙인 것.
// 한 번에 받을 수 있게(웹 Risu 프록시는 요청당 약 1MB) base64 없이 바이트 그대로 둔다. src/host/gamepack.ts가 읽는다.
import { readFileSync, readdirSync } from 'node:fs';

export function buildPack(dir, id, version) {
  const names = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const atlas = JSON.parse(readFileSync(`${dir}/atlas.json`, 'utf8'));
  const bufs = names.map((n) => readFileSync(`${dir}/${n}`));
  let at = 0;
  const files = names.map((n, i) => {
    const row = [n.replace(/\.png$/, ''), at, bufs[i].length];
    at += bufs[i].length;
    return row;
  });
  const head = Buffer.from(JSON.stringify({ id, version, atlas, files }), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length);
  return Buffer.concat([Buffer.from('GOEIPACK'), len, head, ...bufs]);
}
