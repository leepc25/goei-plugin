// 설정 「대전」 페이지 (11-08 사용자): 켜고 끄기(이 기기), 대전 데이터 전부 받기(미리 받아 둔다).
// 데이터·창 띄우기는 host/vs.ts. 켜 두면 PC 에서 유령 단추 밑에 게임패드 단추가 생긴다.
import { getPrefs } from '../core/settings';
import { savePrefs } from '../host/prefs';
import { downloadVsAll, vsDataState, type VsDataState } from '../host/vs';

/** 대전 배경으로 고를 수 있는 필드 장면 (tools/build_vs_packs.py VS_BGS 와 같은 순서). 이름은 필드 지도(map.ts) 그대로 */
const VS_BG_NAMES: [string, string][] = [
  ['street', '종로 거리'], ['f3', '관리국 3층'], ['b2', '격리 구역'],
  ['training', '훈련장'], ['clinic', '격리팀 사무실'], 
  ['by_street', '강남 거리'], ['by_f13', '백일몽 13층'],
  ['sdra_street', '영등포 거리'],
  ['jr_entry', '중림 지하상가 입구'],
];

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
  // 배경 (11-08 사용자): 필드 장면 그림. 고르면 다음 경기부터 본문 위를 덮는다
  const bg = getPrefs().versusBg ?? '';
  const opts = [['', '사용 안 함'], ...VS_BG_NAMES].map(([v, l]) => `<option value="${v}" ${v === bg ? 'selected' : ''}>${esc(l)}</option>`).join('');
  rows.push(row('배경', `<select class="gx-select" data-change="vs-bg" aria-label="대전 배경" ${busy ? 'disabled' : ''}>${opts}</select>`,
    '경기 화면 뒤에 깔 장면이에요. 사용 안 함이면 배경 없이 채팅 본문 위에서 싸워요. 다음 경기부터 바뀌어요.', true));
  // 화면 크기 (11-08 사용자): 고정 1280×960 / 세로 고정·가로는 창만큼. 둘 다 창이 작으면 같은 비율로 줄인다
  rows.push(row('화면 크기', seg('vs-wide', getPrefs().versusWide ? '1' : '0', [['0', '고정'], ['1', '가로 맞춤']], busy),
    '고정은 1280×960(4:3)이에요. 가로 맞춤은 높이 960을 유지하고 너비를 창에 맞춰 최대 2560까지 늘려요. 체력바는 늘어나지 않아요. 창이 이보다 작으면 같은 비율로 축소해요.', true));
  // 출처 (CC-BY-SA 4.0 은 출처를 보이게 적어야 한다): game-pack/vs-voice/LICENSE.txt
  rows.push(row('출처', '', '아나운서 목소리: MR. HAPPY · DRAGON (VoiceBosch, SoundBiter SFX library), CC-BY-SA 4.0. 배경음악: Final Punch (maxstack, CC-BY-SA 3.0), To the Wire (congusbongus, CC-BY 4.0), Electric Theme (Spring Spring, CC-BY 4.0), Chaos Factory (Mega Pixel Music Lab, CC-BY 4.0). 타격음: CGEffex (CC-BY 3.0), Socapex (CC-BY 3.0), will_leamon (OGA-BY 3.0). 움직임 소리: Vinrax (CC-BY 3.0), remaxim (CC0), leohpaz (CC-BY 4.0). 모두 OpenGameArt.org. 처리한 소리도 원래 조건 그대로예요.'));
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
  if (action === 'vs-wide') {
    await savePrefs((p) => ({ ...p, versusWide: value === '1' ? true : undefined }));
    render();
    return true;
  }
  if (action === 'vs-bg') {
    await savePrefs((p) => ({ ...p, versusBg: value || undefined }));
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
