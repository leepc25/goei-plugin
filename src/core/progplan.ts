// 이 턴에 돌 단계 계획 (core/progress.ts 가 그린다). 본편 요청을 조립할 때 설정만 보고 미리 깐다 — 턴 중간에 칸 수가 바뀌지 않게 (11-09 사용자).
// 순서는 늘 같다: 라우터 → 디렉터 → 본편 → 갱신기(인물 기록·이미지 태그 보충·위키) → 인터넷(통합·사이트별·쇼핑몰).
import type { Chat, LoreEntry } from './types';
import { peopleSettings } from './people/settings';
import { peopleStore } from './people/store';
import { basicSettings } from './settings';
import { jointGroups, JOINT_LABEL } from './netjoint';
import { viewSettings } from './phoneView';
import { wikiSettings } from './wiki';
import { MALL_NAME, MALL_SITES, mallSettings } from './malls';
import { MAIN_STAGE, type Stage } from './progress';

export function turnPlan(char: { globalLore?: LoreEntry[] }, chat: Chat): Stage[] {
  const ss = chat.scriptstate;
  const out: Stage[] = [];
  const pp = peopleSettings(ss);
  let hasPeople = false;
  try {
    hasPeople = Object.keys(peopleStore(chat).people).length > 0;
  } catch {
    hasPeople = false;
  }
  // 라우터·디렉터는 본편 앞 (body.ts withPeople): 인물 기록이 켜져 있고 본편에 넣으며 기록된 인물이 있을 때만 부른다
  if (pp.on && pp.inject !== 'off' && hasPeople) {
    if (pp.router === 'model') out.push({ id: 'router', label: '라우터', group: 'router', match: ['라우터'] });
    if (pp.director === 'scene' || pp.director === 'facts') out.push({ id: 'director', label: '디렉터', group: 'director', match: ['디렉터'] });
  }
  out.push(MAIN_STAGE);
  // 응답 뒤: 인물 기록 갱신(갱신기·정리), 보조 모델 이미지 태그 보충, 위키 자동 작성
  if (pp.on && pp.when === 'turn') out.push({ id: 'update', label: '갱신기', group: 'update', match: ['갱신기', '정리'] });
  const basic = basicSettings(char.globalLore, ss);
  if (basic.assetOn && basic.assetModel === 'aux') out.push({ id: 'asset', label: '이미지 태그', group: 'update', match: ['이미지 태그'] });
  if (wikiSettings(ss).auto === 'turn') out.push({ id: 'wiki', label: '위키', group: 'update', match: ['위키'] });
  // 인터넷 자동 호출: 같은 모델끼리 한 요청 (core/netjoint.ts). 묶음은 「통합」 한 칸, 혼자면 그 이름
  // 칸 이름은 자동 호출의 실제 이름과 똑같이 (괴담톡은 「괴담톡 확인」): 단추로 보낸 「괴담톡 답장」이 이 칸에 붙지 않게
  const autoLabel = (k: string, l: string) => (k === 'phone' ? '괴담톡 확인' : l);
  for (const group of jointGroups(ss)) {
    const labels = group.map((t) => JOINT_LABEL[t.kind]);
    const calls = group.map((t) => autoLabel(t.kind, JOINT_LABEL[t.kind]));
    if (group.length > 1) out.push({ id: `joint:${group.map((t) => t.kind).join('+')}`, label: '통합', group: 'net', note: labels.join(' · '), match: [`${labels.join('+')} 통합`, ...calls] });
    else out.push({ id: `net:${group[0].kind}`, label: labels[0], group: 'net', match: calls });
  }
  if (viewSettings(ss).auto === 'turn') out.push({ id: 'view', label: '관전', group: 'net', match: ['관전'] });
  for (const site of MALL_SITES) {
    const m = mallSettings(ss, site);
    if (m.on && m.auto === 'turn' && (site !== 'bm' || String(ss?.['$br_login'] ?? '') === '1')) out.push({ id: `mall:${site}`, label: MALL_NAME[site], group: 'net', match: [`${MALL_NAME[site]} 진열`] });
  }
  return out;
}
