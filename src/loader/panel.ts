// 본체를 받지 못했을 때만 뜨는 작은 창: 다시 받기 · 파일로 넣기 · 닫기. 본체 없이 그리므로 스타일을 직접 둔다.
import { bodyVersion, BodyError, fetchBody } from './body';

const CSS = `
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

let root: HTMLElement | null = null;

export function closePanel(): void {
  if (!root) return;
  root.remove();
  root = null;
  void risuai.hideContainer();
}

/** message: 처음부터 보일 까닭 (저장해 둔 본체가 실행되지 않았을 때 등) */
export function showPanel(version: string, install: (code: string) => Promise<void>, message = ''): void {
  if (root) return;
  root = document.createElement('div');
  root.innerHTML = `<style>${CSS}</style><div class="gl-back"><div class="gl-card" role="dialog" aria-label="괴이 ː ANOMALY">
      <b>괴이 ː ANOMALY</b>
      <p>플러그인 본체를 받지 못했어요. 다시 받거나, 릴리스 zip에 든 goei-body.js를 넣어 주세요.</p>
      <p class="gl-msg" hidden></p>
      <div class="gl-act"><button class="primary" data-gl="get">다시 받기</button><button data-gl="file">파일로 넣기</button><button data-gl="close">닫기</button></div>
    </div></div>`;
  document.body.append(root);
  void risuai.showContainer('fullscreen');
  const msg = root.querySelector<HTMLElement>('.gl-msg')!;
  const btns = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const say = (t: string) => ((msg.hidden = !t), (msg.textContent = t));
  if (message) say(message);
  const run = async (get: () => Promise<string>) => {
    btns.forEach((b) => (b.disabled = true));
    say('받는 중');
    try {
      const code = await get();
      if (bodyVersion(code) !== version) throw new BodyError(`이 플러그인(${version})과 맞는 goei-body.js가 아니에요.`);
      await install(code);
    } catch (e) {
      say(e instanceof BodyError ? e.message : `넣지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
      btns.forEach((b) => (b.disabled = false));
    }
  };
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.js';
  picker.hidden = true;
  root.append(picker);
  picker.addEventListener('change', () => {
    const f = picker.files?.[0];
    picker.value = '';
    if (f) void run(() => f.text());
  });
  root.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement).closest<HTMLElement>('[data-gl]')?.dataset.gl;
    if (act === 'get') void run(() => fetchBody(version));
    else if (act === 'file') picker.click();
    else if (act === 'close') closePanel();
  });
}
