// 대사와 컷신 시연판 (단일 HTML, 폰에서 바로). 본부 → 임무 접수 → 브리핑 → 투입 컷신 → 승강기(인사·호명·총애) →
// 층(승객·전투 말풍선) → 다락방(거래·로프) → 귀환/후송 → 정산. 전투 자체는 없고, 전투 사건 버튼으로 말풍선을 본다.
import { mountStory, type StoryApi } from './index';
import { AGENTS } from './lines/agents';
import { AGENT_IDS, type AgentId, type Flags } from './types';
import { CUTSCENES } from './scripts/cutscenes';
import { castOf } from './cast';
import { Stage } from './stage';
import { RULES, TYPE_LABEL, depthLabel, type FloorType } from '../graybox/data';
import type { TalkNpcId } from './ai';
import photos from './demo-photos.json';

const KEY = 'goei-story-demo:v1';
const box = document.getElementById('box')!;
const q = new URLSearchParams(location.search);
if (q.get('w')) box.style.width = `${q.get('w')}px`;
if (q.get('h')) box.style.height = `${q.get('h')}px`;

const css = `
.sd{position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:#0b0f12;color:#e8ece9;font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
.sd-stage{position:relative;flex:0 0 auto;width:min(100%,calc(64dvh * 16 / 9));aspect-ratio:16/9;margin:0 auto;background:#000}
.sd-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:manipulation}
.sd-hud{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:8px 12px;font-size:13px;color:#b9c3bf;border-bottom:1px solid rgba(255,255,255,.07)}
.sd-hud b{color:#e8ece9}
.sd-hud .fav{letter-spacing:2px}
.sd-ctrl{flex:1;overflow:auto;padding:10px 12px 16px;display:flex;flex-direction:column;gap:10px}
.sd-row{display:flex;flex-wrap:wrap;gap:8px}
.sd-row h4{flex:0 0 100%;margin:4px 0 0;font-size:12px;font-weight:600;color:#8d9a95}
.sd-ctrl button{padding:10px 13px;font-size:14px;color:#eef1ee;background:#1f2a2f;border:1px solid rgba(255,255,255,.14);border-radius:9px;cursor:pointer;touch-action:manipulation}
.sd-ctrl button:disabled{opacity:.4}
.sd-ctrl button.main{background:#b8a36a;color:#1a1a12;border-color:#b8a36a;font-weight:700}
.sd-ctrl button.warn{background:#4a2424;border-color:#7a3a3a}
.sd-agents{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.sd-agents button{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px;font-size:13px}
.sd-agents img{width:100%;max-width:84px;aspect-ratio:1;border-radius:12px;object-fit:cover}
.sd-agents button.on{border-color:#b8a36a;background:#2d3a33}
.sd-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);max-width:90%;padding:6px 12px;font-size:13px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.15);border-radius:8px;pointer-events:none;transition:opacity .4s;z-index:25;text-align:center}
.sd-sheet{position:absolute;inset:0;z-index:30;background:rgba(5,8,10,.82);display:flex;align-items:flex-end;justify-content:center}
.sd-sheet>div{width:min(100%,560px);max-height:80%;overflow:auto;background:#141b1f;border-top:3px solid #b8a36a;border-radius:12px 12px 0 0;padding:14px 16px 18px;box-sizing:border-box}
.sd-sheet h3{margin:0 0 10px;font-size:16px}
.sd-sheet li{margin:6px 0;font-size:14px;line-height:1.5}
.sd-sheet li.no{color:#59645f}
.sd-sheet .sd-row{margin-top:12px}
.sd-sheet button{padding:10px 13px;font-size:14px;color:#eef1ee;background:#1f2a2f;border:1px solid rgba(255,255,255,.14);border-radius:9px}
`;
const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

const root = document.createElement('div');
root.className = 'sd';
root.tabIndex = 0;
root.innerHTML = `<div class="sd-stage"></div><div class="sd-hud"></div><div class="sd-ctrl"></div><div class="sd-toast" style="opacity:0"></div>`;
box.append(root);
const stageBox = root.querySelector<HTMLElement>('.sd-stage')!;
const hud = root.querySelector<HTMLElement>('.sd-hud')!;
const ctrl = root.querySelector<HTMLElement>('.sd-ctrl')!;
const toastEl = root.querySelector<HTMLElement>('.sd-toast')!;
const P = photos as Record<string, string>;
const stage = new Stage(P);
stageBox.append(stage.canvas);

// ── 저장 ──
interface Save {
  agent: AgentId;
  flags: Flags;
}
let save: Save = { agent: 'jyaldi', flags: {} };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) save = { ...save, ...JSON.parse(raw) };
} catch {
  /* 저장 없음 */
}
let agent: AgentId = AGENT_IDS.includes(save.agent) ? save.agent : 'jyaldi';
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ agent, flags: story.flags }));
  } catch {
    /* 사생활 보호 창 등 */
  }
};

let toastTimer = 0;
const toast = (t: string) => {
  toastEl.textContent = t;
  toastEl.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.style.opacity = '0'), 2400);
};

// ── 소리 (짧은 합성음) ──
let ac: AudioContext | null = null;
const beep = (freqs: number[], dur = 0.25, type: OscillatorType = 'sine', vol = 0.06) => {
  try {
    ac ??= new AudioContext();
    let t = ac.currentTime;
    for (const f of freqs) {
      const o = ac.createOscillator(),
        gn = ac.createGain();
      o.type = type;
      o.frequency.value = f;
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(ac.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.6;
    }
  } catch {
    /* 소리 없음 */
  }
};
const SFX: Record<string, () => void> = {
  ding: () => beep([1320, 990], 0.5),
  intercom: () => beep([220, 230], 0.12, 'square', 0.02),
  heels: () => beep([900, 900, 900], 0.05, 'triangle', 0.04),
  doors: () => beep([160], 0.4, 'sawtooth', 0.02),
  rope: () => beep([110, 120], 0.3, 'triangle', 0.03),
  hatch: () => beep([300, 200], 0.15, 'square', 0.03),
  duct: () => beep([70], 0.8, 'sine', 0.05),
  stamp: () => beep([180, 120], 0.08, 'square', 0.05),
};

// ── 무대 인물 ──
const actorBase = (id: string) => {
  if (id === 'agent') return { photo: AGENTS[agent].photo, color: AGENTS[agent].color };
  if (id === 'passenger') return { color: '#8a8f86' };
  const c = castOf(id as never, agent);
  return { photo: c.photo, color: c.color };
};
let buddy: string = 'jaemtri';

// ── 대사 모듈 ──
const story: StoryApi = mountStory(
  root,
  {
    getAgent: () => agent,
    pause: () => {},
    bg: (s) => {
      stage.scene = s;
      // 장면이 바뀌면 그 장면에 없는 인물은 숨긴다 (컷신이 다시 보이게 한다)
      for (const a of stage.actors.values()) if (a.id !== 'agent') a.show = false;
      stage.camera(320, 180, 1, 0);
    },
    actor: (id, to, ms) => {
      if (id === 'buddy' && to.anim && !['idle', 'walk'].includes(to.anim)) buddy = to.anim;
      const base = id === 'buddy' ? actorBase(buddy) : actorBase(id);
      stage.actor(id, { ...to, anim: id === 'buddy' ? 'idle' : to.anim, ...(to.show || id === 'buddy' ? base : {}) }, ms, base);
    },
    camera: (x, y, z, ms) => stage.camera(x, y, z, ms),
    panel: (t, ms) => stage.panel(t, ms),
    shake: (ms, amp) => stage.shake(ms, amp),
    sfx: (n) => SFX[n]?.(),
    anchor: (id) => {
      const r = stageBox.getBoundingClientRect(),
        rr = root.getBoundingClientRect();
      if (id === 'elevator') {
        if (stage.scene !== 'elevator_in' && stage.scene !== 'panel') return null;
        const p = stage.toScreen(320, 46);
        return { x: p.x + r.left - rr.left, y: p.y + r.top - rr.top };
      }
      const a = stage.actors.get(id === 'agent' ? 'agent' : id);
      if (!a?.show) return null;
      const p = stage.toScreen(a.x, a.y - 108);
      return { x: p.x + r.left - rr.left, y: p.y + r.top - rr.top };
    },
    emit: (e, a) => setTimeout(() => onEmit(e, a), 0),
    photo: (k) => P[k],
  },
  { saved: save.flags, eager: true, announce: true, dock: 'bottom' },
);

// ── 흐름 ──
type Mode = 'pick' | 'hq' | 'field' | 'attic' | 'busy';
let mode: Mode = 'pick';
const STATIONS: { id: TalkNpcId | 'rest' | 'break'; x: number; script: string; label: string }[] = [
  { id: 'jaemtri', x: 70, script: 'jaemtri_desk', label: '잼트리' },
  { id: 'rest', x: 180, script: 'offer', label: '' },
  { id: 'break', x: 285, script: 'breakroom', label: '탕비실' },
  { id: 'konjyuce', x: 385, script: 'supply', label: '콘쥬스' },
  { id: 'dejure', x: 500, script: 'appraisal', label: '데쥬레' },
  { id: 'gognija', x: 595, script: 'lab', label: '고그니쟈' },
];
let resting: AgentId = AGENT_IDS[(AGENT_IDS.indexOf(agent) + 1) % AGENT_IDS.length];

const F = () => story.flags;
const num = (k: string) => Number(F()[k]) || 0;

function hq() {
  mode = 'hq';
  stage.scene = 'office';
  stage.actors.clear();
  stage.camera(320, 180, 1, 0);
  stage.actor('agent', { x: 230, y: 300, show: true, face: 1, label: '' }, 0, actorBase('agent'));
  for (const s of STATIONS) {
    if (s.id === 'break') continue;
    if (s.id === 'rest') {
      stage.actor('rest', { x: s.x, y: 292, show: true, face: 1, photo: AGENTS[resting].photo, color: AGENTS[resting].color, label: AGENTS[resting].name }, 0);
      continue;
    }
    const c = castOf(s.id as never, agent);
    stage.actor(s.id, { x: s.x, y: 292, show: true, face: -1, photo: c.photo, color: c.color, label: s.label }, 0);
  }
  render();
}

function walkTo(x: number, then: () => void) {
  const a = stage.actors.get('agent');
  const d = a ? Math.abs(a.x - x) : 0;
  const ms = Math.min(1400, d * 6);
  stage.actor('agent', { x, anim: d > 4 ? 'walk' : 'idle' }, ms);
  mode = 'busy';
  render();
  setTimeout(then, ms + 60);
}

function visit(id: (typeof STATIONS)[number]['id'], free = false) {
  const s = STATIONS.find((v) => v.id === id)!;
  const near = s.x + (s.x > 300 ? -42 : 42);
  walkTo(Math.max(30, Math.min(610, near)), () => {
    const back = () => {
      mode = 'hq';
      persist();
      render();
    };
    if (free) {
      const npc: TalkNpcId = id === 'rest' ? resting : (id as TalkNpcId);
      story.talk(npc, back);
      return;
    }
    if (id === 'rest') {
      // 출동 제안은 쉬는 요원이 말하므로 잠시 그 요원으로 대본을 돌린다. 「같이 가자」면 pick 사건으로 바뀐다.
      const prev = agent;
      pendingPick = resting;
      agent = resting;
      story.say('offer', undefined, () => {
        agent = prev;
        back();
      });
      return;
    }
    story.say(s.script, undefined, back);
  });
}
let pendingPick: AgentId | null = null;

function pickAgent(a: AgentId) {
  agent = a;
  resting = AGENT_IDS[(AGENT_IDS.indexOf(agent) + 1) % AGENT_IDS.length];
  F().calls_reset = 0;
  persist();
}

// 층
const TYPES: FloorType[] = ['chase', 'replica', 'trial'];
function nextType(depth: number): FloorType {
  if (depth <= 3) return 'lobby';
  const last = String(F().ftype);
  const opts = TYPES.filter((t) => t !== last);
  return opts[Math.floor(Math.random() * opts.length)];
}
function plannedType(): FloorType {
  if (!F().nexttype) F().nexttype = nextType(num('depth') + 1);
  return String(F().nexttype) as FloorType;
}
function enterFloor(depth: number, type: FloorType = stage.floor.type) {
  stage.floor = { depth, type };
  stage.scene = 'hall';
  stage.actors.clear();
  stage.camera(320, 180, 1, 0);
  stage.actor('agent', { x: 140, y: 300, show: true, face: 1 }, 0, actorBase('agent'));
  mode = 'field';
  story.event('enter:floor', { floor: { depth, type } });
  if (depth > num('maxdepth')) F().maxdepth = depth;
  render();
  persist();
}

function board(after: () => void) {
  mode = 'busy';
  stage.scene = 'elevator_in';
  stage.actors.clear();
  stage.camera(320, 180, 1, 0);
  stage.actor('agent', { x: 320, y: 310, show: true, face: 1 }, 0, actorBase('agent'));
  render();
  const depth = num('depth') + 1;
  const type = plannedType();
  F().nexttype = '';
  story.say('board', { depth, ftype: type }, () => {
    SFX.ding();
    stage.floor = { depth, type };
    after();
  });
}

function deploy() {
  mode = 'busy';
  render();
  story.say('briefing', { variant: briefingVariant() }, () => {
    F().called_run = 0;
    F().depth = 0;
    F().loot = 0;
    F().unsent = 0;
    F().dealt = 0;
    const go = () => board(() => enterFloor(num('depth')));
    if (!F()['seen.cs.first_entry']) story.cutscene('first_entry', go);
    else go();
  });
}
function briefingVariant(): string {
  const list = ['오늘은 승강기가 인사한 사람한테만 버튼을 보여 준대요.', '거울이 피곤해 보이는 날이래요. 거울 보면 내려요.', '승객이 둘씩 다닌대요. 사연 긴 쪽 조심.', ''];
  return list[Math.floor(Math.random() * list.length)];
}

function encounter() {
  mode = 'busy';
  render();
  const done = () => {
    stage.actors.get('passenger') && (stage.actors.get('passenger')!.show = false);
    mode = 'field';
    render();
    persist();
  };
  stage.actor('passenger', { x: 470, y: 300, show: true, face: -1 }, 0, actorBase('passenger'));
  if (F().mission === 'm4' && !F().rescued_m4) {
    story.say('passenger_missing', { late: 0 }, done);
    return;
  }
  const r = Math.random();
  const honest = Math.random() < 0.5 ? 1 : 0;
  if (r < 0.34) {
    F().honest = honest;
    story.cutscene('three_years', done);
  } else if (r < 0.58) story.say('passenger_pair', { liar: Math.random() < 0.5 ? 'a' : 'b' }, done);
  else if (r < 0.78) story.say('passenger_supply', { honest }, done);
  else if (r < 0.9) story.say('passenger_signs', undefined, done);
  else {
    stage.actors.get('passenger')!.show = false;
    story.say('mirror', undefined, done);
  }
}

function attic() {
  mode = 'busy';
  render();
  const first = !F()['seen.cs.attic'];
  const enter = () => {
    stage.scene = 'attic';
    stage.actors.clear();
    stage.actor('agent', { x: 160, y: 300, show: true, face: 1 }, 0, actorBase('agent'));
    story.event('attic:enter');
    mode = 'attic';
    F().unsent = num('unsent') + 1;
    render();
  };
  if (first) story.cutscene('attic', enter);
  else story.say('attic', undefined, enter);
}

function finish(result: 'return' | 'evac' | 'retreat') {
  mode = 'busy';
  render();
  story.event('run:end', { result });
  const m = String(F().mission || '');
  const after = () => {
    story.say('settle', { result }, () => {
      if (result === 'return' && m) {
        F()[`done_${m}`] = 1;
        F().mission = '';
        toast(`임무 완료: ${m}`);
      }
      F().depth = 0;
      hq();
      persist();
    });
  };
  if (result === 'evac') {
    story.cutscene('evac', () => {
      hq();
      after();
    });
  } else
    story.cutscene('return', () => {
      hq();
      after();
    });
}

function onEmit(e: string, a: string) {
  switch (e) {
    case 'favor':
      toast(`승강기 총애 ${Number(a) > 0 ? '+' : ''}${a}`);
      break;
    case 'rule': {
      const r = RULES.find((x) => x.id === a);
      if (r && !F()[`rule_${a}`]) {
        story.event('find:rule', { id: a });
        SFX.stamp();
        toast(`규칙서에 한 줄: ${r.text}`);
      }
      break;
    }
    case 'mission':
      toast('임무 접수. 사무실에서 출동 요원을 골라도 되고, 바로 출동해도 돼요.');
      break;
    case 'pick':
      if (pendingPick) {
        pickAgent(pendingPick);
        pendingPick = null;
        toast(`출동 요원: ${AGENTS[agent].name}`);
        hq();
      }
      break;
    case 'freetalk':
      setTimeout(() => story.talk(a as TalkNpcId, () => ((mode = 'hq'), render())), 50);
      break;
    case 'open':
      if (a === 'rulebook') rulebook();
      else toast(`(${a} 화면은 본부 스레드가 만든다)`);
      break;
    case 'coffee':
      toast(`다음 출동 커피: ${a === 'condensed' ? '연유 커피' : a === 'black' ? '블랙' : '믹스커피'}`);
      break;
    case 'buddy':
      buddy = a;
      break;
    case 'cue':
      stage.shake(250, 2);
      break;
    case 'trapped':
      toast('문이 닫히지 않는다. 10초 갇힘 (엔진: 적 등장)');
      break;
    case 'passenger':
      toast({ right: '맞는 문이었다.', wrong: '틀린 문이었다.', lure: '유인당했다. 수호자 영역.', rescued: '승객을 데려간다.', ambush: '승객이 덮친다!', robbed: '승객의 보급품을 빼앗았다.' }[a] ?? a);
      if (a === 'ambush' || a === 'lure') story.event('combat:start');
      break;
    case 'combat':
      story.event('combat:start');
      break;
    case 'deal':
      toast({ 'type true': `다음 층은 「${TYPE_LABEL[plannedType()]}」래요.`, skip2: '깊이 +2. 갈 수 없는 층이 열렸다.', 'supply true': '보급품 위치를 받았다.', lie: '…받은 정보가 이상하다. (거짓이 섞였다)' }[a] ?? a);
      break;
    case 'encounter':
      setTimeout(encounter, 100);
      break;
    case 'predator':
      toast('포식자가 올라온다! (엔진: 정비 구역 적)');
      break;
    case 'supply':
    case 'signs':
    case 'mirror':
    case 'album':
    case 'appraise':
      toast({ supply: '보급품', signs: '벽 기호 읽는 법을 배웠다', mirror: '거울을 무시했다. 이번 층 위험·보상 +30%', album: '대화 앨범에 남았다', appraise: '연구 자료 +1' }[e] + (e === 'supply' ? `: ${a}` : ''));
      break;
    case 'rescue':
      F().rescued_m4 = 1;
      toast('구조 대상과 함께 이동한다');
      story.event('rescue');
      break;
    case 'cutscene':
      if (a === 'exit')
        story.cutscene('exit', () =>
          story.cutscene('dinner', () => {
            F().exit_done = 1;
            hq();
          }),
        );
      break;
  }
  render();
}

function rulebook() {
  const el = document.createElement('div');
  el.className = 'sd-sheet';
  el.innerHTML = `<div><h3>규칙서 · 차원 승강기</h3><ol>${RULES.map((r) => `<li class="${F()[`rule_${r.id}`] ? '' : 'no'}">${F()[`rule_${r.id}`] ? r.text : '……'}</li>`).join('')}</ol><div class="sd-row"><button>닫기</button></div></div>`;
  el.querySelector('button')!.onclick = () => el.remove();
  el.onclick = (e) => e.target === el && el.remove();
  root.append(el);
}

function freeTalkSheet() {
  const el = document.createElement('div');
  el.className = 'sd-sheet';
  const list: [TalkNpcId, string][] = [
    ['jaemtri', '잼트리'],
    ['gognija', '고그니쟈'],
    ['dejure', '데쥬레'],
    ['konjyuce', '콘쥬스'],
    [resting, AGENTS[resting].name],
    ['madeokhee', '마덕희'],
    ['elevator', '승강기'],
  ];
  el.innerHTML = `<div><h3>자유 대화</h3><p style="font-size:13px;color:#9aa6a1;margin:0 0 6px">플러그인 안에서는 리스 메인 모델이 답한다. 이 시연판은 모델이 없어서 미리 쓴 답으로 대신한다.</p><div class="sd-row">${list.map(([id, n]) => `<button data-id="${id}">${n}</button>`).join('')}<button data-x>닫기</button></div></div>`;
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (e.target === el || b?.dataset.x !== undefined) return el.remove();
    if (b?.dataset.id) {
      el.remove();
      const id = b.dataset.id as TalkNpcId;
      const st = STATIONS.find((s) => s.id === id) ?? (id === resting ? STATIONS[1] : null);
      if (st && mode === 'hq') visit(st.id, true);
      else story.talk(id, () => render());
    }
  };
  root.append(el);
}

function cutsceneSheet() {
  const el = document.createElement('div');
  el.className = 'sd-sheet';
  el.innerHTML = `<div><h3>컷신 다시 보기</h3><div class="sd-row">${Object.values(CUTSCENES)
    .map((c) => `<button data-id="${c.id}">${c.title}</button>`)
    .join('')}<button data-x>닫기</button></div></div>`;
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (e.target === el || b?.dataset.x !== undefined) return el.remove();
    if (b?.dataset.id) {
      el.remove();
      const id = b.dataset.id;
      const back = mode;
      mode = 'busy';
      render();
      if (id === 'three_years') F().honest = Math.random() < 0.5 ? 1 : 0;
      if (id === 'evac') buddy = 'jaemtri';
      story.cutscene(id, () => (back === 'hq' || back === 'pick' ? hq() : ((mode = back), render())));
    }
  };
  root.append(el);
}

const EVENTS: [string, string][] = [
  ['combat:start', '적 등장'],
  ['combat:kill', '처치'],
  ['combat:combo', '긴 연타'],
  ['combat:dodge', '회피'],
  ['combat:ult', '필살기'],
  ['combat:guardbreak', '가드 깨짐'],
  ['hp:low', '체력 낮음'],
  ['ammo:low', '탄 부족'],
  ['ammo:empty', '탄 없음'],
  ['weapon:pickup', '무기 줍기'],
  ['item:use', '아이템'],
  ['combat:boss', '수호자'],
  ['find:item', '회수물'],
  ['rule:break', '규칙 위반'],
  ['intrude:fake', '가짜 관리국'],
  ['intrude:daydream', '백일몽'],
  ['down', '쓰러짐'],
];

function render() {
  const f = F();
  const fav = Math.max(-3, Math.min(3, num('favor')));
  const favStr = fav >= 0 ? '◆'.repeat(fav) + '◇'.repeat(3 - fav) : '▼'.repeat(-fav);
  hud.innerHTML = `<span><b>${AGENTS[agent].name}</b></span><span>총애 <b class="fav">${favStr}</b></span><span>규칙 <b>${num('rules')}</b>줄</span>${mode === 'field' || mode === 'attic' ? `<span>깊이 <b>${depthLabel(num('depth') || 1)}</b></span>` : ''}${f.mission ? `<span>임무 <b>${String(f.mission)}</b></span>` : ''}`;
  if (mode === 'busy' || story.isBlocking()) {
    ctrl.innerHTML = '';
    return;
  }
  if (mode === 'pick') {
    ctrl.innerHTML = `<div class="sd-row"><h4>출동할 요원 (나머지는 본부에 남는다)</h4></div><div class="sd-agents">${AGENT_IDS.map((id) => `<button data-agent="${id}" class="${id === agent ? 'on' : ''}"><img alt="" src="${P[AGENTS[id].photo]}">${AGENTS[id].name}</button>`).join('')}</div>
    <div class="sd-row"><button class="main" data-do="start">${f['seen.cs.first_day'] ? '본부로' : '첫 출근'}</button>${f['seen.cs.first_day'] ? '<button data-do="replay-first">첫 출근 다시 보기</button>' : ''}<button data-do="reset" class="warn">처음부터</button></div>`;
    return;
  }
  if (mode === 'hq') {
    ctrl.innerHTML = `<div class="sd-row"><h4>본부 (인물을 눌러도 된다)</h4>
      <button data-visit="jaemtri" class="${f.mission ? '' : 'main'}">잼트리 자리 · 임무</button><button data-visit="rest">${AGENTS[resting].name}에게 말 걸기</button><button data-visit="break">탕비실</button><button data-visit="konjyuce">정비·보급실</button><button data-visit="dejure">감정실</button><button data-visit="gognija">격리 연구실</button></div>
      <div class="sd-row"><h4>그 밖</h4><button class="${f.mission ? 'main' : ''}" data-do="deploy" ${f.mission ? '' : 'disabled'}>출동 (브리핑)</button><button data-do="talk">자유 대화</button><button data-do="rules">규칙서</button><button data-do="cuts">컷신 다시 보기</button><button data-do="agents">요원 바꾸기</button></div>`;
    return;
  }
  if (mode === 'field') {
    ctrl.innerHTML = `<div class="sd-row"><h4>이 층에서</h4><button class="main" data-do="meet">승객 만나기</button><button data-do="next">다음 층 (승강기)</button><button data-do="attic">정비 구역 · 다락방</button><button data-do="atk" class="warn">승강기에서 공격</button></div>
      <div class="sd-row"><h4>전투 사건 → 요원 말풍선</h4>${EVENTS.map(([e, n]) => `<button data-ev="${e}">${n}</button>`).join('')}<button data-do="rule">규칙 발견</button></div>
      <div class="sd-row"><h4>끝내기</h4><button data-do="evac" class="warn">체력 0 · 후송</button></div>`;
    return;
  }
  if (mode === 'attic') {
    ctrl.innerHTML = `<div class="sd-row"><h4>다락방 (저장·송신·철수)</h4><button class="main" data-do="rope">귀환 로프</button><button data-do="deal" ${f.dealt ? 'disabled' : ''}>인터폰 · 승강기와 거래</button><button data-do="down">더 내려가기</button><button data-do="stay" class="warn">오래 머물기</button><button data-do="exit">패널의 EXIT</button></div>
      <div class="sd-row"><h4>시연용</h4><button data-do="cheat">공략 조건 채우기 (규칙 10·총애 3·B-12)</button></div>`;
  }
}

ctrl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b || b.disabled) return;
  if (b.dataset.agent) {
    pickAgent(b.dataset.agent as AgentId);
    render();
    return;
  }
  if (b.dataset.visit) return visit(b.dataset.visit as never);
  if (b.dataset.ev) {
    story.event(b.dataset.ev);
    return;
  }
  switch (b.dataset.do) {
    case 'start':
      if (!F()['seen.cs.first_day']) {
        mode = 'busy';
        render();
        story.cutscene('first_day', hq);
      } else hq();
      break;
    case 'replay-first':
      mode = 'busy';
      render();
      story.cutscene('first_day', hq);
      break;
    case 'reset':
      for (const k of Object.keys(F())) delete F()[k];
      F().favor = 0;
      F().rules = 0;
      persist();
      render();
      toast('처음부터');
      break;
    case 'deploy':
      deploy();
      break;
    case 'talk':
      freeTalkSheet();
      break;
    case 'rules':
      rulebook();
      break;
    case 'cuts':
      cutsceneSheet();
      break;
    case 'agents':
      mode = 'pick';
      stage.scene = 'office';
      render();
      break;
    case 'meet':
      encounter();
      break;
    case 'next':
      board(() => enterFloor(num('depth')));
      break;
    case 'attic':
      attic();
      break;
    case 'atk':
      mode = 'busy';
      stage.scene = 'elevator_in';
      stage.actors.clear();
      stage.actor('agent', { x: 320, y: 310, show: true }, 0, actorBase('agent'));
      story.say('attack_inside', undefined, () => {
        toast('승강기 총애 -2');
        enterFloor(num('depth'));
      });
      render();
      break;
    case 'rule': {
      const left = RULES.filter((r) => !F()[`rule_${r.id}`]);
      if (left.length) onEmit('rule', left[Math.floor(Math.random() * left.length)].id);
      break;
    }
    case 'evac':
      story.event('down');
      setTimeout(() => finish('evac'), 900);
      break;
    case 'rope':
      finish('return');
      break;
    case 'deal':
      F().loot = Math.max(1, num('loot'));
      mode = 'busy';
      render();
      story.say('deal', undefined, () => ((mode = 'attic'), render()));
      break;
    case 'down':
      board(() => enterFloor(num('depth')));
      F().unsent = 0;
      break;
    case 'stay':
      mode = 'busy';
      render();
      story.say('attic_stay', undefined, () => ((mode = 'attic'), render()));
      break;
    case 'exit':
      mode = 'busy';
      render();
      story.say('exit_panel', undefined, () => {
        if (mode === 'busy') mode = 'attic';
        render();
      });
      break;
    case 'cheat':
      for (const r of RULES.slice(0, 10)) F()[`rule_${r.id}`] = 1;
      F().rules = 10;
      F().favor = 3;
      F().reached_b12 = 1;
      toast('규칙 10줄 · 총애 3 · B-12 도달');
      render();
      break;
  }
});

stage.canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'hq' || story.isBlocking()) return;
  const r = stage.canvas.getBoundingClientRect();
  const a = stage.hit(e.clientX - r.left, e.clientY - r.top);
  if (!a) return;
  const st = STATIONS.find((s) => s.id === a.id);
  if (st) visit(st.id);
});

// 키보드
root.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
});

// 세로 화면: 대화창을 무대 바로 아래에 붙인다 (빈 가운데를 없앤다)
const layout = () => {
  const r = root.getBoundingClientRect();
  const portrait = r.height > r.width * 1.25;
  root.classList.toggle('gsy-top', portrait);
  root.style.setProperty('--gsy-dock-top', `${Math.round(stageBox.getBoundingClientRect().bottom - r.top + 8)}px`);
};
addEventListener('resize', layout);
layout();

// ── 루프 ──
let last = performance.now();
let wasBlocking = false;
function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  story.update(dt);
  stage.update(dt);
  stage.draw();
  const b = story.isBlocking();
  if (b !== wasBlocking) {
    wasBlocking = b;
    render();
  }
  requestAnimationFrame(frame);
}
render();
root.focus({ preventScroll: true });
requestAnimationFrame(frame);
Object.assign(window, { __story: story, __stage: stage });
