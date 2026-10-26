// 설정 → 캐릭터 이미지 → 「이미지 지침」 페이지: 지침 틀(글칸), 출력 대상 캐릭터(명부·Image tag 목록에서 켜고 끄기 + 임의 추가), 표정 세트.
// 값은 이 기기 설정(prefs)에 둔다 (core/imgprompt.ts). 메인 모델 지침과 보조 모델 자료가 같은 목록을 쓴다.
import type { ChatContext } from '../host/risu';
import { savePrefs } from '../host/prefs';
import { getPrefs, basicSettings } from '../core/settings';
import { IMG_KEYWORDS_DEFAULT, IMG_PROMPT_DEFAULT, IMG_TEMPLATE_MAX, buildImgPrompt, imgCandidates, imgCharacters, imgPromptConfig } from '../core/imgprompt';
import { playerAgent } from '../core/player';
import { ICONS } from './icons';
import { userInfo } from '../host/user';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const imgUi = { template: null as string | null, extra: '', keywords: null as string | null, info: '', notice: '', preview: false };

export interface ImgEnv { render(): void }

/** 페이지 본문 (settings.ts featurePage 가 머리를 붙인다) */
export function imgPromptPane(ctx: ChatContext): string {
  const cfg = imgPromptConfig(getPrefs());
  const s = basicSettings(ctx.char.globalLore, ctx.chat.scriptstate);
  const me = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  const cands = imgCandidates(ctx.char.globalLore, cfg);
  const off = new Set(cfg.off.map((n) => n.toLowerCase()));
  const picked = imgCharacters(ctx.char.globalLore, cfg, { assetPlayer: s.assetPlayer, playerEnglish: me?.english || undefined, userName: userInfo().name });
  const template = imgUi.template ?? cfg.template;
  const keywords = imgUi.keywords ?? cfg.keywords.join(', ');
  const rows = cands.map((c) => `<label class="ip-name${off.has(c.name.toLowerCase()) ? ' off' : ''}"><input type="checkbox" data-change="ip-toggle" data-key="${esc(c.name)}" ${off.has(c.name.toLowerCase()) ? '' : 'checked'}><span>${esc(c.name)}</span>${c.korean ? `<small>${esc(c.korean)}</small>` : ''}${c.source === 'extra' ? `<button class="gx-mini pp-mini danger" data-action="ip-extra-del" data-value="${esc(c.name)}" title="임의 추가 이름 지우기">지움</button>` : c.source === 'book' ? '<small title="Image tag 로어북 목록 (명부에 없는 이름)">자료</small>' : ''}</label>`).join('');
  const state = !s.assetOn ? '에셋 출력이 꺼져 있어 지침을 넣지 않아요.' : s.assetModel === 'main' ? `메인 모델 요청 끝에 이 지침을 끼워요. 지금 대상 ${picked.length}명.` : `보조 모델이 태그를 붙여요. 이 목록과 표정 세트를 보조 모델 자료에도 써요. 지금 대상 ${picked.length}명.`;
  const preview = imgUi.preview ? `<pre class="ip-preview">${esc(buildImgPrompt(cfg, picked, s.assetPlayer))}</pre>` : '';
  return `<article class="nw-doc pp-doc ip-pane">
    ${imgUi.notice ? `<div class="gx-err" role="alert">${esc(imgUi.notice)}</div>` : ''}
    <p class="ps-note pp-intro">카드 로어북 「Asset」 대신 플러그인이 이 설정으로 지침을 만들어 요청에 넣어요. ${esc(state)} 주인공 이미지 설정(${s.assetPlayer ? 'ON' : 'OFF'})은 캐릭터 이미지 설정에서 바꿔요. 이 기기의 모든 채팅에 같이 적용돼요.</p>
    <section class="ps-group"><h3>지침 틀</h3><p class="ps-note">자리표 <code>{characters}</code> <code>{keywords}</code> 는 아래 목록으로 채워지고, <code>{user_skip}</code> <code>{user_rule}</code> 는 주인공 이미지 설정에 따라 채워져요. 비우면 기본 틀.</p>
      <textarea class="gx-search nw-reqbox ip-template" name="ip-template" data-input="ip-template" rows="14" maxlength="${IMG_TEMPLATE_MAX}">${esc(template)}</textarea>
      <div class="gx-row-btns"><button class="gx-mini ps-save" data-action="ip-template-save" data-take="ip-template">저장</button><button class="gx-mini" data-action="ip-template-reset" title="기본 틀로 되돌려요">기본값</button><button class="gx-mini" data-action="ip-preview">${imgUi.preview ? '미리보기 닫기' : '조립 결과 미리보기'}</button></div>${preview}</section>
    <section class="ps-group"><h3>출력 대상 캐릭터<b>${picked.length}</b></h3><p class="ps-note">명부의 요원 영문명과 Image tag 자료 목록을 자동으로 읽어요. 체크를 풀면 그 인물은 태그를 안 만들어요. 그림 에셋 이름(영문명_표정)과 같아야 해요.</p>
      <div class="ip-names">${rows}</div>
      <div class="ip-extra"><input class="gx-search" data-input="ip-extra" name="ip-extra" maxlength="40" placeholder="임의 추가 (영문명, 예: Avensha)" value="${esc(imgUi.extra)}"><button class="gx-mini ps-save" data-action="ip-extra-add" data-take="ip-extra">추가</button></div></section>
    <section class="ps-group"><h3>표정 세트<b>${cfg.keywords.length}</b></h3><p class="ps-note">쉼표로 나눠요. 카드 그림(영문명_표정)에 있는 이름이어야 해요. 비우면 기본 27종.</p>
      <textarea class="gx-search nw-reqbox" name="ip-keywords" data-input="ip-keywords" rows="3" maxlength="1200">${esc(keywords)}</textarea>
      <div class="gx-row-btns"><button class="gx-mini ps-save" data-action="ip-keywords-save" data-take="ip-keywords">저장</button><button class="gx-mini" data-action="ip-keywords-reset">기본값</button></div></section>
    ${imgUi.info ? `<p class="gx-hint">${esc(imgUi.info)}</p>` : ''}
  </article>`;
}

export function imgInput(name: string, value: string): boolean {
  if (name === 'ip-template') { imgUi.template = value; return true; }
  if (name === 'ip-extra') { imgUi.extra = value; return true; }
  if (name === 'ip-keywords') { imgUi.keywords = value; return true; }
  return false;
}

export async function handleImgPrompt(action: string, value: string | undefined, env: ImgEnv): Promise<boolean> {
  const v = value ?? '';
  imgUi.notice = '';
  switch (action) {
    case 'ip-template-save':
      await savePrefs((p) => ({ ...p, imgPrompt: v.trim() && v.trim() !== IMG_PROMPT_DEFAULT ? v.slice(0, IMG_TEMPLATE_MAX) : undefined }));
      imgUi.template = null;
      imgUi.info = '지침 틀을 저장했어요.';
      env.render();
      return true;
    case 'ip-template-reset':
      await savePrefs((p) => ({ ...p, imgPrompt: undefined }));
      imgUi.template = null;
      imgUi.info = '기본 틀로 되돌렸어요.';
      env.render();
      return true;
    case 'ip-preview':
      imgUi.preview = !imgUi.preview;
      env.render();
      return true;
    case 'ip-toggle': {
      // data-key=이름, value='on' (체크박스) → 끈 목록을 뒤집는다
      const [name] = v.split('=');
      const key = name.trim();
      if (!key) return true;
      await savePrefs((p) => {
        const off = new Set((p.imgNamesOff ?? []).map((n) => n.toLowerCase()));
        const list = off.has(key.toLowerCase()) ? (p.imgNamesOff ?? []).filter((n) => n.toLowerCase() !== key.toLowerCase()) : [...(p.imgNamesOff ?? []), key];
        return { ...p, imgNamesOff: list.length ? list : undefined };
      });
      env.render();
      return true;
    }
    case 'ip-extra-add': {
      const name = v.replace(/[<>"{}_\n]/g, '').trim().slice(0, 40);
      if (!name) { imgUi.notice = '영문명을 적어 주세요.'; env.render(); return true; }
      await savePrefs((p) => ({ ...p, imgNamesExtra: [...new Set([...(p.imgNamesExtra ?? []), name])] }));
      imgUi.extra = '';
      imgUi.info = `「${name}」을 더했어요.`;
      env.render();
      return true;
    }
    case 'ip-extra-del':
      await savePrefs((p) => { const list = (p.imgNamesExtra ?? []).filter((n) => n !== v); return { ...p, imgNamesExtra: list.length ? list : undefined }; });
      env.render();
      return true;
    case 'ip-keywords-save': {
      const list = v.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      const same = list.join(',') === IMG_KEYWORDS_DEFAULT.join(',');
      await savePrefs((p) => ({ ...p, imgKeywords: list.length && !same ? list : undefined }));
      imgUi.keywords = null;
      imgUi.info = `표정 ${list.length ? list.length : IMG_KEYWORDS_DEFAULT.length}종을 저장했어요.`;
      env.render();
      return true;
    }
    case 'ip-keywords-reset':
      await savePrefs((p) => ({ ...p, imgKeywords: undefined }));
      imgUi.keywords = null;
      imgUi.info = '기본 표정 세트로 되돌렸어요.';
      env.render();
      return true;
    default:
      return false;
  }
}
