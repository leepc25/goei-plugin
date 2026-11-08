// 설정 「대전」 페이지 (11-08 사용자): 켜고 끄기(이 기기), 대전 데이터 전부 받기(미리 받아 둔다).
// 데이터·창 띄우기는 host/vs.ts. 켜 두면 PC 에서 유령 단추 밑에 게임패드 단추가 생긴다.
import { getPrefs } from '../core/settings';
import { savePrefs } from '../host/prefs';
import { downloadVsAll, vsDataState, type VsDataState } from '../host/vs';

let rerender = () => {};
export const setVsRender = (f: () => void) => void (rerender = f);
export const vsUi = { busy: false, progress: '', err: '', state: null as VsDataState | null, loading: false };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`;
const row = (label: string, ctl: string, help: string, device = false) =>
  `<div class="ps-row"><div class="ps-label"><b>${label}${device ? '<i class="gx-scope">이 기기</i>' : ''}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${ctl}</div></div>`;

/** 페이지 본문. seg = 설정 페이지의 켬/끔 단추 그리기 */
export function versusGroup(seg: (action: string, cur: string, items: [string, string][], disabled?: boolean) => string): string {
  const render = () => rerender();
  const on = getPrefs().versus === true;
  const s = vsUi.state;
  if (!s && !vsUi.loading) {
    vsUi.loading = true;
    void vsDataState().then((v) => { vsUi.state = v; }, (e) => { vsUi.err = e instanceof Error ? e.message : String(e); }).finally(() => { vsUi.loading = false; render(); });
  }
  const busy = vsUi.busy;
  const btn = (action: string, label: string, primary = false) =>
    `<button class="gx-mini${primary ? ' primary' : ''}" data-action="${action}" ${busy ? 'disabled' : ''}>${esc(label)}</button>`;
  const rows: string[] = [];
  rows.push(row('대전', seg('vs-on', on ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy),
    'PC에서 유령 단추 아래에 게임패드 단추를 표시해요. 누르면 채팅 본문 위에서 대전이 열리고, 다시 누르거나 Esc를 누르면 일시정지 후 닫혀요. 폰에서는 표시하지 않아요.', true));
  const st = !s ? (vsUi.loading ? '확인 중…' : '—') : s.state === 'ready' ? '받음' : s.state === 'partial' ? `${s.done}/${s.total}` : '없음';
  rows.push(row('대전 데이터', `<span class="upd-ver">${esc(st)}</span>${s && s.state !== 'ready' ? btn('vs-get', busy ? vsUi.progress || '받는 중…' : `${s.state === 'partial' ? '이어 받기' : '받기'} (${mb(s.bytes)})`, true) : ''}`,
    '대전 코드·이펙트·인물 얼굴판과 인물 126명(이름 있는 인물 55명, NPC 71명)의 전투 동작이에요. 한 번 받으면 이 기기에 저장돼요. 다 받아야 대전을 열 수 있어요.'));
  if (vsUi.err) rows.push(`<div class="gx-err" role="alert">${esc(vsUi.err)}</div>`);
  return `<section class="ps-group"><h3>대전</h3><div class="ps-rows">${rows.join('')}</div></section>`;
}

export async function handleVersus(action: string, value: string, render: () => void): Promise<boolean> {
  if (!action.startsWith('vs-')) return false;
  if (action === 'vs-on') {
    await savePrefs((p) => ({ ...p, versus: value === '1' ? true : undefined }));
    render();
    return true;
  }
  if (vsUi.busy) return true;
  const run = async (job: (p: (d: number, t: number) => void) => Promise<void>) => {
    vsUi.busy = true; vsUi.err = ''; vsUi.progress = '받는 중…'; render();
    try {
      await job((d, t) => { vsUi.progress = `받는 중 ${d}/${t}`; render(); });
    } catch (e) {
      vsUi.err = e instanceof Error ? e.message : String(e);
    } finally {
      vsUi.busy = false; vsUi.progress = '';
      vsUi.state = await vsDataState().catch(() => vsUi.state);
      render();
    }
  };
  if (action === 'vs-get') await run((p) => downloadVsAll(p));
  return true;
}
