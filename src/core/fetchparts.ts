// 조각 받기: 조각을 몇 개씩 동시에 받아 순서대로 붙인다.
// 판이 바뀐 첫 시작에 본체·세계 자료 조각 20여 개를 하나씩 받으면 1분 넘게 걸려서 (v0.21.0 사용자 11-07), 4개씩 동시에 받는다.
export const PART_CONCURRENCY = 4;

export async function fetchParts(names: string[], get: (name: string) => Promise<string>, onDone?: (done: number) => void, limit = PART_CONCURRENCY): Promise<string> {
  const out: string[] = new Array(names.length);
  let next = 0;
  let done = 0;
  let failed = false;
  const worker = async () => {
    // 하나가 실패하면 새 조각은 더 받지 않는다 (이미 받는 중인 것만 끝난다)
    while (next < names.length && !failed) {
      const i = next++;
      try {
        out[i] = await get(names[i]);
      } catch (error) {
        failed = true;
        throw error;
      }
      onDone?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, names.length) }, worker));
  return out.join('');
}
