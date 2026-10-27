// 세계 편집 창 「설치 · 점검」 (설계안 9절): 깡통봇에 플러그인 카드 요소를 심고, 없어진 것을 알려 주고 다시 만든다.
import { installSummary, type InstallState } from '../../core/install';
import { checkInstall, installIcon, installLoreAndGreetings, installPictures, installTokenizer, installWikiPack, restoreIcon } from '../../host/install';
import type { ChatContext } from '../../host/risu';
import { notifyInstalled } from '../../host/hooks';
import { BRAND } from '../brand';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const mb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`);

type Step = '' | 'all' | 'icon-back';

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

const mark = (b: boolean) => (b ? '<span class="gw-inst-ok">✓ 있음</span>' : '<span class="gw-inst-no">✗ 없음</span>');

/** 점검표: 다른 설정 페이지와 같은 줄 모양 (이름·설명 왼쪽, 상태 오른쪽) */
function statusList(s: InstallState): string {
  const li = (ok: boolean, label: string, note: string) => `<div class="ps-row"><div class="ps-label"><b>${label}</b><small>${note}</small></div><div class="ps-ctl">${mark(ok)}</div></div>`;
  const loreOk = s.settingsFolder && s.directory && s.manifest && s.wikiFolder;
  const pics = s.pictures;
  return `<section class="ps-group"><h3>점검</h3><div class="ps-rows gw-inst-list">
    ${li(loreOk, '카드 로어북', loreOk ? '⚙️설정 폴더 · 명부 · Plugin manifest · 📖위키 폴더' : [!s.settingsFolder && '⚙️설정 폴더', !s.directory && '명부(Directory)', !s.manifest && 'Plugin manifest', !s.wikiFolder && '📖위키 폴더'].filter(Boolean).join(' · ') + ' 없음')}
    ${li(s.greetings.ok, '인사말', s.greetings.ok ? `${s.greetings.total}개` : `${s.greetings.total - s.greetings.missing.length}/${s.greetings.total}개`)}
    ${li(!pics.missing.length, '카드 사진', pics.missing.length ? `${pics.total - pics.missing.length}/${pics.total}장 (약 ${mb(pics.bytes)} 받아야 함)` : `${pics.total}장`)}
    ${li(s.icon, '아이콘', s.icon ? '플러그인 아이콘이 메인' : '다른 아이콘')}
    ${li(s.wikiPack, '위키 기본 문서', s.wikiPack ? '저장소에 있음 (이 기기 공통)' : '없음 (약 1MB)')}
    ${li(s.tokenizer, '토크나이저 (o200k_base)', s.tokenizer ? '저장소에 있음 (이 기기 공통). 토큰 수를 정확히 세요' : '없음 (약 2MB). 받기 전엔 토큰 수가 어림값')}
  </div></section>`;
}

export function installPage(ctx: ChatContext): string {
  const s = instUi.state;
  const busy = !!instUi.busy;
  if (!s || instUi.forChar !== ctx.charIndex) {
    return `<div class="gw-page"><header class="gw-head"><h2>설치 · 점검</h2></header><p class="gx-muted">점검하는 중…</p></div>`;
  }
  const missing = installSummary(s);
  const allDone = s.goei && !missing.length && s.icon && s.tokenizer;
  const name = String(ctx.char.name ?? '이 캐릭터');
  const head = s.goei
    ? missing.length
      ? `${esc(name)}: 빠진 것 ${missing.length}개. 오른쪽 단추 하나로 전부 채워요.`
      : `${esc(name)}: 모두 갖춰져 있어요.`
    : `${esc(name)}는 아직 ${esc(BRAND.name)} 카드가 아니에요. 오른쪽 단추 하나로 설정 폴더·명부·인사말·사진·아이콘·위키 기본 문서·토크나이저를 전부 심어요.`;
  const main = busy
    ? `<button class="gx-mini primary" disabled>${esc(instUi.progress || '설치하는 중…')}</button>`
    : allDone
      ? `<button class="gx-mini" data-action="ed-inst-all">다시 점검·맞추기</button>`
      : `<button class="gx-mini primary" data-action="ed-inst-all">${s.goei ? '빠진 것 전부 채우기' : `${esc(BRAND.name)} 설치`}</button>`;
  return `<div class="gw-page gw-set gw-install"><header class="gw-head"><div class="gw-crumb">카드</div><h2>설치 · 점검</h2><div class="gw-head-act">${main}</div>
      <p class="gx-muted">${head} 기존 로어북·인사말·에셋은 그대로 두고 덧붙여요. 사진은 받다 끊겨도 받은 만큼 저장되니 다시 누르면 이어서 받아요.</p></header>
    ${instUi.notice ? `<div class="gx-err" role="alert">${esc(instUi.notice)}</div>` : ''}
    ${instUi.info ? `<p class="gx-hint">${esc(instUi.info)}</p>` : ''}
    <div class="gx-settings gw-setbody">
    ${statusList(s)}
    <section class="ps-group"><h3>세부 선택</h3><div class="ps-rows">
      <div class="ps-row"><div class="ps-label"><b>봇 이름</b><small>설치할 때 봇 이름을 「${esc(BRAND.name)}」로 바꿀지. 지금 이름: ${esc(name)}</small></div><div class="ps-ctl"><div class="gx-segs gx-segs-sm"><button class="gx-seg${instUi.setName ? ' on' : ''}" data-action="ed-inst-name" aria-pressed="${instUi.setName}" ${busy || instUi.setName ? 'disabled' : ''}>바꿈</button><button class="gx-seg${instUi.setName ? '' : ' on'}" data-action="ed-inst-name" aria-pressed="${!instUi.setName}" ${busy || !instUi.setName ? 'disabled' : ''}>그대로</button></div></div></div>
      ${instUi.iconPrev ? `<div class="ps-row"><div class="ps-label"><b>이전 아이콘</b><small>설치 전 아이콘으로 되돌려요 (아이콘 목록에는 둘 다 남아요).</small></div><div class="ps-ctl"><button class="gx-mini" data-action="ed-inst-icon-back" ${busy ? 'disabled' : ''}>이전 아이콘으로</button></div></div>` : ''}
    </div></section>
    <p class="ps-note">설치 뒤 새 채팅을 열면 시작 화면이 떠요. 받은 위키 문서·토크나이저는 「관리 → 백업 · 저장」에서 지울 수 있어요.</p>
    </div>
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
  if (step !== 'all' && step !== 'icon-back') return true;
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
  const failed: string[] = [];
  const run = async (label: string, f: () => Promise<string | null>) => {
    try {
      const r = await f();
      if (r) done.push(r);
    } catch (error) {
      failed.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const s = instUi.state;
  if (step === 'all') {
    // 한 단계가 실패해도 다음 단계로 간다. 끝에 된 것·안 된 것을 한꺼번에 보여 준다
    await run('로어북·인사말', async () => {
      progress('로어북·인사말 심는 중…');
      await installLoreAndGreetings(ctx.charIndex, instUi.setName ? { name: BRAND.name } : {});
      return instUi.setName ? '로어북·인사말·봇 이름' : '로어북·인사말';
    });
    notifyInstalled();
    await run('사진', async () => {
      const n = await installPictures(ctx.charIndex, progress);
      return n ? `사진 ${n}장` : null;
    });
    if (!s?.icon) await run('아이콘', async () => (await installIcon(ctx.charIndex, progress), '아이콘'));
    if (!s?.wikiPack) await run('위키 기본 문서', async () => (await installWikiPack(progress), '위키 기본 문서'));
    if (!s?.tokenizer) await run('토크나이저', async () => (await installTokenizer(progress), '토크나이저'));
  } else if (step === 'icon-back') {
    await run('이전 아이콘', async () => ((await restoreIcon(ctx.charIndex)) ? '이전 아이콘' : null));
  }
  if (done.length) instUi.info = `${done.join(' · ')} — 끝났어요.`;
  else if (!failed.length) instUi.info = '바꿀 것이 없었어요.';
  if (failed.length) instUi.notice = `안 된 것 — ${failed.join(' / ')}. 다시 누르면 안 된 것만 이어서 해요.`;
  instUi.busy = '';
  instUi.progress = '';
  await env.refresh();
  await refreshInstall(ctx);
  env.render();
  return true;
}
