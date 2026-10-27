// 세계 편집 창 「설치 · 점검」 (설계안 9절): 깡통봇에 플러그인 카드 요소를 심고, 없어진 것을 알려 주고 다시 만든다.
import { installSummary, type InstallState } from '../../core/install';
import { checkInstall, dropWikiPack, installIcon, installLoreAndGreetings, installPictures, installWikiPack, restoreIcon } from '../../host/install';
import type { ChatContext } from '../../host/risu';
import { notifyInstalled } from '../../host/hooks';
import { BRAND } from '../brand';
import { ICONS } from '../icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const mb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`);

type Step = '' | 'all' | 'lore' | 'pictures' | 'icon' | 'wiki' | 'icon-back' | 'wiki-drop';

export const instUi = {
  state: null as InstallState | null,
  iconPrev: '',
  /** 마지막으로 점검한 캐릭터 */
  forChar: -1,
  /** 점검 진행 중 (화면이 다시 그려질 때 두 번 점검하지 않게) */
  pending: false,
  busy: '' as Step,
  /** 로어북·인사말을 심을 때 봇 이름도 BRAND.name 으로 (기본: 아직 괴이 카드가 아닌 봇이면 켬) */
  setName: false,
  progress: '',
  notice: '',
  info: '',
};

export async function refreshInstall(ctx: ChatContext): Promise<void> {
  try {
    const r = await checkInstall(ctx.charIndex);
    if (instUi.forChar !== ctx.charIndex) instUi.setName = !r.state.goei;
    instUi.state = r.state;
    instUi.iconPrev = r.iconPrev;
    instUi.forChar = ctx.charIndex;
  } catch (error) {
    instUi.notice = `점검하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const ok = (b: boolean) => (b ? '<span class="gw-inst-ok">있음</span>' : '<span class="gw-inst-no">없음</span>');

export function installPage(ctx: ChatContext): string {
  const s = instUi.state;
  const busy = !!instUi.busy;
  const btn = (action: string, label: string, primary = false, disabled = false) =>
    `<button class="gx-mini${primary ? ' primary' : ''}" data-action="${action}" ${busy || disabled ? 'disabled' : ''}>${instUi.busy === action.slice(8) ? esc(instUi.progress || '…') : label}</button>`;
  const row = (label: string, status: string, help: string, control: string) =>
    `<div class="ps-row"><div class="ps-label"><b>${label}</b> ${status}<small>${help}</small></div><div class="ps-ctl">${control}</div></div>`;
  if (!s || instUi.forChar !== ctx.charIndex) {
    return `<div class="gw-page"><header class="gw-head"><h2>설치 · 점검</h2></header><p class="gx-muted">점검하는 중…</p></div>`;
  }
  const missing = installSummary(s);
  const name = String(ctx.char.name ?? '이 캐릭터');
  const head = s.goei
    ? missing.length
      ? `<p class="gx-hint">${esc(name)}: 빠진 것 ${missing.length}개 — ${esc(missing.join(' · '))}</p>`
      : `<p class="gx-hint">${esc(name)}: 모두 갖춰져 있어요.</p>`
    : `<p class="gx-hint">${esc(name)}는 아직 괴이 카드가 아니에요. 「전부 설치」를 누르면 이 봇에 설정 폴더·명부·인사말·사진·아이콘·위키 기본 문서를 심어요. 기존 로어북·인사말·에셋은 그대로 두고 덧붙여요.</p>`;
  const loreOk = s.settingsFolder && s.directory && s.manifest && s.wikiFolder && s.greetings.ok;
  return `<div class="gw-page gw-install"><header class="gw-head"><h2>설치 · 점검</h2><p class="gx-muted">플러그인이 카드에 두는 것들이에요. 없어진 것은 다시 만들 수 있어요 (명부는 기본 세계로 비어 있게).</p></header>
    ${head}
    ${instUi.notice ? `<div class="gx-err" role="alert">${esc(instUi.notice)}</div>` : ''}
    ${instUi.info ? `<p class="gx-hint">${esc(instUi.info)}</p>` : ''}
    <div class="gx-row-btns gw-inst-all">${btn('ed-inst-all', '전부 설치 · 빠진 것 채우기', true, s.goei && !missing.length && s.icon)}</div>
    <section class="ps-group"><h3>카드 로어북 · 인사말</h3><div class="ps-rows">
      ${row('⚙️설정 폴더', ok(s.settingsFolder), '명부(Directory)와 Plugin manifest 가 들어가는 폴더. 매니페스트에 적힌 key 로 찾으니 이름은 바꿔도 돼요.', '')}
      ${row('명부 (Directory)', ok(s.directory), '거점·호칭·괴담톡 탭·세계 덧쓰기가 들어가는 카드 데이터. 없으면 기본 세계로 새로 만들어요.', '')}
      ${row('Plugin manifest', ok(s.manifest), '인사말 번호표·사진 목록·폴더 key. 없어도 명부만 있으면 괴이 카드로 인정하지만 시작 화면이 인사말을 못 찾아요.', '')}
      ${row('📖위키 폴더', ok(s.wikiFolder), '위키 탭에서 만든 문서가 들어가는 폴더.', '')}
      ${row('인사말', s.greetings.ok ? `<span class="gw-inst-ok">${s.greetings.total}개</span>` : `<span class="gw-inst-no">${s.greetings.total - s.greetings.missing.length}/${s.greetings.total}개</span>`, '세력·언어·시나리오별 첫 장면 (추가 인사말). 있는 인사말은 그대로 두고 없는 것만 뒤에 붙여요.', btn('ed-inst-lore', loreOk ? '다시 맞추기' : '심기', !loreOk))}
      ${row('봇 이름', name === BRAND.name ? `<span class="gw-inst-ok">${esc(BRAND.name)}</span>` : `<span class="gw-inst-no">${esc(name)}</span>`, `로어북·인사말을 심을 때 봇 이름을 「${BRAND.name}」로 바꿀지. 이름을 그대로 두고 싶으면 끄세요.`, `<button class="gx-chip${instUi.setName ? ' on' : ''}" data-action="ed-inst-name" aria-pressed="${instUi.setName}" ${busy ? 'disabled' : ''}>${esc(BRAND.name)}로</button>`)}
    </div></section>
    <section class="ps-group"><h3>사진 · 아이콘</h3><div class="ps-rows">
      ${row('카드 사진', s.pictures.missing.length ? `<span class="gw-inst-no">${s.pictures.total - s.pictures.missing.length}/${s.pictures.total}장</span>` : `<span class="gw-inst-ok">${s.pictures.total}장</span>`, `요원·괴이·지도·표정 그림. 없는 것만 저장소(release/pic)에서 받아 에셋에 넣어요${s.pictures.missing.length ? ` (약 ${mb(s.pictures.bytes)})` : ''}.`, btn('ed-inst-pictures', '받기', !!s.pictures.missing.length, !s.pictures.missing.length))}
      ${row('아이콘', s.icon ? '<span class="gw-inst-ok">플러그인 아이콘</span>' : '<span class="gw-inst-no">다른 아이콘</span>', '카드 아이콘을 받아 메인으로 둬요. 설치 전 아이콘은 기억해 두니 되돌릴 수 있어요.', `${btn('ed-inst-icon', '우리 아이콘으로', !s.icon, s.icon)}${instUi.iconPrev ? btn('ed-inst-icon-back', '이전 아이콘으로') : ''}`)}
    </div></section>
    <section class="ps-group"><h3>위키 기본 문서</h3><div class="ps-rows">
      ${row('기본 문서 묶음', ok(s.wikiPack), '괴이·요원·조직 위키 문서 수백 개. 카드 대신 플러그인 저장소에 두고 위키 탭이 읽어요 (이 기기 공통, 약 1MB).', `${btn('ed-inst-wiki', s.wikiPack ? '다시 받기' : '받기', !s.wikiPack)}${s.wikiPack ? btn('ed-inst-wiki-drop', '저장소에서 지우기') : ''}`)}
    </div></section>
    <p class="gx-muted">${ICONS.book} 설치 뒤에는 채팅을 다시 열어 주세요. 명부가 비어 있으면 임무판·필드·이동은 쓸 것이 없다고 알려 줘요.</p>
  </div>`;
}

type Env = { render: () => void; refresh: () => Promise<void> };

/** ed-inst-* 동작. 처리했으면 true */
export async function installAction(action: string, ctx: ChatContext, env: Env): Promise<boolean> {
  if (!action.startsWith('ed-inst-')) return false;
  if (instUi.busy) return true;
  if (action === 'ed-inst-name') {
    instUi.setName = !instUi.setName;
    env.render();
    return true;
  }
  const step = action.slice(8) as Step;
  instUi.busy = step;
  instUi.notice = '';
  instUi.info = '';
  instUi.progress = '';
  env.render();
  const progress = (t: string) => {
    instUi.progress = t;
    env.render();
  };
  const done: string[] = [];
  try {
    const s = instUi.state;
    if (step === 'all' || step === 'lore') {
      progress('로어북·인사말 심는 중…');
      await installLoreAndGreetings(ctx.charIndex, instUi.setName ? { name: BRAND.name } : {});
      done.push(instUi.setName ? '로어북·인사말·봇 이름' : '로어북·인사말');
    }
    if (step === 'all' || step === 'pictures') {
      const n = await installPictures(ctx.charIndex, progress);
      if (n) done.push(`사진 ${n}장`);
    }
    if (step === 'all' ? !s?.icon : step === 'icon') {
      await installIcon(ctx.charIndex, progress);
      done.push('아이콘');
    }
    if (step === 'all' ? !s?.wikiPack : step === 'wiki') {
      await installWikiPack(progress);
      done.push('위키 기본 문서');
    }
    if (step === 'icon-back') {
      if (await restoreIcon(ctx.charIndex)) done.push('이전 아이콘');
      else instUi.notice = '기억해 둔 이전 아이콘이 없어요.';
    }
    if (step === 'wiki-drop') {
      await dropWikiPack();
      done.push('위키 기본 문서 지움');
    }
    if (done.length) {
      instUi.info = `${done.join(' · ')} — 끝났어요. 채팅을 다시 열면 반영돼요.`;
      notifyInstalled();
    }
  } catch (error) {
    instUi.notice = error instanceof Error ? error.message : String(error);
  }
  instUi.busy = '';
  instUi.progress = '';
  await env.refresh();
  await refreshInstall(ctx);
  env.render();
  return true;
}
