// 받기 목록(goei-body.json · goei-data-*.json)의 판이 이 플러그인보다 새 판일 때의 안내 글 (11-14 재검토 D-4, 사용자 답 (가)).
// 올라온 자료가 더 새 판이면 몇 번을 다시 받아도 안 맞으므로 「잠시 뒤 다시」가 아니라 플러그인 업데이트를 안내한다.
// 시작기(loader/body.ts)도 쓰므로 다른 모듈을 끌어오지 않는다 (판 비교는 core/update.ts compareVersions 와 같은 셈)
const VERSION = /^\d+(\.\d+)*$/;

/** 올라온 판(up)이 내 판(mine)보다 새 판이면 안내 글, 아니면(같거나 옛 판·판을 모름) null */
export function oldPluginMessage(mine: string, up: unknown): string | null {
  if (typeof up !== 'string' || !VERSION.test(up) || !VERSION.test(mine)) return null;
  const a = mine.split('.').map(Number);
  const b = up.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d < 0) return null;
    if (d > 0) return `플러그인이 옛 판(v${mine})이에요. 새 판 v${up}가 나왔어요. Risu 설정 → 플러그인에서 업데이트해 주세요.`;
  }
  return null;
}
