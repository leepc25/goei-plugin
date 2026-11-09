// 눌러 보기 전수점검 · 「업데이트 있음」·점검 탭(update) 묶음 시작 상태 (2026-11-09)
// 기본 makeBase 상태 위에:
//  1) 받기 흉내(window.__files)에 지금 판보다 높은 version.json 과 card-update.json(통째 payload, 판 올림)을 넣는다
//     → 설정 → 점검 → 업데이트 페이지에 「→ v다음판」·「카드 업데이트 준비」·「카드에 적용」, 상황판 위 「새 버전이 있어요」 띠가 나온다.
//     window.__files 는 누를 때마다 새 페이지(hostScript)가 다시 만들므로, 이 틀이 쓰는 browser.newPage 를 감싸
//     hostScript 를 붙일 때(addScriptTag 내용에 `window.__files =` 가 있을 때) 뒤에 덧붙이는 글로 넣는다. 앱 코드·도구 코드는 손대지 않는다.
//  2) 같은 새 페이지마다: 저장·불러오기의 가져오기 글칸이 비어 있으면 사람이 붙여 넣은 것처럼 JSON 한 줄을 넣어 「적용」이 켜지게 하고,
//     「파일 올리기」가 띄우는 파일 고르기에는 JSON 파일 하나를 골라 준다 (man-import·man-import-yes·파일 올리기가 눌리게).
//  3) 아이콘 기록(goei:icon)에 「설치 전 아이콘」을 적어 설치 · 점검에 「이전 아이콘으로」 단추가 나오게 한다.
//  CA_UPD_MODE=notlite : 카드에서 Plugin manifest 를 빼고(연결 안 됨 화면 → 「설치 · 점검 열기」= install-open) 설치 자료(goei-data-install)를
//     저장소·받기 흉내에서 빼서 점검이 실패하게 한다 (→ 「다시 점검」= ed-inst-recheck).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODE = process.env.CA_UPD_MODE || 'update';
const bump = (v) => { const p = String(v).split('.').map((x) => Number(x) || 0); p[2] = (p[2] ?? 0) + 1; return p.join('.'); };

function extraFiles() {
  const cur = JSON.parse(readFileSync(resolve(ROOT, 'release/version.json'), 'utf8'));
  const NEW = bump(cur.plugin);
  const idx = JSON.parse(readFileSync(resolve(ROOT, 'release/card-update.json'), 'utf8'));
  const text = (idx.parts || []).map((n) => readFileSync(resolve(ROOT, 'release', n), 'utf8')).join('');
  const payload = JSON.parse(text);
  payload.version = NEW;
  for (const e of payload.data.globalLore) {
    if (e.comment !== 'Plugin manifest') continue;
    try { const m = JSON.parse(e.content); m.version = NEW; e.content = JSON.stringify(m); } catch { /* 그대로 */ }
  }
  return { NEW, files: { 'version.json': { card: NEW, plugin: NEW, minPlugin: cur.minPlugin ?? cur.plugin }, 'card-update.json': payload } };
}

const IMPORT_JSON = JSON.stringify({ editorWidth: 80, theme: 'dark' });

/** hostScript 뒤에 덧붙이는 글: 받기 흉내 파일 더하기 + 가져오기 글칸 채우기 */
function tail(files) {
  return `
;(() => {
  Object.assign(window.__files, ${JSON.stringify(files)});
  ${MODE === 'notlite' ? "for (const k of Object.keys(window.__files)) if (k.startsWith('goei-data-install')) delete window.__files[k];" : ''}
  new MutationObserver(() => {
    const t = document.querySelector('textarea[data-input="man-import-text"]');
    if (t && !t.value && !window.__caImportFilled) { window.__caImportFilled = 1; t.value = ${JSON.stringify(IMPORT_JSON)}; t.dispatchEvent(new Event('input', { bubbles: true })); }
  }).observe(document.documentElement, { subtree: true, childList: true });
})();`;
}

export default async (page, { kind, vp, log, sleep }) => {
  const { NEW, files } = extraFiles();
  const browser = page.context().browser();
  if (browser && !browser.__caUpdHooked) {
    browser.__caUpdHooked = true;
    const orig = browser.newPage.bind(browser);
    browser.newPage = async (...a) => {
      const p = await orig(...a);
      const add = p.addScriptTag.bind(p);
      p.addScriptTag = (o) => (o && typeof o.content === 'string' && o.content.includes('window.__files =') ? add({ ...o, content: o.content + tail(files) }) : add(o));
      p.on('filechooser', (fc) => { fc.setFiles({ name: 'goei-settings-test.json', mimeType: 'application/json', buffer: Buffer.from(IMPORT_JSON) }).catch(() => {}); });
      return p;
    };
  }
  await page.evaluate(([files, mode]) => {
    Object.assign(window.__files, files);
    // 설치 전 아이콘 기록 → 설치 · 점검에 「이전 아이콘으로」
    const id = String(window.__char.chaId ?? window.__char.name ?? '');
    window.__store['p:goei:icon'] = JSON.stringify({ [id]: { ours: String(window.__char.image ?? ''), prev: 'assets/prev-icon.png' } });
    if (mode === 'notlite') {
      window.__char.globalLore = (window.__char.globalLore || []).filter((e) => e.comment !== 'Plugin manifest');
      delete window.__store['p:goei:data-install'];
      for (const k of Object.keys(window.__files)) if (k.startsWith('goei-data-install')) delete window.__files[k];
    }
  }, [files, MODE]);
  await sleep(100);
  log(`update start-mod(${kind}, ${vp}, ${MODE}): 새 판 v${NEW} 받기 흉내·가져오기 글칸 채우기·이전 아이콘 기록${MODE === 'notlite' ? ' · 매니페스트·설치 자료 뺌' : ''}`);
};
