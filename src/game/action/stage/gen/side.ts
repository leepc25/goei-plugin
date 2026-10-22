// 곁가지 방 (기본기획서 8.2 「곁가지: 층당 1~2, 끝에 보상」). 문 하나 = 방 하나, 씨앗·깊이·문 id로 정해진다.
// 보통 방: 그 층 적 한 판 + 선배가 남긴 배낭(강화 선택). 숨은 방(금 간 벽·막힌 덕트): 싸움 없이 배낭 + 회수물 + 보급품, 가끔 정예 하나.
import { FLOOR_TYPES } from '../data/floortypes';
import { mix, pick, rng } from '../rng';
import type { Floor, SideRoom } from '../types';

const hashId = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export function makeSide(seed: number, f: Floor, door: string, secret: boolean, label: string): SideRoom {
  const r = rng(mix(seed, f.depth, hashId(door), secret ? 2 : 1, 6161));
  const pool = FLOOR_TYPES[f.type].enemies.length ? FLOOR_TYPES[f.type].enemies : FLOOR_TYPES.lobby.enemies;
  const n = secret ? (r() < 0.35 ? 1 : 0) : f.depth <= 1 ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * Math.min(3, 1 + f.depth / 3));
  const fight = Array.from({ length: n }, () => pick(r, pool).kind);
  const loot: SideRoom['loot'] = [{ kind: 'chest', x: 1000 }];
  if (secret) loot.push({ kind: 'gear', x: 720 }, { kind: 'item', x: 560, item: pick(r, ['heal', 'guard', 'light']) });
  else if (r() < 0.5) loot.push({ kind: 'item', x: 620, item: pick(r, ['heal', 'ammo', 'light']) });
  return { depth: f.depth, door, secret, label: secret ? `숨은 방` : label, loot, fight, elite: secret || f.depth >= 6, palette: f.palette };
}
