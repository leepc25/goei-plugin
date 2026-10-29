// 자료 팩 (QC 개선 나1, docs/qc/09_개선_나_1.md): 세계 자료·설치 자료는 본체에 번들하지 않고 release 폴더의 팩
// (goei-data-world.json + goei-data-world.N.txt, goei-data-install.*) 으로 받는다. 빌드(scripts/build.mjs)가 팩마다 지문을 여기 박아 두어
// 본체는 자기와 맞는 자료만 쓴다 (판이 다르면 다시 받음). 받기·저장은 host/datapack.ts, 여기는 순수 계산(지문 비교·형식 검사·넣기).
import { setInstallData } from './install';
import { textHash } from './texthash';
import { setWorldData } from './world/records';

/** 빌드가 박아 둔 팩 지문: hash(UTF-16 FNV-1a) · sha256(UTF-8) · length(JS 글자 수). scripts/data-pack.mjs packOf 와 같은 모양 */
export interface PackExpect {
  hash: string;
  sha256: string;
  length: number;
}
export interface PackSpec {
  /** 파일 이름 줄기 (goei-data-world → goei-data-world.json · goei-data-world.N.txt) */
  name: string;
  /** 화면·오류 글에 쓰는 이름 */
  label: string;
  expect: PackExpect;
}

declare const __WORLD_PACK__: string | undefined;
declare const __INSTALL_PACK__: string | undefined;

function expectOf(raw: unknown): PackExpect {
  try {
    const o = typeof raw === 'string' ? (JSON.parse(raw) as Partial<PackExpect>) : null;
    if (o && typeof o.hash === 'string' && typeof o.sha256 === 'string' && typeof o.length === 'number') return { hash: o.hash, sha256: o.sha256, length: o.length };
  } catch {
    // 아래 빈 지문
  }
  return { hash: '', sha256: '', length: 0 };
}

export const WORLD_PACK: PackSpec = { name: 'goei-data-world', label: '세계 자료', expect: expectOf(typeof __WORLD_PACK__ === 'string' ? __WORLD_PACK__ : undefined) };
export const INSTALL_PACK: PackSpec = { name: 'goei-data-install', label: '설치 자료', expect: expectOf(typeof __INSTALL_PACK__ === 'string' ? __INSTALL_PACK__ : undefined) };

/** 저장소에서 읽은 글이 이 본체의 팩인가: 길이와 FNV 지문(동기, 880KB 에 수 ms). 지문이 비어 있는 빌드는 어떤 글도 맞지 않는다(늘 다시 받음) */
export function packMatches(text: string, expect: PackExpect): boolean {
  return !!expect.hash && text.length === expect.length && textHash(text) === expect.hash;
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 세계 자료 팩 글을 풀어 records.ts 에 넣는다. 형식이 다르면 던진다 */
export function applyWorldPack(text: string): void {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('세계 자료 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'world') throw new Error('세계 자료 팩 형식이 달라요 (schema·kind).');
  for (const k of ['agent', 'org', 'anomaly', 'site', 'appendix']) if (!obj(j[k])) throw new Error(`세계 자료 팩 형식이 달라요 (${k}).`);
  const rel = j.relations;
  if (!obj(rel) || !obj(rel.pairs) || typeof rel.common !== 'string') throw new Error('세계 자료 팩 형식이 달라요 (relations).');
  setWorldData({
    agent: j.agent as never,
    org: j.org as never,
    anomaly: j.anomaly as never,
    site: j.site as never,
    appendix: j.appendix as never,
    relations: { pairs: rel.pairs as never, common: rel.common },
  });
}

/** 설치 자료 팩 글을 풀어 install.ts 에 넣는다. 형식이 다르면 던진다 */
export function applyInstallPack(text: string): void {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('설치 자료 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'install') throw new Error('설치 자료 팩 형식이 달라요 (schema·kind).');
  const g = j.greetings;
  if (!obj(g) || !obj(g.index) || !Array.isArray(g.texts)) throw new Error('설치 자료 팩 형식이 달라요 (greetings).');
  if (!Array.isArray(j.pictures)) throw new Error('설치 자료 팩 형식이 달라요 (pictures).');
  if (!obj(j.directory)) throw new Error('설치 자료 팩 형식이 달라요 (directory).');
  if (!obj(j.icon)) throw new Error('설치 자료 팩 형식이 달라요 (icon).');
  setInstallData({ greetings: { index: g.index as never, texts: g.texts.map(String) }, pictures: j.pictures as never, directory: j.directory, icon: j.icon as never });
}
