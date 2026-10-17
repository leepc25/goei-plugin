// 모바일 하단 바 (v0.16.18, 사용자 설계): 버튼 6개(닫기 포함)를 지금 간격(한 화면에 5개)대로 늘어놓고,
// 좌우로 끌면 끝과 처음이 이어져 계속 돌아간다. 같은 줄을 세 벌 그려 두고, 가운데 벌을 벗어나면
// 한 벌 너비만큼 조용히 되돌린다. 다시 그려도 보던 자리를 지킨다.

/** 한 벌 안에서 몇 번째 칸이 맨 왼쪽인지 (0 = 상황판부터) */
let start = 0;

export function mbarHtml(items: string[]): string {
  const set = items.join('');
  return `<div class="gx-mbar"><div class="gx-mtrack">${set}${set}${set}</div></div>`;
}

export function bindMbar(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>('.gx-mtrack');
  if (!track) return;
  const n = track.children.length / 3;
  const cell = () => (track.firstElementChild as HTMLElement | null)?.offsetWidth || track.clientWidth / 5;
  const setW = () => cell() * n;
  track.scrollLeft = setW() + start * cell();
  let timer: ReturnType<typeof setTimeout> | undefined;
  track.addEventListener('scroll', () => {
    clearTimeout(timer);
    // 끌기가 끝나 멈춘 뒤에만 되돌린다 (도중에 바꾸면 손가락 아래에서 튄다)
    timer = setTimeout(() => {
      const w = setW();
      if (!w) return;
      let x = track.scrollLeft;
      if (x < w * 0.5) x += w;
      else if (x >= w * 1.5) x -= w;
      if (x !== track.scrollLeft) track.scrollLeft = x;
      start = ((Math.round((x - w) / cell()) % n) + n) % n;
    }, 120);
  }, { passive: true });
}
