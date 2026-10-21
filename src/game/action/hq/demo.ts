// 단독 시연판: 본부 → 잼트리 임무 → 브리핑 → 출동(회색 상자 임시 전투) → 귀환·철수·후송 → 정산 → 본부.
// 저장은 IndexedDB 대용(pluginStorage와 같은 슬롯 키). 본편 연동은 가짜 카드(명부 사진 2장 + 상황판의 차원 승강기)로 보여 준다.
import css from './style.css';
import { createHq } from './view';
import { idbSaves } from './store';
import { runMission } from './demo-run';
import type { MainLink } from './link';

declare const __HQ_DEMO_PHOTOS__: Record<string, string>;

const box = document.getElementById('box')!;
const style = document.createElement('style');
style.textContent = css;
document.head.append(style);
const saves = idbSaves();
const link: MainLink = {
  card: async () => ({
    agents: [
      { id: 'P001', name: '쟈알디', english: 'Jyaldi', photo: __HQ_DEMO_PHOTOS__.jyaldi },
      { id: 'P002', name: '에일린', english: 'Aileen', photo: __HQ_DEMO_PHOTOS__.eileen },
    ],
    events: [{ kind: 'an', name: '차원 승강기', loc: '종로구', state: '활성' }],
  }),
  report: async (p) => {
    try {
      await navigator.clipboard.writeText(p.summary);
      return `시연판이라 채팅 대신 클립보드에 복사했어요: ${p.summary}`;
    } catch {
      return `보고서: ${p.summary}`;
    }
  },
};
const hq = createHq();
hq.mount(box, {
  load: () => saves.read(0),
  save: (d) => saves.write(0, d, { title: '자동 저장', summary: `${hq.state.day}일차`, schema: 'goei-hq/1' }),
  saves,
  link,
  deploy: (l) => {
    runMission(box, l, (r) => hq.onReturn(r, l));
  },
});
Object.assign(window, { __hq: hq });
