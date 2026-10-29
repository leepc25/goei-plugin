// 시작기: Risu는 켜진 플러그인을 모든 봇에서 읽으므로, 플러그인 파일에는 이 작은 시작기만 둔다.
// 괴이 카드를 열었을 때만 본체(src/body.ts → goei-body.js)를 꺼내 실행한다. 본체는 한 번 받아 pluginStorage에 두고
// 플러그인을 업데이트해 판이 달라지면 다시 받는다. 다른 봇에서는 카드 확인과 표식 검사 말고는 아무것도 하지 않는다.
import { BODY_KEY, BodyError, bodyVersion, fetchBody, runBody, type Body } from './loader/body';
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

/** 마지막으로 본체를 시작하지 못한 까닭 (받기 창에 보인다) */
let startError = '';
/** 본체 코드 자체가 실행되지 않았나 (깨진 글·판 불일치). 본체는 돌았는데 시작 중에 실패한 것과 구분해, 깨진 코드만 저장소에서 지운다 */
let codeBroken = false;

/** 저장해 둔 본체를 읽고, 없거나 판이 다르면 받는다. 받지 못하면 받기 창을 띄우고 null */
async function load(prompt: boolean): Promise<Body | null> {
  let code: string | null = null;
  let fromStore = false;
  try {
    const saved: unknown = await risuai.pluginStorage.getItem(BODY_KEY);
    if (typeof saved === 'string' && bodyVersion(saved) === VERSION) (code = saved), (fromStore = true);
  } catch {
    // 아래에서 받는다
  }
  if (!code) {
    try {
      code = await fetchBody(VERSION);
    } catch (error) {
      console.log(`[goei] 본체를 받지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
      failedAt = Date.now();
      if (prompt) showPanel(VERSION, install);
      return null;
    }
    await save(code);
  }
  const b = await start(code);
  if (!b) {
    failedAt = Date.now();
    // 저장해 둔 본체가 깨져 있으면(판은 맞는데 실행이 안 됨) 지워서 다음에 다시 받게 한다. 그냥 두면 플러그인 판이 바뀔 때까지 영영 안 뜬다
    if (fromStore && codeBroken) await risuai.pluginStorage.removeItem(BODY_KEY).catch(() => {});
    if (prompt) showPanel(VERSION, install, `본체를 시작하지 못했어요: ${startError}`);
  }
  return b;
}

/** 저장소에 둔다. 저장이 안 돼도(용량 초과 등) 이번에는 받은 본체로 그냥 돈다 */
async function save(code: string): Promise<void> {
  try {
    await risuai.pluginStorage.setItem(BODY_KEY, code);
  } catch (error) {
    console.log(`[goei] 본체를 저장하지 못했어요 (다음에 다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function start(code: string): Promise<Body | null> {
  codeBroken = false;
  let api: ReturnType<typeof runBody>;
  try {
    api = runBody(code, VERSION);
  } catch (error) {
    codeBroken = true;
    startError = error instanceof Error ? error.message : String(error);
    console.log(`[goei] 본체를 실행하지 못했어요: ${startError}`);
    return null;
  }
  try {
    body = await api.start();
    return body;
  } catch (error) {
    startError = error instanceof Error ? error.message : String(error);
    console.log(`[goei] 본체를 시작하지 못했어요: ${startError}`);
    return null;
  }
}

/** 받기 창에서 받았거나 파일로 넣은 본체. 시작하지 못하면 창은 그대로 두고 까닭을 던진다 */
async function install(code: string): Promise<void> {
  await save(code);
  loading = start(code).then((b) => {
    if (!b) loading = null;
    return b;
  });
  const b = await loading;
  if (!b) {
    failedAt = Date.now();
    if (codeBroken) await risuai.pluginStorage.removeItem(BODY_KEY).catch(() => {});
    throw new BodyError(`본체를 시작하지 못했어요: ${startError}`);
  }
  closePanel();
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
  let b = body;
  if (!b) {
    if (type !== 'model' || !Array.isArray(messages) || !messages.some((m) => ours((m as { content?: unknown })?.content))) return messages;
    b = await ensure();
    if (!b) return messages;
  }
  try {
    return (await b.beforeRequest(messages as never, type)) as M[];
  } catch (error) {
    // 본체가 통째로 던져도 요청은 막지 않는다: 본체의 sanitize 로 플러그인 표식만 지워 보내고(없으면 원문), 까닭은 로그로 (QC 개선 나3)
    console.log(`[goei] 요청 처리기 실패(표식만 지우고 보냄): ${error instanceof Error ? error.message : String(error)}`);
    try {
      return typeof b.sanitize === 'function' ? (b.sanitize(messages as never) as M[]) : messages;
    } catch {
      return messages;
    }
  }
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
