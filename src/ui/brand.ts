// 화면에 보이는 봇 이름. 이름을 바꿀 때는 여기만 고친다.
export const BRAND = {
  /** 창 머리·표지 이름 */
  name: '괴이 ː ANOMALY',
  /** 떠 있는 여는 버튼에 마우스를 올렸을 때 */
  fab: '괴이 ː ANOMALY',
};

/** 이름을 색 나눠 그린 HTML: 「괴이」는 글자색, 「ː ANOMALY」는 신호색 (사용자 2026-10-23: 옛 「이면세계」 색을 ANOMALY가 이어받음) */
export function brandHtml(text: string, signal: string): string {
  return `<span style="color:${text}">괴이</span><span style="color:${signal};font-weight:300;margin:0 .3em">ː</span><span style="color:${signal}">ANOMALY</span>`;
}

/** 배포 카드 파일 이름 */
export const CARD_FILE = '괴이_이면세계.charx';
