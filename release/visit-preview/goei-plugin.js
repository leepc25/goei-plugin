//@name goei-plugin
//@display-name 괴이: 이면세계
//@api 3.0
//@version 0.16.40-visit.1
//@update-url https://raw.githubusercontent.com/leepc25/goei-plugin/codex/run-resume-fix/release/visit-preview/goei-plugin.js
//@description 괴이: 이면세계 전용 플러그인 (괴이봇 2탄 기반): 시작 화면, 상황판, 지도·요원 이동, 커스텀 임무, 괴담넷, 괴담톡, 위키, 설정·캐릭터 이미지
// src/loader/body.ts
var BODY_KEY = "goei:body";
var BASE = true ? "https://raw.githubusercontent.com/leepc25/goei-plugin/codex/run-resume-fix/release/visit-preview" : "";
var BodyError = class extends Error {
};
function bodyVersion(code) {
  return /^\/\/ goei-body (\S+)/.exec(code)?.[1] ?? null;
}
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
async function getText(name) {
  const url = `${BASE}/${name}?t=${Date.now()}`;
  const legacy = risuai.risuFetch;
  if (legacy) {
    try {
      const r = await legacy(url, { method: "GET", plainFetchForce: true, rawResponse: true, headers: { "Content-Type": "text/plain" } });
      if (r?.ok && r.data instanceof Uint8Array) return new TextDecoder().decode(r.data);
    } catch {
    }
  }
  const res = await risuai.nativeFetch(url, { method: "GET" });
  if (!res.ok) throw new BodyError(`받지 못했어요 (${res.status}).`);
  return String(await res.text() ?? "");
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
  for (const name of index.parts) code += await getText(String(name));
  if (code.length !== index.length || bodyVersion(code) !== version) throw new BodyError("본체를 끝까지 받지 못했어요.");
  return code;
}

// src/core/lorebooks.ts
var MANIFEST_COMMENT = "Plugin manifest";
var OLD_MANIFEST = "괴이봇 플러그인 매니페스트";
function named(lore, name, old) {
  const list = lore ?? [];
  const hit = list.filter((e) => e.comment === name);
  return hit.length ? hit : list.filter((e) => e.comment === old);
}
var manifestEntry = (lore) => named(lore, MANIFEST_COMMENT, OLD_MANIFEST)[0];

// src/loader/card.ts
function isGoeiCard(char) {
  const entry = manifestEntry(char?.globalLore);
  if (!entry || typeof entry.content !== "string") return false;
  try {
    return JSON.parse(entry.content)?.plugin === "goei-plugin";
  } catch {
    return false;
  }
}

// src/loader/panel.ts
var CSS = `
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
function closePanel() {
  if (!root) return;
  root.remove();
  root = null;
  void risuai.hideContainer();
}
function showPanel(version, install2) {
  if (root) return;
  root = document.createElement("div");
  root.innerHTML = `<style>${CSS}</style><div class="gl-back"><div class="gl-card" role="dialog" aria-label="괴이 ː 이면세계">
      <b>괴이 ː 이면세계</b>
      <p>플러그인 본체를 받지 못했어요. 다시 받거나, 릴리스 zip에 든 goei-body.js를 넣어 주세요.</p>
      <p class="gl-msg" hidden></p>
      <div class="gl-act"><button class="primary" data-gl="get">다시 받기</button><button data-gl="file">파일로 넣기</button><button data-gl="close">닫기</button></div>
    </div></div>`;
  document.body.append(root);
  void risuai.showContainer("fullscreen");
  const msg = root.querySelector(".gl-msg");
  const btns = [...root.querySelectorAll("button")];
  const say = (t) => (msg.hidden = !t, msg.textContent = t);
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
var VERSION = true ? "0.16.40-visit.1" : "";
var WATCH_MS = 1e3;
var MARKS = ["%%SEED%%", "%%SCENE_CARD:", "%%PHONE_CALL:", "%%GOEI_UNSENT%%", "%%GOEI_START%%", 'data-goei="landing"', "ANOMALY SIMULATION", "[▣"];
var ours = (t) => typeof t === "string" && MARKS.some((m) => t.includes(m));
var body = null;
var loading = null;
var stopped = false;
var failedAt = 0;
async function load(prompt) {
  let code = null;
  try {
    const saved = await risuai.pluginStorage.getItem(BODY_KEY);
    if (typeof saved === "string" && bodyVersion(saved) === VERSION) code = saved;
  } catch {
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
async function start(code) {
  try {
    const api = runBody(code, VERSION);
    body = await api.start();
    return body;
  } catch (error) {
    console.log(`[goei] 본체를 시작하지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
async function install(code) {
  await risuai.pluginStorage.setItem(BODY_KEY, code);
  closePanel();
  loading = start(code);
  await loading;
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
  if (body) return body.beforeRequest(messages, type);
  if (type !== "model" || !Array.isArray(messages) || !messages.some((m) => ours(m?.content))) return messages;
  const b = await ensure();
  return b ? b.beforeRequest(messages, type) : messages;
}
async function onOutput(arg) {
  const b = body ?? (loading ? await loading : null);
  if (b) await b.output(arg);
}
async function onInput(text) {
  return body ? body.input(text) : text;
}
async function onDisplay(text) {
  if (body) return body.display(text);
  if (!ours(text)) return text;
  const b = await ensure();
  return b ? b.display(text) : text;
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
for (const permission of ["replacer", "mainDom", "sendChat"]) {
  try {
    await risuai.requestPluginPermission(permission);
  } catch {
  }
}
await risuai.addRisuReplacer("beforeRequest", onBeforeRequest);
await risuai.addRisuChatListener("output", onOutput);
await risuai.addRisuScriptHandler("display", onDisplay);
try {
  await risuai.addRisuScriptHandler("input", onInput);
} catch {
}
watch();
await risuai.onUnload(async () => {
  stopped = true;
  await body?.unload().catch(() => {
  });
  await risuai.removeRisuReplacer("beforeRequest", onBeforeRequest);
  await risuai.removeRisuChatListener("output", onOutput);
  await risuai.removeRisuScriptHandler("display", onDisplay);
  await risuai.removeRisuScriptHandler("input", onInput).catch(() => {
  });
});
