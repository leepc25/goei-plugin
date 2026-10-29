//@name goei-plugin
//@display-name 괴이: ANOMALY v0.18.2
//@api 3.0
//@version 0.18.2
//@update-url https://raw.githubusercontent.com/leepc25/goei-plugin/main/release/goei-plugin.js
//@description 괴이: ANOMALY 전용 플러그인 (괴이봇 2탄 기반): 시작 화면, 상황판, 지도·요원 이동, 커스텀 임무, 괴담넷, 괴담톡, 위키, 설정·캐릭터 이미지
// src/core/texthash.ts
function textHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}
async function sha256Text(text) {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const d = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

// src/loader/body.ts
var BODY_KEY = "goei:body";
var BASE = true ? "https://raw.githubusercontent.com/leepc25/goei-plugin/main/release" : "";
var BodyError = class extends Error {
};
function bodyVersion(code) {
  return /^\/\/ goei-body (\S+)/.exec(code)?.[1] ?? null;
}
var bodyHash = (code) => textHash(code);
function runBody(code, version) {
  const g = globalThis;
  delete g.__goeiBody;
  const nonce = [...document.querySelectorAll("script")].map((s2) => s2.nonce).find(Boolean);
  const s = document.createElement("script");
  if (nonce) s.nonce = nonce;
  s.textContent = code;
  document.head.append(s);
  s.remove();
  const api = g.__goeiBody;
  delete g.__goeiBody;
  if (!api || typeof api.start !== "function") throw new BodyError("본체를 실행하지 못했어요.");
  if (api.version !== version) throw new BodyError(`본체 판(${api.version})이 플러그인(${version})과 달라요.`);
  return api;
}
var TIMEOUT_MS = 4e4;
function timeout(p, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => t = setTimeout(() => rej(new BodyError(`${what}을 ${TIMEOUT_MS / 1e3}초 안에 받지 못했어요.`)), TIMEOUT_MS))]).finally(() => clearTimeout(t));
}
async function getText(name) {
  const url = `${BASE}/${name}?t=${Date.now()}`;
  const legacy = risuai.risuFetch;
  if (legacy) {
    try {
      const r = await timeout(legacy(url, { method: "GET", plainFetchForce: true, rawResponse: true, headers: { "Content-Type": "text/plain" } }), name);
      if (r?.ok && r.data instanceof Uint8Array) return new TextDecoder().decode(r.data);
    } catch {
    }
  }
  const res = await timeout(risuai.nativeFetch(url, { method: "GET" }), name);
  if (!res.ok) throw new BodyError(`받지 못했어요 (${res.status}).`);
  return String(await timeout(res.text(), name) ?? "");
}
async function fetchBody(version) {
  if (!BASE) throw new BodyError("받을 곳이 정해지지 않았어요.");
  let index = null;
  try {
    index = JSON.parse((await getText("goei-body.json")).replace(/^﻿/, ""));
  } catch {
    throw new BodyError("본체 정보를 받지 못했어요.");
  }
  if (index?.version !== version) throw new BodyError("아직 이 판의 본체가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.");
  if (!Array.isArray(index.parts) || typeof index.length !== "number") throw new BodyError("본체 정보가 올바르지 않아요.");
  let code = "";
  for (const name of index.parts) {
    if (typeof name !== "string" || !/^goei-body\.\d+\.txt$/.test(name)) throw new BodyError("본체 정보가 올바르지 않아요.");
    code += await getText(name);
  }
  if (code.length !== index.length || bodyVersion(code) !== version) throw new BodyError("본체를 끝까지 받지 못했어요.");
  const got = typeof index.sha256 === "string" ? await sha256(code) : null;
  if (got !== null) {
    if (got !== index.sha256) throw new BodyError("받은 본체가 깨져 있어요(sha256). 다시 받아 주세요.");
  } else if (typeof index.hash === "string" && bodyHash(code) !== index.hash) throw new BodyError("받은 본체가 깨져 있어요(hash). 다시 받아 주세요.");
  return code;
}
var sha256 = (code) => sha256Text(code);

// src/core/lorebooks.ts
var DIRECTORY_COMMENT = "Directory";
var MANIFEST_COMMENT = "Plugin manifest";
var OLD_DIRECTORY = "괴이봇 명부";
var OLD_MANIFEST = "괴이봇 플러그인 매니페스트";
function named(lore, name, old) {
  const list = lore ?? [];
  const hit = list.filter((e) => e.comment === name);
  return hit.length ? hit : list.filter((e) => e.comment === old);
}
var directoryEntries = (lore) => named(lore, DIRECTORY_COMMENT, OLD_DIRECTORY);
var manifestEntry = (lore) => named(lore, MANIFEST_COMMENT, OLD_MANIFEST)[0];

// src/loader/card.ts
function isGoeiCard(char) {
  const lore = char?.globalLore;
  const entry = manifestEntry(lore);
  if (entry && typeof entry.content === "string") {
    try {
      if (JSON.parse(entry.content)?.plugin === "goei-plugin") return true;
    } catch {
    }
  }
  return directoryEntries(lore).some((e) => typeof e.content === "string" && /"schema"\s*:\s*1/.test(e.content));
}

// src/loader/panel.ts
var PANEL_CSS = `
.gl-back{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,10,.72);font:14px/1.5 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#E6EEEC;box-sizing:border-box}
.gl-card{display:flex;flex-direction:column;gap:10px;width:min(420px,100%);padding:20px;margin:0;border:1px solid #37464D;border-radius:14px;background:#232D32;box-sizing:border-box}
.gl-card b{font-size:16px}
.gl-card p{margin:0;color:#B5C4C0}
.gl-msg{padding:8px 12px;border-radius:8px;background:#172328;color:#E6EEEC!important}
.gl-act{display:flex;gap:8px;margin-top:6px}
.gl-act button{flex:1;min-height:42px;padding:0 14px;border:1px solid #24343B;border-radius:10px;background:#172328;color:#E6EEEC;font:inherit;font-weight:700;cursor:pointer}
.gl-act button.primary{border-color:#5EEAD4;background:#10302C;color:#5EEAD4}
.gl-act button[disabled]{opacity:.5;cursor:default}
@media (max-width:520px){.gl-back{align-items:flex-end}.gl-act{flex-direction:column}}
`;
var root = null;
function closePanel(keepContainer = false) {
  if (!root) return;
  root.remove();
  root = null;
  if (!keepContainer) void risuai.hideContainer();
}
function showPanel(version, install2, message = "") {
  if (root) return;
  root = document.createElement("div");
  root.innerHTML = `<style>${PANEL_CSS}</style><div class="gl-back"><div class="gl-card" role="dialog" aria-label="괴이 ː ANOMALY">
      <b>괴이 ː ANOMALY</b>
      <p>플러그인 본체를 받지 못했어요. 다시 받거나, 릴리스 zip에 든 goei-body.js를 넣어 주세요. (이어서 세계 자료 goei-data-world.txt 도 창이 뜨면 넣어 주세요)</p>
      <p class="gl-msg" hidden></p>
      <div class="gl-act"><button class="primary" data-gl="get">다시 받기</button><button data-gl="file">파일로 넣기</button><button data-gl="close">닫기</button></div>
    </div></div>`;
  document.body.append(root);
  void risuai.showContainer("fullscreen");
  const msg = root.querySelector(".gl-msg");
  const btns = [...root.querySelectorAll("button")];
  const say = (t) => (msg.hidden = !t, msg.textContent = t);
  if (message) say(message);
  const run = async (get) => {
    btns.forEach((b) => b.disabled = true);
    say("받는 중");
    try {
      const code = await get();
      if (bodyVersion(code) !== version) throw new BodyError(`이 플러그인(${version})과 맞는 goei-body.js가 아니에요.`);
      await install2(code);
    } catch (e) {
      say(e instanceof BodyError ? e.message : `넣지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
      btns.forEach((b) => b.disabled = false);
    }
  };
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".js";
  picker.hidden = true;
  root.append(picker);
  picker.addEventListener("change", () => {
    const f = picker.files?.[0];
    picker.value = "";
    if (f) void run(() => f.text());
  });
  root.addEventListener("click", (ev) => {
    const act = ev.target.closest("[data-gl]")?.dataset.gl;
    if (act === "get") void run(() => fetchBody(version));
    else if (act === "file") picker.click();
    else if (act === "close") closePanel();
  });
}

// src/main.ts
var VERSION = true ? "0.18.2" : "";
var WATCH_MS = 1e3;
var MARKS = ["%%SEED%%", "%%SCENE_CARD:", "%%PHONE_CALL:", "%%GOEI_UNSENT%%", "%%GOEI_START%%", 'data-goei="landing"', "ANOMALY SIMULATION", "[▣"];
var ours = (t) => typeof t === "string" && MARKS.some((m) => t.includes(m));
var body = null;
var loading = null;
var stopped = false;
var failedAt = 0;
var startError = "";
var codeBroken = false;
var link = globalThis;
link.__goeiRelaunch = () => {
  if (!body && !stopped) void ensure(true);
};
async function load(prompt) {
  let code = null;
  let fromStore = false;
  try {
    const saved = await risuai.pluginStorage.getItem(BODY_KEY);
    if (typeof saved === "string" && bodyVersion(saved) === VERSION) code = saved, fromStore = true;
  } catch {
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
  const b = await start(code, prompt);
  if (!b) {
    failedAt = Date.now();
    if (fromStore && codeBroken) await risuai.pluginStorage.removeItem(BODY_KEY).catch(() => {
    });
    if (prompt && !link.__goeiBodyPanel) showPanel(VERSION, install, `본체를 시작하지 못했어요: ${startError}`);
  }
  return b;
}
async function save(code) {
  try {
    await risuai.pluginStorage.setItem(BODY_KEY, code);
  } catch (error) {
    console.log(`[goei] 본체를 저장하지 못했어요 (다음에 다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function start(code, prompt) {
  codeBroken = false;
  let api;
  try {
    api = runBody(code, VERSION);
  } catch (error) {
    codeBroken = true;
    startError = error instanceof Error ? error.message : String(error);
    console.log(`[goei] 본체를 실행하지 못했어요: ${startError}`);
    return null;
  }
  try {
    body = await api.start({ prompt });
    return body;
  } catch (error) {
    startError = error instanceof Error ? error.message : String(error);
    console.log(`[goei] 본체를 시작하지 못했어요: ${startError}`);
    return null;
  }
}
async function install(code) {
  await save(code);
  loading = start(code, true).then((b2) => {
    if (!b2) loading = null;
    return b2;
  });
  const b = await loading;
  if (!b) {
    failedAt = Date.now();
    if (codeBroken) await risuai.pluginStorage.removeItem(BODY_KEY).catch(() => {
    });
    if (link.__goeiBodyPanel) {
      closePanel(true);
      return;
    }
    throw new BodyError(`본체를 시작하지 못했어요: ${startError}`);
  }
  closePanel();
}
function ensure(prompt = false) {
  if (body) return Promise.resolve(body);
  if (!prompt && !loading && Date.now() - failedAt < 6e4) return Promise.resolve(null);
  loading ??= load(prompt).then((b) => {
    if (!b) loading = null;
    return b;
  });
  return loading;
}
async function onBeforeRequest(messages, type) {
  let b = body;
  if (!b) {
    if (type !== "model" || !Array.isArray(messages) || !messages.some((m) => ours(m?.content))) return messages;
    b = await ensure();
    if (!b) return messages;
  }
  try {
    return await b.beforeRequest(messages, type);
  } catch (error) {
    console.log(`[goei] 요청 처리기 실패(표식만 지우고 보냄): ${error instanceof Error ? error.message : String(error)}`);
    try {
      return typeof b.sanitize === "function" ? b.sanitize(messages) : messages;
    } catch {
      return messages;
    }
  }
}
async function onOutput(arg) {
  const b = body ?? (loading ? await loading : null);
  if (b) await b.output(arg);
}
async function onInput(text) {
  return body ? body.input(text) : text;
}
async function onDisplay(text) {
  if (!body && !ours(text)) return text;
  try {
    const b = body ?? await ensure();
    return b ? await b.display(text) : text;
  } catch (error) {
    console.log(`[goei] 메시지 그리기 실패: ${error instanceof Error ? error.message : String(error)}`);
    return text;
  }
}
function watch() {
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
    }
    if (!stopped && !body) setTimeout(() => void tick(), WATCH_MS);
  };
  void tick();
}
void risuai.registerButton({ name: "괴이: ANOMALY 설치·점검", icon: "👻", iconType: "html", location: "hamburger", id: "goei-plugin-install" }, () => {
  void ensure(true).then((b) => b?.install());
}).catch((error) => console.log(`[goei] 설치 단추를 두지 못했어요: ${error instanceof Error ? error.message : String(error)}`));
for (const permission of ["replacer", "mainDom", "sendChat"]) {
  try {
    await risuai.requestPluginPermission(permission);
  } catch {
  }
}
var hook = async (what, f) => {
  try {
    await f();
  } catch (error) {
    console.log(`[goei] ${what} 처리기를 걸지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
};
await hook("요청", () => risuai.addRisuReplacer("beforeRequest", onBeforeRequest));
await hook("응답", () => risuai.addRisuChatListener("output", onOutput));
await hook("표시", () => risuai.addRisuScriptHandler("display", onDisplay));
await hook("입력", () => risuai.addRisuScriptHandler("input", onInput));
watch();
await hook("종료", () => risuai.onUnload(async () => {
  stopped = true;
  delete link.__goeiRelaunch;
  await body?.unload().catch(() => {
  });
  await risuai.removeRisuReplacer("beforeRequest", onBeforeRequest).catch(() => {
  });
  await risuai.removeRisuChatListener("output", onOutput).catch(() => {
  });
  await risuai.removeRisuScriptHandler("display", onDisplay).catch(() => {
  });
  await risuai.removeRisuScriptHandler("input", onInput).catch(() => {
  });
}));
