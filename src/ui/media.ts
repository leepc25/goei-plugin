// 폰 화면(아래 바·서랍) 기준 하나. 폭 760px 이하, 또는 손가락 화면에서 짧은 쪽(가로로 든 폰의 높이)이 500px 미만이면 폰 화면.
// 2026-11-06 사용자: 폰을 가로로 들면(844×390) PC 화면으로 나와 줄이 잘리던 것 → 가로도 폰 화면으로. CSS 의 @media 도 같은 글을 쓴다.
export const PHONE_MQ = '(max-width: 760px), (max-height: 499px) and (pointer: coarse)';
export const isPhone = (): boolean => matchMedia(PHONE_MQ).matches;
