// 플러그인 창 띄우기. Risu는 창(iframe)을 z-index 1000으로 올리는데, Risu 경고·권한 창은 z-50이라 창 뒤에 깔려 누를 수 없다
// (2026-10-23 사용자: 첫 대사 때 플러그인 경고가 뒤에 떠서 진행이 막힘. Risu 경고는 어디서든 맨 위여야 한다).
// 그래서 창을 띄운 뒤 본 문서의 우리 iframe을 경고 바로 아래(49)로 내린다. 본 문서 권한(mainDom)이 없으면 그대로 둔다.
const BELOW_ALERTS = '49';
let doc: SafeDocument | null | undefined;

export async function showWindow(): Promise<void> {
  // 권한을 묻는 창도 경고라서, 창을 띄우기 전에 물어야 보인다
  if (doc === undefined) doc = await risuai.getRootDocument().catch(() => null);
  await risuai.showContainer('fullscreen');
  if (!doc) return;
  try {
    const frames = await doc.querySelectorAll('body > iframe');
    const n = await frames.length();
    for (let i = 0; i < n; i++) {
      const f = await frames.at(i);
      if (!f) continue;
      if ((await f.getStyle('zIndex')) === '1000' && (await f.getStyle('display')) !== 'none') await f.setStyle('zIndex', BELOW_ALERTS);
    }
  } catch {
    /* 본 문서를 못 만지면 Risu 기본대로 */
  }
}
