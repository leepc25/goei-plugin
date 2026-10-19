// 게임 그림은 플러그인에 넣지 않고 게임 팩(game-pack/patrol)으로 따로 받는다. 여기는 팩의 모양만 정한다.
import type { AgentId, BackId, EnemyId } from './data';

/** 팩 모양이 바뀌면 올린다. 받아 둔 팩과 다르면 다시 받게 한다 */
export const PACK_VERSION = 1;
export const PACK_ID = 'patrol';

/** 프레임: [x, y, w, h, 발 기준 x, 발 기준 y, 몸 높이] */
export type Frame = [number, number, number, number, number, number, number] | null;

export interface ActionAtlas {
  profile?: string;
  nativeHeight?: number;
  displayHeight?: number;
  source?: string;
  frames: Frame[];
  clips: Record<string, number[]>;
  scale: number;
  contacts?: [number, number][][];
  frameTimes?: Record<string, number[]>;
}
export type Atlas = Record<AgentId | EnemyId, Frame[]> & { action?: ActionAtlas };

/** 팩 안의 그림 파일 이름 (확장자 .png) */
export const SHEET_FILES: Record<AgentId | EnemyId, string> = {
  jyaldi: 'a-jyaldi',
  gorgo: 'a-gorgo',
  geshu: 'a-geshu',
  deadfall: 'a-deadfall',
  spandal: 'a-spandal',
  eileen: 'a-eileen',
  curas: 'a-curas',
  rose: 'a-rose',
  corner: 'e-corner',
  watchman: 'e-watchman',
  statue: 'e-statue',
  master: 'e-master',
};
export const BACK_FILES: Record<BackId, string> = {
  'belt-school': 'bg-belt-school',
  'room-classroom': 'bg-room-classroom',
  'room-lab': 'bg-room-lab',
  'room-broadcast': 'bg-room-broadcast',
  'room-courtyard': 'bg-room-courtyard',
  'belt-camp': 'bg-belt-camp',
};
export const FACE_FILE = 'faces';

/** 팩에 든 파일 이름 전부 */
export const PACK_FILES = [...Object.values(SHEET_FILES), ...Object.values(BACK_FILES), FACE_FILE];

/** 게임이 받는 그림: 파일 이름 → 이미지 주소(data:·blob: 등)와 아틀라스 */
export interface GameArt {
  atlas: Atlas;
  url: (file: string) => string;
}

/** 팩 파일 이름 (release 폴더) */
export const PACK_NAME = `goei-game-${PACK_ID}.pack`;

export interface ParsedPack {
  id: string;
  version: number;
  atlas: Atlas;
  files: Map<string, Uint8Array>;
}

/** scripts/game-pack.mjs가 묶은 팩을 푼다. 모양이 틀리면 null */
export function parsePack(b: Uint8Array, required: readonly string[] = PACK_FILES): ParsedPack | null {
  try {
    if (b.length < 12 || new TextDecoder().decode(b.subarray(0, 8)) !== 'GOEIPACK') return null;
    const len = b[8] | (b[9] << 8) | (b[10] << 16) | (b[11] << 24);
    const head = JSON.parse(new TextDecoder().decode(b.subarray(12, 12 + len))) as {
      id: unknown;
      version: unknown;
      atlas: unknown;
      files: unknown;
    };
    if (
      typeof head.id !== 'string' ||
      typeof head.version !== 'number' ||
      !head.atlas ||
      !Array.isArray(head.files)
    )
      return null;
    const base = 12 + len;
    const files = new Map<string, Uint8Array>();
    for (const row of head.files as unknown[]) {
      if (!Array.isArray(row)) return null;
      const [name, at, n] = row as [unknown, unknown, unknown];
      if (
        typeof name !== 'string' ||
        typeof at !== 'number' ||
        typeof n !== 'number' ||
        base + at + n > b.length
      )
        return null;
      files.set(name, b.slice(base + at, base + at + n));
    }
    if (!required.every((f) => files.has(f))) return null;
    return { id: head.id, version: head.version, atlas: head.atlas as Atlas, files };
  } catch {
    return null;
  }
}
