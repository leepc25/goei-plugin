// 시작기: Risu는 켜진 플러그인을 모든 봇에서 읽으므로, 플러그인 파일에는 이 작은 시작기만 둔다.
// 괴이 카드를 열었을 때만 본체(src/body.ts → goei-body.js)를 꺼내 실행한다. 본체는 한 번 받아 pluginStorage에 두고
// 플러그인을 업데이트해 판이 달라지면 다시 받는다. 다른 봇에서는 카드 확인과 표식 검사 말고는 아무것도 하지 않는다.
import { BODY_KEY, bodyVersion, fetchBody, runBody, type Body } from './loader/body';
import { isGoeiCard } from './loader/card';
import { closePanel, showPanel } from './loader/panel';

const VERSION: string = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '';
declare const __PLUGIN_VERSION__: string | undefined;
const WATCH_MS = 1000;

/** 이 봇 메시지·요청에만 있는 표식 (시드, 이동·전화 지시문, 시작 카드, 상태창) */
const MARKS = ['%%SEED%%', '%%SCENE_CARD:', '%%PHONE_CALL:', '%%GOEI_UNSENT%%', '%%GOEI_START%%', 'data-goei="landing"', 'ANOMALY SIMULATION', '[▣'];
const ours = (t: unknown) => typeof t === 'string' && MARKS.some((m) => t.includes(m));

let body: Body | null = null;
let loading: Promise<Body | null> | null = null;
let stopped = false;
/** 받기에 실패한 때. 메시지마다 다시 받으려 하지 않게, 카드를 다시 열거나 1분이 지나야 다시 시도한다 */
let failedAt = 0;

/** 저장해 둔 본체를 읽고, 없거나 판이 다르면 받는다. 받지 못하면 받기 창을 띄우고 null */
async function load(prompt: boolean): Promise<Body | null> {
  let code: string | null = null;
  try {
    const saved: unknown = await risuai.pluginStorage.getItem(BODY_KEY);
    if (typeof saved === 'string' && bodyVersion(saved) === VERSION) code = saved;
  } catch {
    // 아래에서 받는다
  }
  if (!code) {
    try {
      code = await fetchBody(VERSION);
      await risuai.pluginStorage.setItem(BODY_KEY, code);
    } catch (error) {
      console.log(`[goei] 본체를 받지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
      failedAt = Date.now();
      if (prompt) showPanel(VERSION, install);
      return null;
    }
  }
  return start(code);
}

async function start(code: string): Promise<Body | null> {
  try {
    const api = runBody(code, VERSION);
    body = await api.start();
    return body;
  } catch (error) {
    console.log(`[goei] 본체를 시작하지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** 받기 창에서 받았거나 파일로 넣은 본체 */
async function install(code: string): Promise<void> {
  await risuai.pluginStorage.setItem(BODY_KEY, code);
  closePanel();
  loading = start(code);
  await loading;
}

/** 본체가 필요할 때 한 번만 불러온다. 실패하면 다음에 다시 시도 */
function ensure(prompt = false): Promise<Body | null> {
  if (body) return Promise.resolve(body);
  if (!prompt && !loading && Date.now() - failedAt < 60_000) return Promise.resolve(null);
  loading ??= load(prompt).then((b) => {
    if (!b) loading = null;
    return b;
  });
  return loading;
}

async function onBeforeRequest<M>(messages: M[], type: string): Promise<M[]> {
  if (body) return body.beforeRequest(messages as never, type) as Promise<M[]>;
  if (type !== 'model' || !Array.isArray(messages) || !messages.some((m) => ours((m as { content?: unknown })?.content))) return messages;
  const b = await ensure();
  return b ? (b.beforeRequest(messages as never, type) as Promise<M[]>) : messages;
}

async function onOutput(arg: Parameters<Body['output']>[0]): Promise<void> {
  const b = body ?? (loading ? await loading : null);
  if (b) await b.output(arg);
}

/** 보낼 글: 본체가 떠 있을 때만 (로어북 고르기). 다른 봇에서는 그대로 */
async function onInput(text: string): Promise<string> {
  return body ? body.input(text) : text;
}

async function onDisplay(text: string): Promise<string> {
  if (!body && !ours(text)) return text;
  try {
    const b = body ?? (await ensure());
    return b ? await b.display(text) : text;
  } catch (error) {
    // 그리기가 실패해도 메시지는 원문으로 보이게 (처리기 예외가 Risu 메시지 그리기를 막지 않게)
    console.log(`[goei] 메시지 그리기 실패: ${error instanceof Error ? error.message : String(error)}`);
    return text;
  }
}

/** 괴이 카드를 열면 본체를 꺼낸다. 본체가 뜨면 감시는 본체가 맡는다 */
function watch(): void {
  let last = -2;
  const tick = async () => {
    if (stopped || body) return;
    try {
      const idx = await risuai.getCurrentCharacterIndex();
      if (idx !== last) {
        last = idx;
        if (Number.isInteger(idx) && idx >= 0 && isGoeiCard(await risuai.getCharacterFromIndex(idx))) await ensure(true);
      }
    } catch {
      // 다음 차례에 다시
    }
    if (!stopped && !body) setTimeout(() => void tick(), WATCH_MS);
  };
  void tick();
}

// 깡통봇 설치 (설계안 9절): 아무 봇에서나 햄버거 메뉴의 「괴이: ANOMALY 설치·점검」 으로 본체를 꺼내 설치 화면을 연다.
// 괴이 카드에서는 같은 단추가 점검 화면을 연다
void risuai
  .registerButton({ name: '괴이: ANOMALY 설치·점검', icon: '👻', iconType: 'html', location: 'hamburger', id: 'goei-plugin-install' }, () => {
    void ensure(true).then((b) => b?.install());
  })
  .catch((error: unknown) => console.log(`[goei] 설치 단추를 두지 못했어요: ${error instanceof Error ? error.message : String(error)}`));

// 선택지용사처럼 필요한 권한을 처음에 한 번에 묻는다 (업데이트하면 Risu가 권한을 다시 묻는데,
// 기능을 하나씩 켜는 도중에 묻지 않게)
for (const permission of ['replacer', 'mainDom', 'sendChat']) {
  try {
    await risuai.requestPluginPermission(permission);
  } catch {
    /* 옛 Risu에는 없을 수 있다. 그러면 기능을 켤 때 Risu가 묻는다 */
  }
}
// 처리기는 하나씩 건다: 하나가 거부·실패해도(권한 거부 등) 나머지와 감시는 켠다 (QC 2026-10-28: 예전엔 첫 실패에서 시작기 전체가 멈췄다)
const hook = async (what: string, f: () => Promise<unknown>): Promise<void> => {
  try {
    await f();
  } catch (error) {
    console.log(`[goei] ${what} 처리기를 걸지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
};
await hook('요청', () => risuai.addRisuReplacer('beforeRequest', onBeforeRequest));
await hook('응답', () => risuai.addRisuChatListener('output', onOutput));
await hook('표시', () => risuai.addRisuScriptHandler('display', onDisplay));
// 입력 처리기가 없는 옛 Risu: 로어북은 응답 뒤·요청 직전에만 고른다
await hook('입력', () => risuai.addRisuScriptHandler('input', onInput));
watch();

await hook('종료', () => risuai.onUnload(async () => {
  stopped = true;
  await body?.unload().catch(() => {});
  // 하나가 실패해도 나머지는 뗀다
  await risuai.removeRisuReplacer('beforeRequest', onBeforeRequest).catch(() => {});
  await risuai.removeRisuChatListener('output', onOutput).catch(() => {});
  await risuai.removeRisuScriptHandler('display', onDisplay).catch(() => {});
  await risuai.removeRisuScriptHandler('input', onInput).catch(() => {});
}));
