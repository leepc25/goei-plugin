// 본부 화면: 옆으로 걷는 본부(회색 상자) + 장소 창 + 브리핑 + 정산 + Esc 메뉴(보관함·저장 슬롯).
// 엔진은 createHq()로 HqModule을 받아 mount(root, host)하고, 출동이 끝나면 onReturn(result, launch)를 부른다.
import css from './style.css';
import type { AgentId, MissionLaunch, RunResult } from './contract';
import { AGENTS, AGENT_BY_ID, COFFEES, HQ_WIDTH, MISSION_BY_ID, PLACES, PLACE_BY_ID, RELICS, RESEARCH, SURVIVORS, type PlaceDef, type PlaceId } from './data';
import { lines, type Line, type LineCtx } from './lines';
import { boardNames, reportPayload, rosterFor, type CardView, type MainLink } from './link';
import {
  appraise, approveDanger, buy, canDeploy, doResearch, equip, equipRelic, interview, launch, masteryLevel, masteryNext, missionBoard, noteDeadlines, openToothBox,
  pickCoffee, placeOpen, researchOpen, saveTitle, setDanger, settle, statsFor, supplyCatalog, supplyOpen, treat, unequip, unlocksAt, variantFor, itemName, DANGER_COST, TOOTH_COST, TREAT_COST, type MissionCard,
} from './logic';
import { iconCanvas } from './runmenu';
import { hqMap, type HqMapView } from './map';
import photos from '../story/demo-photos.json';
import { ensureKit } from '../ui';
import { HQ_SCHEMA, newSave, parseSave, saveText, type HqSave } from './state';
import type { SaveSlots } from './store';

export interface HqHost {
  /** 출동 시작. 엔진이 전투 장면으로 넘어간다 (본부 화면은 숨겨진다) */
  deploy(l: MissionLaunch): void;
  /** 자동 저장 (슬롯 0) */
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
  /** 수동 저장 슬롯 1~3 (bridge.saves). 없으면 Esc 메뉴에 슬롯이 안 보인다 */
  saves?: SaveSlots;
  link?: MainLink;
  rand?: () => number;
  /** 메뉴 창을 다 닫으면 (엔진이 걷기를 다시 켠다) */
  closed?(): void;
  /** Esc 메뉴의 「장소로 가기」: 엔진이 쟈알디를 그 장소 문 앞으로 옮긴다 */
  goto?(id: PlaceId): void;
}
/** 엔진이 본부 벨트 장면을 그릴 때 쓰는 장소 정보 (열림 판정은 본부가 한다) */
export interface HqPlaceView {
  id: PlaceId;
  name: string;
  floor: string;
  x: number;
  w: number;
  npc: string | null;
  color: string;
  open: boolean;
  /** 잠겨 있을 때 여는 조건 */
  opens: string;
}
export interface HqModule {
  /** walk:false = 엔진이 본부를 걷는 벨트 장면으로 그리고, root에는 메뉴 창만 띄운다 (게임_통합_규격 4장) */
  mount(root: HTMLElement, host: HqHost, opt?: { walk?: boolean }): void;
  places(): HqPlaceView[];
  /** 그 장소 메뉴 창 (엔진: 문 앞에서 E) */
  openPlace(id: PlaceId): void;
  /** Esc 본부 메뉴 (보관함·저장·장소로 가기) */
  openMenu(): void;
  /** 메뉴 창이 열려 있나 (열려 있는 동안 엔진은 걷기를 멈춘다) */
  isOpen(): boolean;
  /** 열린 창을 하나 닫는다 (엔진: Esc) */
  close(): void;
  onReturn(result: RunResult, launch: MissionLaunch): void;
  unmount(): void;
  /** 본부 건물 지도 (docs/본부_평면도.md): 장면·문·엘리베이터·자리. 엔진이 장면을 그리고 자리 앞 E → openPlace(spot.place) */
  map(): HqMapView;
  /** 자리 주인 목소리 한 줄 (가까이 가면 말풍선). 사람 그림은 아직 없으니 목소리로만 */
  bark(place: PlaceId): Line | null;
  /** 시험용 */
  readonly state: HqSave;
}

const PHOTO_KEY: Record<string, string> = { 잼트리: 'Jaemtri', 부장: 'Jyaldi', 쟈알디: 'Jyaldi', 에일린: 'Aileen', 콘쥬스: 'Konjyuce', 데쥬레: 'Dejure', 고그니쟈: 'Gognija' };
const photoOf = (who: string) => (photos as Record<string, string>)[PHOTO_KEY[who] ?? ''] ?? '';

const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const VW = 1280,
  VH = 400,
  FLOOR_Y = 330;
const depthText = (d: number) => (d ? (d <= 3 ? `L${d}` : `B-${d - 3}`) : '—');

export function createHq(): HqModule {
  let s: HqSave = newSave();
  let host: HqHost | null = null;
  let root: HTMLElement | null = null;
  let wrap: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let raf = 0;
  let last = 0;
  let card: CardView | null = null;
  let panel: PlaceId | null = null;
  let overlay: null | 'brief' | 'settle' | 'menu' = null;
  let notice = '';
  let bark: { who: string; text: string; t: number; x: number } | null = null;
  let barkPlace: PlaceId | null = null;
  let moving = 0;
  let pending: MissionLaunch | null = null;
  let cards: MissionCard[] = [];
  let selMission: string | null = null;
  let slotList: { slot: number; title: string; summary: string; savedAt: number }[] = [];
  let pickSlot = 0;
  let walk = true;
  const rand = () => (host?.rand ?? Math.random)();
  const keys = new Set<string>();
  // 쉬는 요원 위치 (사무실·탕비실을 오간다)
  const idlers: Record<string, { x: number; to: number; wait: number }> = {};

  const ctx = (): LineCtx => ({ agent: s.selected, agentName: AGENT_BY_ID[s.selected].name, fatigue: s.agents[s.selected].fatigue, day: s.day, rand });
  const save = () => host?.save(saveText(s)).catch(() => {});
  const placeAt = (x: number): PlaceDef | null => PLACES.find((p) => x >= p.x && x < p.x + p.w) ?? null;

  // ── 그리기 ──
  const draw = (dt: number) => {
    if (!canvas) return;
    const c = canvas.getContext('2d')!;
    const cam = Math.max(0, Math.min(HQ_WIDTH - VW, s.x - VW / 2));
    c.fillStyle = '#0b0f13';
    c.fillRect(0, 0, VW, VH);
    c.save();
    c.translate(-cam, 0);
    // 층 구분: 지상 / 지하 (계단)
    for (const p of PLACES) {
      const open = placeOpen(s, p.id);
      c.fillStyle = open ? p.color : '#15191d';
      c.fillRect(p.x, 40, p.w, FLOOR_Y - 40);
      c.strokeStyle = open ? '#6b7d86' : '#2a3036';
      c.lineWidth = 2;
      c.strokeRect(p.x + 1, 41, p.w - 2, FLOOR_Y - 42);
      c.fillStyle = open ? '#e8e2c8' : '#59626a';
      c.font = '20px sans-serif';
      c.textAlign = 'center';
      c.fillText(p.name, p.x + p.w / 2, 72);
      c.font = '14px sans-serif';
      c.fillStyle = open ? '#9fb2ba' : '#59626a';
      c.fillText(open ? p.floor : `잠김 · ${p.opens}`, p.x + p.w / 2, 94);
      if (open && p.npc && p.id !== 'office') {
        c.fillStyle = '#c8b27a';
        c.fillRect(p.x + p.w * 0.75 - 22, FLOOR_Y - 120, 44, 120);
        c.fillStyle = '#1a1a1a';
        c.font = '13px sans-serif';
        c.fillStyle = '#c8b27a';
        c.fillText(p.npc, p.x + p.w * 0.75, FLOOR_Y - 128);
      }
      // 사무실 장식 (이빨 상자 잡동사니)
      if (p.id === 'office' && s.decor.length) {
        c.fillStyle = '#8a7a5a';
        s.decor.slice(0, 6).forEach((_, i) => c.fillRect(p.x + 30 + i * 60, FLOOR_Y - 150, 26, 18));
      }
      if (p.id === 'gallery' && open) {
        c.fillStyle = '#4a6a7a';
        s.missionsDone.forEach((_, i) => c.fillRect(p.x + 20 + (i % 6) * 46, FLOOR_Y - 160 + Math.floor(i / 6) * 50, 34, 34));
      }
    }
    // 바닥
    c.fillStyle = '#20262b';
    c.fillRect(0, FLOOR_Y, HQ_WIDTH, VH - FLOOR_Y);
    c.fillStyle = '#556';
    c.fillRect(PLACE_BY_ID.training.x - 40, FLOOR_Y - 200, 20, 200);
    c.fillStyle = '#9ab';
    c.font = '12px sans-serif';
    c.fillText('계단 ↓ 지하', PLACE_BY_ID.training.x - 30, FLOOR_Y - 208);
    // 쉬는 요원들
    for (const a of AGENTS) {
      if (a.id === s.selected) continue;
      const it = (idlers[a.id] ??= { x: PLACE_BY_ID.office.x + 260, to: PLACE_BY_ID.office.x + 260, wait: 2 });
      it.wait -= dt;
      if (it.wait <= 0 && Math.abs(it.x - it.to) < 2) {
        const spots = [PLACE_BY_ID.office.x + 80, PLACE_BY_ID.office.x + 300, PLACE_BY_ID.pantry.x + 120];
        it.to = spots[Math.floor(rand() * spots.length)];
        it.wait = 4 + rand() * 6;
      }
      it.x += Math.sign(it.to - it.x) * Math.min(Math.abs(it.to - it.x), 60 * dt);
      const rec = s.agents[a.id];
      c.fillStyle = a.color + (rec.injured ? '66' : 'aa');
      c.fillRect(it.x - 20, FLOOR_Y - 104, 40, 104);
      c.fillStyle = '#ddd';
      c.font = '13px sans-serif';
      c.fillText(`${a.name}${rec.injured ? ' (부상)' : rec.fatigue >= 2 ? ' (피곤)' : ''}`, it.x, FLOOR_Y - 112);
    }
    // 나
    const me = AGENT_BY_ID[s.selected];
    c.fillStyle = me.color;
    c.fillRect(s.x - 22, FLOOR_Y - 112, 44, 112);
    c.fillStyle = '#fff';
    c.font = 'bold 14px sans-serif';
    c.fillText(me.name, s.x, FLOOR_Y - 120);
    const here = placeAt(s.x);
    if (here && placeOpen(s, here.id)) {
      c.fillStyle = '#ffd080';
      c.font = 'bold 16px sans-serif';
      c.fillText('E 들어가기', s.x, FLOOR_Y + 34);
    }
    // 말풍선 (위에)
    if (bark && bark.t > 0) {
      bark.t -= dt;
      c.font = '15px sans-serif';
      const text = `${bark.who}: ${bark.text}`;
      const w = Math.min(560, c.measureText(text).width + 24);
      const bx = Math.max(cam + 8, Math.min(cam + VW - w - 8, bark.x - w / 2));
      c.fillStyle = '#f2ecd8';
      c.fillRect(bx, 110, w, 34);
      c.fillStyle = '#1a1a1a';
      c.textAlign = 'left';
      c.fillText(text.length > 44 ? text.slice(0, 43) + '…' : text, bx + 12, 133);
    }
    c.restore();
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (!wrap || wrap.hidden) return;
    const dir = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0) || moving;
    if (dir && !overlay) {
      s.x = Math.max(20, Math.min(HQ_WIDTH - 20, s.x + dir * 320 * dt));
      const p = placeAt(s.x);
      if (p && p.id !== barkPlace && placeOpen(s, p.id)) {
        barkPlace = p.id;
        const l = lines(`npc:${p.id}`, ctx())[0];
        if (l) bark = { ...l, t: 4, x: p.x + p.w / 2 };
      }
    }
    draw(dt);
  };

  // ── 창 내용 ──
  const top = () => `<div class="hq-top"><b>본부 · ${s.day}일차</b><span>예산 ${s.currencies.budget}</span><span>연구 자료 ${s.currencies.research}</span><span>이빨 ${s.currencies.teeth}</span><span>규칙서 ${s.rulebook.length}줄</span><span>최저 ${depthText(s.deepest)}</span><button data-act="menu">Esc 메뉴</button></div>
<nav class="hq-places">${PLACES.filter((p) => placeOpen(s, p.id)).map((p) => `<button data-go="${p.id}" class="${panel === p.id ? 'sel' : ''}">${esc(p.name)}</button>`).join('')}</nav>`;
  const agentCard = (id: AgentId, mode: 'pick' | 'support') => {
    const a = AGENT_BY_ID[id];
    const rec = s.agents[id];
    const lv = masteryLevel(rec.xp);
    const nx = masteryNext(rec.xp);
    const can = canDeploy(s, id);
    const ros = rosterFor(card, id);
    const photo = ros?.photo && /^(data:|https?:|blob:)/.test(ros.photo) ? `<img src="${esc(ros.photo)}" alt="">` : `<i style="background:${a.color}"></i>`;
    const sel = mode === 'pick' ? s.selected === id : s.support === id;
    return `<button class="hq-agent${sel ? ' sel' : ''}" data-${mode}="${id}" ${mode === 'support' && id === s.selected ? 'disabled' : ''}>${photo}<span><b>${esc(ros?.name ?? a.name)}</b> · ${esc(a.weapon)}<br>숙련 ${lv}${nx ? ` (${rec.xp}/${nx})` : ' (최고)'} · 출동 ${rec.runs}회 · 최저 ${depthText(rec.deepest)}<br>${rec.injured ? `<em>부상 ${rec.injured}일</em>` : rec.fatigue ? `피로 ${rec.fatigue}` : '컨디션 좋음'}</span></button>`;
  };
  const slotHtml = (i: number) => {
    const x = s.loadout[i];
    return `<div class="hq-slotrow"><b>${i + 1}</b><span data-icon="${x?.id ?? ''}"></span><span>${x ? `${esc(itemName(x.id))} ×${x.n}` : '빈 칸'}</span>${x ? `<button data-unequip="${i}">빼기</button>` : ''}</div>`;
  };
  const stashHtml = () => {
    const ids = Object.entries(s.stash).filter(([, n]) => n > 0);
    return ids.length ? ids.map(([id, n]) => `<div class="hq-stash"><span data-icon="${id}"></span>${esc(itemName(id))} ×${n} ${[0, 1, 2, 3].map((i) => `<button data-equip="${id}" data-slot="${i}">${i + 1}번 칸</button>`).join('')}</div>`).join('') : '<p>보관함이 비었어요.</p>';
  };
  const placeHtml = (id: PlaceId): string => {
    const npc = lines(`npc:${id}`, ctx()).map((l) => `<p class="hq-say"><b>${esc(l.who)}</b> ${esc(l.text)}</p>`).join('');
    const P = PLACE_BY_ID[id];
    const head = `<h2>${esc(P.name)}</h2>${npc}`;
    switch (id) {
      case 'office':
        return `${head}<h3>출동 요원</h3><div class="hq-agents">${AGENTS.map((a) => agentCard(a.id, 'pick')).join('')}</div><h3>지원 요원 (C, 필살 게이지 절반)</h3><div class="hq-agents">${AGENTS.map((a) => agentCard(a.id, 'support')).join('')}<button data-support="none" class="${s.support ? '' : 'sel'}">지원 없음</button></div>
<h3>숙련 단계</h3><p>${unlocksAt(masteryLevel(s.agents[s.selected].xp)).length ? unlocksAt(masteryLevel(s.agents[s.selected].xp)).join(' · ') : '숙련 2부터 열려요'} — 새 동작은 숙련 3·6에서만.</p>`;
      case 'jaemtri': {
        cards = missionBoard(s, boardNames(card));
        noteDeadlines(s, cards);
        if (!selMission || !cards.some((c) => c.def.id === selMission)) selMission = cards[0]?.def.id ?? null;
        return `${head}<h3>임무 게시판</h3><div class="hq-cards">${cards
          .map((c) => `<button class="hq-mission${selMission === c.def.id ? ' on' : ''}" data-mission="${c.def.id}"><b>${esc(c.def.kind)}</b> ${esc(c.def.title)}<br><small>차원 승강기 · ${esc(c.def.depthLabel)} · 보상 예산 ${c.def.reward.budget}${c.def.reward.teeth ? ` · 이빨 ${c.def.reward.teeth}` : ''}${c.def.reward.research ? ` · 연구 ${c.def.reward.research}` : ''}${c.left !== undefined ? ` · <em>구조 마감 출동 ${c.left}회</em>` : ''}${c.done ? ' · 다시 하기' : ''}${c.linked ? ` · <em>본편 연계: ${esc(c.linked)}</em>` : ''}</small></button>`)
          .join('')}</div><div class="hq-row"><button class="primary" data-act="brief" ${selMission ? '' : 'disabled'}>브리핑 받기</button></div>
<h3>규칙서 ${s.rulebook.length}줄</h3><p class="hq-dim">${s.rulebook.length ? s.rulebook.map(esc).join(' · ') : '아직 없음. 표지를 읽고 송신하면 채워져요.'}</p>`;
      }
      case 'chief':
        return `${head}<p>위험 단계: 지금 ${s.danger} / 결재된 최대 ${s.maxDanger}. 단계마다 적이 강해지고 보상이 오른다.</p><div class="hq-row">${Array.from({ length: s.maxDanger + 1 }, (_, i) => `<button data-danger="${i}" class="${s.danger === i ? 'sel' : ''}">단계 ${i}</button>`).join('')}</div><div class="hq-row"><button data-act="approve">위험 단계 ${s.maxDanger + 1} 결재 (예산 ${DANGER_COST(s.maxDanger + 1)})</button></div>`;
      case 'supply':
        return `${head}<h3>출동 아이템 4칸</h3>${[0, 1, 2, 3].map(slotHtml).join('')}<h3>보관함</h3>${stashHtml()}
<h3>보급품 (예산)</h3><div class="hq-buy">${supplyCatalog()
          .map((d) => `<button data-buy="${d.id}" ${supplyOpen(s, d) ? '' : 'disabled'}><span data-icon="${d.id}"></span>${esc(d.name)} · ${d.price}<br><small>${supplyOpen(s, d) ? esc(d.desc) : '연구 「진압 장비 보급 승인」 필요'}</small></button>`)
          .join('')}</div>
<h3>유물 2칸</h3>${[0, 1].map((i) => `<div class="hq-slotrow"><b>유물 ${i + 1}</b> <span>${s.relics[i] ? esc(RELICS[s.relics[i]!].name) : '비어 있음'}</span> ${s.relicsOwned.map((r) => `<button data-relic="${r}" data-slot="${i}">${esc(RELICS[r].name)}</button>`).join('')}${s.relics[i] ? `<button data-relic="" data-slot="${i}">빼기</button>` : ''}</div>`).join('')}${s.relicsOwned.length ? '' : '<p class="hq-dim">유물은 격리 연구실에서 연구로 얻어요.</p>'}`;
      case 'pantry':
        return `${head}<h3>출동 전 커피 한 잔 (다음 출동 1회)</h3><div class="hq-row">${COFFEES.map((c) => `<button data-coffee="${c.id}" class="${s.coffee === c.id ? 'sel' : ''}">${esc(c.name)}<br><small>${esc(c.effect)}${c.who ? ` · ${esc(c.who)}` : ''}</small></button>`).join('')}</div>`;
      case 'clinic':
        return `${head}${AGENTS.map((a) => `<div class="hq-slotrow"><b>${esc(a.name)}</b> <span>${s.agents[a.id].injured ? `부상 · ${s.agents[a.id].injured}일 휴식 필요` : `건강 · 피로 ${s.agents[a.id].fatigue}`}</span>${s.agents[a.id].injured ? `<button data-treat="${a.id}">치료 (예산 ${TREAT_COST})</button>` : ''}</div>`).join('')}<p class="hq-dim">피로는 연속 출동마다 쌓이고(시작 체력 -6%씩) 하루 쉬면 풀린다. 부상은 후송될 때 생긴다.</p>`;
      case 'interview':
        return `${head}${s.rescued.length ? s.rescued.map((w) => `<div class="hq-slotrow"><b>${esc(SURVIVORS[w]?.name ?? w)}</b><button data-interview="${w}">${s.interviewed.includes(w) ? '다시 듣기' : '면담'}</button></div>`).join('') : '<p>아직 구조한 사람이 없어요.</p>'}`;
      case 'training':
        return `${head}<p>최다 층 ${s.records.bestFloors} · 최다 처치 ${s.records.bestKills} · 최단 귀환 ${s.records.fastestReturn ? `${s.records.fastestReturn}초` : '—'} · 최저 ${depthText(s.deepest)}</p>${AGENTS.map((a) => `<p>${esc(a.name)}: 출동 ${s.agents[a.id].runs}회 · 최저 ${depthText(s.agents[a.id].deepest)}</p>`).join('')}<p class="hq-dim">허수아비 연습은 전투 모듈이 들어오면 여기서 시작한다.</p>`;
      case 'appraisal':
        return `${head}<p>감정 대기: ${s.appraisal.length ? s.appraisal.map((b) => esc(b?.name)).join(', ') : '없음'}</p><div class="hq-row"><button data-act="appraise" ${s.appraisal.length ? '' : 'disabled'}>감정하기</button></div>`;
      case 'lab':
        return `${head}<div class="hq-cards">${researchOpen(s).map((r) => `<button data-research="${r.id}"><b>${esc(r.name)}</b><br><small>연구 자료 ${r.research} · 예산 ${r.budget}</small></button>`).join('') || '<p>지금 할 수 있는 연구를 다 했어요.</p>'}</div><p class="hq-dim">완료: ${s.researchDone.map((id) => esc(RESEARCH.find((r) => r.id === id)?.name)).join(' · ') || '없음'}</p>`;
      case 'tooth':
        return `${head}<div class="hq-row"><button data-act="tooth">이빨 ${TOOTH_COST}개 먹이고 상자 받기</button></div><p class="hq-dim">빼앗긴 유물: ${s.lostRelics.length ? s.lostRelics.map((r) => esc(RELICS[r].name)).join(', ') : '없음'}</p>`;
      case 'gallery':
        return `${head}<p>완료한 임무 ${s.missionsDone.length}: ${s.missionsDone.map((m) => esc(MISSION_BY_ID[m]?.title)).join(' · ')}</p><p>장식: ${s.decor.map(esc).join(', ') || '없음'}</p>`;
      default:
        return head;
    }
  };
  const briefHtml = () => {
    const m = MISSION_BY_ID[selMission!];
    const v = variantFor(pendingSeed);
    const c = { ...ctx(), mission: m.title, variantHint: v.hint, rules: s.rulebook.slice(0, 3) };
    const say = (ls: Line[]) => ls.map((l) => `<p class="hq-say"><b>${esc(l.who)}</b> ${esc(l.text)}</p>`).join('');
    const st = statsFor(s, s.selected);
    const can = canDeploy(s, s.selected);
    return `<h2>브리핑 · ${esc(m.kind)}: ${esc(m.title)}</h2>${say(lines('brief:jaemtri', c))}${say(lines('brief:chief', c))}${say(lines('brief:reply', c))}
<div class="hq-brief"><p><b>출동</b> ${esc(AGENT_BY_ID[s.selected].name)} (체력 ${st.hp}${s.agents[s.selected].fatigue ? `, 피로 ${s.agents[s.selected].fatigue}` : ''}) · 지원 ${s.support && s.support !== s.selected ? esc(AGENT_BY_ID[s.support].name) : '없음'} · 위험 단계 ${s.danger} · 커피 ${esc(COFFEES.find((x) => x.id === s.coffee)?.name ?? '없음')}</p>
<p><b>아이템</b> ${s.loadout.map((x, i) => `${i + 1}:${x ? `${esc(itemName(x.id))}×${x.n}` : '—'}`).join(' ')} · <b>유물</b> ${s.relics.filter(Boolean).map((r) => esc(RELICS[r!].name)).join(', ') || '없음'}</p>
${can.ok ? '' : `<p class="hq-warn">${esc(can.why)}</p>`}</div>
<div class="hq-row"><button class="primary" data-act="deploy" ${can.ok ? '' : 'disabled'}>출동</button><button data-go="supply">정비실 들르기</button><button data-go="pantry">탕비실 들르기</button><button data-act="close">돌아가기</button></div>`;
  };
  let pendingSeed = 0;
  let evacJust = false;
  const settleHtml = () => {
    const l = s.last!;
    const back = lines(`return:${l.how}`, ctx());
    return `<h2>정산 · ${l.how === 'evac' ? '후송' : l.how === 'withdraw' ? '철수' : '귀환'}</h2>${back.map((x) => `<p class="hq-say"><b>${esc(x.who)}</b> ${esc(x.text)}</p>`).join('')}<ul>${l.lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<div class="hq-row"><button class="primary" data-act="close">본부로</button>${host?.link ? '<button data-act="report">본편에 보고서 붙이기</button>' : ''}</div>`;
  };
  const menuHtml = () => `<h2>메뉴</h2><div class="hq-cols"><div><h3>재화</h3><p>예산 ${s.currencies.budget} · 연구 자료 ${s.currencies.research} · 이빨 ${s.currencies.teeth}<br><small>현금은 출동 안에서만 쓰고, 귀환·철수하면 절반이 예산이 된다.</small></p>
<h3>출동 아이템 4칸</h3>${[0, 1, 2, 3].map(slotHtml).join('')}<h3>보관함</h3>${stashHtml()}<h3>유물</h3><p>${s.relicsOwned.map((r) => `${esc(RELICS[r].name)} <small>${esc(RELICS[r].effect)}</small>`).join('<br>') || '없음'}</p></div>
<div><h3>요원</h3>${AGENTS.map((a) => `<p><b>${esc(a.name)}</b> 숙련 ${masteryLevel(s.agents[a.id].xp)} · 피로 ${s.agents[a.id].fatigue}${s.agents[a.id].injured ? ' · 부상' : ''}</p>`).join('')}
<h3>저장</h3><p class="hq-dim">자동 저장: 장소 이동·구매·정산 때마다. 아래는 수동 슬롯.</p>${host?.saves ? [1, 2, 3].map((n) => { const m = slotList.find((x) => x.slot === n); return `<div class="hq-slotrow"><b>슬롯 ${n}</b><span>${m ? `${esc(m.title)} · ${esc(m.summary)}` : '비어 있음'}</span><button data-saveslot="${n}">여기 저장</button>${m ? `<button data-loadslot="${n}">불러오기</button>` : ''}</div>`; }).join('') : ''}
<div class="hq-row"><button data-act="reset">처음부터 (본부 기록 지우기)</button></div></div></div>${walk ? '' : `<h3>장소로 가기</h3><div class="hq-row">${PLACES.filter((p) => placeOpen(s, p.id)).map((p) => `<button data-go="${p.id}">${esc(p.name)}</button>`).join('')}</div>`}<div class="hq-row"><button class="primary" data-act="close">닫기 (Esc)</button></div>`;

  const bar = () => `<div class="hq-bar"><b>본부 · ${s.day}일차</b><span>예산 ${s.currencies.budget}</span><span>연구 자료 ${s.currencies.research}</span><span>이빨 ${s.currencies.teeth}</span><span>규칙서 ${s.rulebook.length}줄</span><button data-act="close" class="hq-x" aria-label="닫기">닫기 (Esc)</button></div>`;
  // 잼트리 임무·브리핑: 게임 화면 위 대화창 (얼굴 + 큰 글씨 + 선택지). 폰에서도 게임이 보이게 아래쪽만 덮는다
  const talkBox = (who: string, text: string, choices: string, extra = '') => {
    const ph = photoOf(who);
    return `<div class="hq-talk gk-panel fresh" role="dialog" aria-label="${esc(who)}"><div class="hq-face gk-face">${ph ? `<img src="${ph}" alt="">` : `<i>${esc(who.slice(0, 1))}</i>`}</div><div class="hq-talk-body"><b class="hq-who gk-font">${esc(who)}</b><p class="hq-line gk-font">${esc(text)}</p>${extra}<div class="hq-choices">${choices}</div></div><button data-act="close" class="hq-x" aria-label="닫기">✕</button></div>`;
  };
  // 잼트리 말투 (선택지에는 임무 이름만, 대사에서는 되풀이하지 않는다)
  const pitch = (c: MissionCard) => {
    const d = c.def;
    switch (d.kind) {
      case '조사':
        return d.rules ? `${d.depthLabel} 쪽이에요. 규칙 ${d.rules}개만 확인하고 바로 올라오시면 돼요.` : `${d.depthLabel}까지 내려가서 보고 오시면 돼요. 무리는 마시고요.`;
      case '진압':
        return `${d.depthLabel}에서 진압 요청 들어왔어요. 이번엔 정리하고 오셔야 해요.`;
      case '구조':
        return `구조 요청이에요. 사람이 기다리고 있어요${c.left !== undefined ? `. 출동 ${c.left}번 안에 가셔야 해요` : ''}.`;
      case '회수':
        return `${d.depthLabel}에 두고 온 물건이 있대요. 들고만 오시면 돼요.`;
      default:
        return `${d.depthLabel}까지 내려가 보는 건이에요. 기록 남기는 거죠.`;
    }
  };
  const missionTalk = () => {
    cards = missionBoard(s, boardNames(card));
    noteDeadlines(s, cards);
    if (!selMission || !cards.some((c) => c.def.id === selMission)) selMission = cards[0]?.def.id ?? null;
    const say = lines('npc:jaemtri', ctx())[0];
    const sel = cards.find((c) => c.def.id === selMission);
    const text = sel ? `${pitch(sel)} 끝나면 예산 ${sel.def.reward.budget} 나와요.` : (say?.text ?? '오늘은 들어온 건이 없어요.');
    const opts = cards.slice(0, 3).map((c) => `<button class="gk-btn hq-choice${selMission === c.def.id ? ' on' : ''}" data-mission="${c.def.id}">${esc(c.def.kind)} · ${esc(c.def.short)}</button>`).join('');
    return talkBox('잼트리', text, `${opts}<div class="hq-choice-row"><button class="gk-btn hq-choice primary" data-act="brief" ${selMission ? '' : 'disabled'}>이걸로 할게요</button><button class="gk-btn hq-choice" data-act="close">나중에</button></div>`);
  };
  const briefTalk = () => {
    const m = MISSION_BY_ID[selMission!];
    const v = variantFor(pendingSeed);
    const c = { ...ctx(), mission: m.title, variantHint: v.hint, rules: s.rulebook.slice(0, 3) };
    const ls = [...lines('brief:jaemtri', c), ...lines('brief:chief', c)];
    const can = canDeploy(s, s.selected);
    const st = statsFor(s, s.selected);
    const kit = `<p class="hq-kit gk-font">${esc(AGENT_BY_ID[s.selected].name)} 체력 ${st.hp}${s.agents[s.selected].fatigue ? ` · 피로 ${s.agents[s.selected].fatigue}` : ''} · ${s.loadout.map((x) => (x ? `${esc(itemName(x.id))}×${x.n}` : '')).filter(Boolean).join(' ') || '아이템 없음'}${s.coffee ? ` · ${esc(COFFEES.find((x) => x.id === s.coffee)?.name ?? '')}` : ''}</p>${can.ok ? '' : `<p class="hq-warn">${esc(can.why)}</p>`}`;
    const j = ls.find((l) => l.who === '잼트리') ?? ls[0];
    return talkBox(j?.who ?? '잼트리', ls.filter((l) => l.who === (j?.who ?? '잼트리')).map((l) => l.text).join(' ') || m.title, `<button class="gk-btn hq-choice primary on" data-act="deploy" ${can.ok ? '' : 'disabled'}>출동</button><button class="gk-btn hq-choice" data-go="supply">정비실 먼저</button><button class="gk-btn hq-choice" data-act="close">다시 고를게</button>`, kit);
  };
  // 정산: 본부 장면 위 대화창 (말한 사람 얼굴 + 큰 글씨 결과 몇 줄 + 확인)
  const settleTalk = () => {
    const l = s.last!;
    const back = lines(`return:${l.how}`, ctx());
    const first = back.find((x) => photoOf(x.who)) ?? back[0];
    const who = first?.who || '잼트리';
    const title = l.how === 'evac' ? '후송' : l.how === 'withdraw' ? '철수' : '귀환';
    const res = `<ul class="hq-result gk-font">${l.lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return talkBox(who, `${title}. ${first?.text ?? ''}`, `<div class="hq-choice-row"><button class="gk-btn hq-choice primary on" data-act="close">확인</button>${host?.link ? '<button class="gk-btn hq-choice" data-act="report">본편에 보고서 붙이기</button>' : ''}</div>`, res);
  };
  const renderFloat = () => {
    const ov = wrap!.querySelector<HTMLElement>('.hq-over')!;
    const open = !!(overlay || panel);
    ov.hidden = !open;
    if (!open) return void (ov.innerHTML = '');
    const talk = overlay === 'brief' || overlay === 'settle' || (!overlay && panel === 'jaemtri');
    ov.classList.toggle('talk', talk);
    if (talk) {
      ensureKit();
      ov.innerHTML = (overlay === 'brief' ? briefTalk() : overlay === 'settle' ? settleTalk() : missionTalk()) + (notice ? `<p class="hq-notice hq-talk-notice">${esc(notice)}</p>` : '');
      return;
    }
    const body = overlay === 'brief' ? briefHtml() : overlay === 'settle' ? settleHtml() : overlay === 'menu' ? menuHtml() : placeHtml(panel!);
    ov.innerHTML = `<div class="hq-sheet">${bar()}${body}${overlay !== 'settle' && notice ? `<p class="hq-notice">${esc(notice)}</p>` : ''}</div>`;
    wrap!.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => el.dataset.icon && el.replaceChildren(iconCanvas(el.dataset.icon, 28)));
  };
  const closeOne = () => {
    if (overlay) overlay = null;
    else panel = null;
    notice = '';
    render();
    if (!overlay && !panel) host?.closed?.();
  };
  const render = () => {
    if (!wrap) return;
    if (!walk) return renderFloat();
    wrap.querySelector('.hq-head')!.innerHTML = top();
    const pane = wrap.querySelector<HTMLElement>('.hq-pane')!;
    pane.innerHTML = panel ? `${placeHtml(panel)}${notice ? `<p class="hq-notice">${esc(notice)}</p>` : ''}` : `<p class="hq-dim">←→로 걸어 다니다 E로 들어가거나, 위 장소 단추를 누르세요. ${notice ? `<span class="hq-notice">${esc(notice)}</span>` : ''}</p>`;
    const ov = wrap.querySelector<HTMLElement>('.hq-over')!;
    ov.hidden = !overlay;
    if (overlay) ov.innerHTML = `<div class="hq-sheet">${overlay === 'brief' ? briefHtml() : overlay === 'settle' ? settleHtml() : menuHtml()}${overlay !== 'settle' && notice ? `<p class="hq-notice">${esc(notice)}</p>` : ''}</div>`;
    wrap.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => el.dataset.icon && el.replaceChildren(iconCanvas(el.dataset.icon, 28)));
  };
  const say = (t: string) => {
    notice = t;
    void save();
    render();
  };
  const go = (id: PlaceId) => {
    if (!placeOpen(s, id)) return;
    const p = PLACE_BY_ID[id];
    s.x = p.x + p.w / 2;
    panel = id;
    notice = '';
    if (overlay === 'brief' || overlay === 'menu') overlay = null;
    if (!walk) host?.goto?.(id);
    barkPlace = id;
    const l = lines(`npc:${id}`, ctx())[0];
    if (l) bark = { ...l, t: 4, x: s.x };
    void save();
    render();
  };
  const refreshSlots = async () => {
    if (!host?.saves) return;
    slotList = await host.saves.list().catch(() => []);
    if (overlay === 'menu') render();
  };

  const onClick = (ev: Event) => {
    const t = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!t || t.disabled || !host) return;
    const d = t.dataset;
    if (d.go) return go(d.go as PlaceId);
    if (d.pick) return ((s.selected = d.pick as AgentId), s.support === s.selected && (s.support = null), say(`출동 요원: ${AGENT_BY_ID[s.selected].name}`));
    if (d.support) return ((s.support = d.support === 'none' ? null : (d.support as AgentId)), say(s.support ? `지원 요원: ${AGENT_BY_ID[s.support].name}` : '지원 요원 없음'));
    if (d.mission) return ((selMission = d.mission), (s.mission = d.mission), render());
    if (d.buy) return say(buy(s, d.buy));
    if (d.equip) return say(equip(s, Number(d.slot), d.equip));
    if (d.unequip) return (unequip(s, Number(d.unequip)), say(`${Number(d.unequip) + 1}번 칸 비움`));
    if (d.relic !== undefined) return say(equipRelic(s, Number(d.slot), d.relic || null));
    if (d.coffee) return say(pickCoffee(s, s.coffee === d.coffee ? null : d.coffee));
    if (d.treat) return say(treat(s, d.treat as AgentId));
    if (d.interview) return say(interview(s, d.interview));
    if (d.research) return say(doResearch(s, d.research));
    if (d.danger) return (setDanger(s, Number(d.danger)), say(`위험 단계 ${s.danger}`));
    if (d.saveslot) {
      pickSlot = Number(d.saveslot);
      void host.saves?.write(pickSlot, saveText(s), { ...saveTitle(s), schema: HQ_SCHEMA }).then(() => ((notice = `슬롯 ${pickSlot}에 저장했어요.`), refreshSlots()));
      return;
    }
    if (d.loadslot) {
      void host.saves?.read(Number(d.loadslot)).then((txt) => {
        const got = parseSave(txt);
        if (!got) return say('불러오지 못했어요 (모양이 다른 저장).');
        s = got;
        overlay = null;
        panel = null;
        say(`슬롯 ${d.loadslot}을(를) 불러왔어요.`);
      });
      return;
    }
    switch (d.act) {
      case 'menu':
        overlay = 'menu';
        notice = '';
        void refreshSlots();
        return render();
      case 'close':
        if (!walk) return closeOne();
        overlay = null;
        notice = '';
        return render();
      case 'brief':
        pendingSeed = Math.floor(rand() * 1e9);
        overlay = 'brief';
        notice = '';
        return render();
      case 'deploy': {
        const l = launch(s, selMission!, pendingSeed);
        if (typeof l === 'string') return say(l);
        pending = l;
        overlay = null;
        panel = null;
        void save();
        render();
        if (walk) wrap!.hidden = true;
        evacJust = false;
        host.deploy(l);
        return;
      }
      case 'approve':
        return say(approveDanger(s));
      case 'appraise':
        return say(appraise(s).join(' / '));
      case 'tooth':
        return say(openToothBox(s, rand));
      case 'report': {
        const p = reportPayload(s);
        if (p && host.link) void host.link.report(p).then((m) => say(m), () => say('보고서를 붙이지 못했어요.'));
        return;
      }
      case 'reset':
        if (!confirm('본부 기록(재화·규칙서·숙련)을 지우고 처음부터 할까요?')) return;
        s = newSave();
        overlay = null;
        panel = null;
        return say('처음부터 시작해요.');
    }
  };
  const onKey = (ev: KeyboardEvent) => {
    if (!wrap || wrap.hidden) return;
    const tg = ev.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (ev.type === 'keyup') return void keys.delete(ev.code);
    if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') (keys.add(ev.code), ev.preventDefault());
    if (ev.repeat) return;
    if (ev.code === 'Escape') {
      overlay = overlay ? null : 'menu';
      if (overlay) void refreshSlots();
      notice = '';
      render();
    } else if (ev.code === 'KeyE' && !overlay) {
      const p = placeAt(s.x);
      if (p) go(p.id);
    }
  };
  const onPointer = (ev: PointerEvent) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-move]');
    if (ev.type === 'pointerdown' && t) {
      moving = Number(t.dataset.move);
      if (!moving) {
        const p = placeAt(s.x);
        if (p) go(p.id);
      }
    } else if (ev.type !== 'pointerdown') moving = 0;
  };
  const blur = () => (keys.clear(), (moving = 0));

  const mod: HqModule = {
    get state() {
      return s;
    },
    mount(r, h, opt) {
      root = r;
      host = h;
      walk = opt?.walk !== false;
      wrap = document.createElement('section');
      wrap.className = walk ? 'hq' : 'hq hq-float';
      wrap.tabIndex = 0;
      wrap.innerHTML = walk
        ? `<style>${css}</style><div class="hq-head"></div><div class="hq-view"><canvas width="${VW}" height="${VH}" aria-label="본부"></canvas></div><div class="hq-move"><button data-move="-1">◀</button><button data-move="0">E 들어가기</button><button data-move="1">▶</button></div><div class="hq-pane"></div><div class="hq-over" hidden></div>`
        : `<style>${css}</style><div class="hq-over" hidden></div>`;
      root.append(wrap);
      canvas = wrap.querySelector('canvas');
      wrap.addEventListener('click', onClick);
      // 창이 바뀐 직전 마우스 자리로 강조가 옮겨 가지 않게: 마우스를 움직여야 올림 강조가 켜진다
      wrap.addEventListener('pointermove', () => wrap?.querySelector('.hq-talk.fresh')?.classList.remove('fresh'));
      if (walk) {
        wrap.addEventListener('pointerdown', onPointer);
        window.addEventListener('pointerup', onPointer);
        window.addEventListener('pointercancel', onPointer);
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        window.addEventListener('blur', blur);
      }
      render();
      void (async () => {
        const got = parseSave(await h.load().catch(() => null));
        if (got) s = got;
        // 출동 중에 앱을 닫았다면: 출동 기록이 없으니 후송 취급으로 정리한다 (아이템은 이미 출동으로 넘어갔다)
        if (s.active) {
          s.active = null;
          notice = '지난 출동이 끝나지 않은 채 닫혔어요. 요원은 후송된 것으로 처리했어요.';
        }
        card = (await h.link?.card().catch(() => null)) ?? null;
        render();
        wrap?.focus({ preventScroll: true });
      })();
      last = performance.now();
      if (walk) raf = requestAnimationFrame(tick);
    },
    map: () => hqMap(s, evacJust),
    bark(place) {
      if (!placeOpen(s, place)) return null;
      return lines(`npc:${place}`, ctx())[0] ?? null;
    },
    places: () => PLACES.map((p) => ({ id: p.id, name: p.name, floor: p.floor, x: p.x, w: p.w, npc: p.npc, color: p.color, open: placeOpen(s, p.id), opens: p.opens })),
    openPlace(id) {
      if (!placeOpen(s, id)) return;
      overlay = null;
      panel = id;
      notice = '';
      s.x = PLACE_BY_ID[id].x + PLACE_BY_ID[id].w / 2;
      void save();
      render();
    },
    openMenu() {
      overlay = 'menu';
      notice = '';
      void refreshSlots();
      render();
    },
    isOpen: () => (walk ? !!overlay : !!(overlay || panel)),
    close: () => (walk ? ((overlay = null), render()) : closeOne()),
    onReturn(result, l) {
      const ls = settle(s, l, result, rand);
      evacJust = result.how === 'evac';
      pending = null;
      overlay = 'settle';
      if (walk) {
        if (result.how === 'evac') go('clinic');
        else go('jaemtri');
      } else panel = null;
      overlay = 'settle';
      if (wrap) (wrap.hidden = false), wrap.focus({ preventScroll: true });
      void save();
      render();
      void ls;
    },
    unmount() {
      cancelAnimationFrame(raf);
      void save();
      window.removeEventListener('pointerup', onPointer);
      window.removeEventListener('pointercancel', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', blur);
      wrap?.remove();
      wrap = canvas = root = null;
      host = null;
    },
  };
  void pending;
  return mod;
}
