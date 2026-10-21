// 플러그인 창 게임 시연판 (release/demo/goei-plugin-game.html): Risu 없이 폰에서 열어 보는 용도.
// 가짜 risuai(저장은 이 브라우저 localStorage)로 실제 게임 창(ui/game.ts)·다리·코드 팩 실행을 그대로 돌린다.
// 게임 코드는 받는 대신 페이지에 든 것을 「받은」 것으로 넣어 둔다(window.__GOEI_GAME_CODE__).
import css from '../ui/style.css';
import { closeGame, openGame } from '../ui/game';

const W = window as unknown as { __GOEI_GAME_CODE__?: string; risuai?: unknown };
const PREFIX = 'goei-plugin-game-demo:';
const store = {
  getItem: async (k: string) => localStorage.getItem(PREFIX + k),
  setItem: async (k: string, v: string) => {
    try {
      localStorage.setItem(PREFIX + k, v);
    } catch {
      /* 용량 초과: 시연판이라 무시 */
    }
  },
  removeItem: async (k: string) => localStorage.removeItem(PREFIX + k),
  keys: async () => Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)),
};

const roster = {
  version: 2,
  refill: 2,
  characters: [
    ['P001', '쟈알디', 'Jyaldi', '팀장'],
    ['P002', '에일린', 'Aileen', '요원'],
    ['P003', '잼트리', 'Jaemtri', '요원'],
    ['P004', '스팡달', 'Spangdal', '요원'],
  ].map(([id, name, english, rank]) => ({ id, name, english, lore: name, aliases: [], affiliation: 'A00', rank, department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] })),
};
const world = {
  v: 1, epoch: 3, minute: 600, inc: [], ms: [], retired: [], promoted: [], blocks: {}, skip: {}, pending: {}, notice: '', ended: [],
  an: [{ loc: '02', name: '차원 승강기', state: '활성', grade: 'B', deploy: 'P002', kind: 'preset', origin: 'model', presetName: '', since: 500, born: 2, exploring: false, situation: '엘리베이터가 B-3에서 멈췄다' }],
  agents: { P002: { st: '작전투입', situation: '차원 승강기', since: 500, dead: 0, tagged: true }, P004: { st: '부상', situation: '', since: 400, dead: 0, tagged: true } },
};
let char = {
  name: '괴이 ː 이면세계 (시연)',
  globalLore: [
    { comment: 'World catalog', content: JSON.stringify({ 괴이: [[true, '차원 승강기', '차원 승강기', 'Dimensional Elevator', []]], '미스틱 사이트': [], 랜드마크: [] }) },
    { comment: 'Agent roster', content: JSON.stringify(roster) },
  ],
};
const savedChat = localStorage.getItem(PREFIX + 'chat');
let chat: Record<string, unknown> = savedChat ? JSON.parse(savedChat) : { message: [{ role: 'char', data: '시연용 채팅' }], scriptstate: { $st_faction: 'A00', $goei_world: JSON.stringify(world) }, localLore: [] };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

W.risuai = {
  pluginStorage: store,
  getCurrentCharacterIndex: async () => 0,
  getCurrentChatIndex: async () => 0,
  getCharacterFromIndex: async () => clone(char),
  setCharacterToIndex: async (_i: number, c: typeof char) => void (char = clone(c)),
  getChatFromIndex: async () => clone(chat),
  setChatToIndex: async (_a: number, _b: number, c: Record<string, unknown>) => {
    chat = clone(c);
    localStorage.setItem(PREFIX + 'chat', JSON.stringify(chat));
    showChat();
  },
  readImage: async () => null,
  readInlay: async () => null,
  nativeFetch: async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' }),
  getDatabase: async () => ({ modules: [], enabledModules: [] }),
};

// 「받은」 게임 코드 (시연판은 받기 없이)
if (W.__GOEI_GAME_CODE__) void store.setItem('goei:game:code', W.__GOEI_GAME_CODE__);

const style = document.createElement('style');
style.textContent = `${css}
html,body{margin:0;height:100%;background:#0b1013}
.demo-chat{position:fixed;left:8px;bottom:8px;max-width:min(420px,calc(100vw - 16px));max-height:40vh;overflow:auto;white-space:pre-wrap;font:12px/1.5 system-ui;color:#e9f0ee;background:#232d32ee;border:1px solid #37464d;border-radius:10px;padding:8px 10px;z-index:10000;margin:0}
.demo-chat:empty{display:none}`;
document.head.append(style);
document.body.innerHTML = `<div class="gx" data-theme="dark"><div class="gx-panel"></div></div><pre class="demo-chat"></pre>`;
const panel = document.querySelector('.gx-panel')!;

function showChat(): void {
  const last = (chat.message as { role: string; data: string }[]).at(-1);
  const lore = ((chat.localLore as { comment?: string; content?: string }[]) ?? []).find((e) => e.comment === '관리국 훈련 기록');
  const el = document.querySelector('.demo-chat')!;
  el.textContent = [last?.role === 'user' ? `채팅에 놓인 메시지 (전송 대기):\n${last.data.replace('%%GOEI_UNSENT%%', '').trim()}` : '', lore ? `\n로어북 「관리국 훈련 기록」:\n${lore.content}` : ''].filter(Boolean).join('\n');
}

// 닫기 버튼(data-action="game-close")은 플러그인 창(app.ts)이 처리한다. 시연판은 닫으면 다시 연다
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-action="game-close"]')) {
    closeGame();
    setTimeout(() => openGame(panel), 50);
  }
});
openGame(panel);
showChat();
