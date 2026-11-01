// 통합창 시안 미리보기: node tools/preview/char_window.mjs → 화면 사진
import { drawCharWindow } from '../../src/game/action/ui/charWindow';
import { ensureKit } from '../../src/game/action/ui/kit';
import { FACE_JYALDI } from '../../src/game/action/ui/kit.gen';

const load = (src: string) => new Promise<HTMLImageElement>((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(im); im.src = src; });
(async () => {
  ensureKit();
  const B = (window as unknown as { __badges: Record<string, string> }).__badges;
  const [face, reck, jump, shot, vit, sheet] = await Promise.all([FACE_JYALDI[0], B.reckless, B.triplejump, B.extrashot, B.vitality, B.body].map(load));
  // 평상 대기 첫 장(63×234, 서쪽 보기) → 오른쪽 보게 뒤집기
  const body = document.createElement('canvas'); body.width = 63; body.height = 234;
  { const g = body.getContext('2d')!; g.translate(63, 0); g.scale(-1, 1); g.drawImage(sheet, 0, 0, 63, 234, 0, 0, 63, 234); }
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 400));
  const cv = document.getElementById('c') as HTMLCanvasElement;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#1c2428'; c.fillRect(0, 0, 1280, 720);
  const tab = (window as unknown as { __tab: '능력치' }).__tab;
  const draw = () => drawCharWindow(c, {
    name: '쟈알디', team: '종합대응팀 · 부장', state: '출동 중', face, body, hp: 830, maxHp: 1200,
    base: [
      { label: '힘', v: 7, what: '몸으로 때리는 기술 피해' }, { label: '민', v: 3, what: '총·투척 피해, 속도' },
      { label: '체', v: 6, now: 7, what: '체력, 받는 피해' }, { label: '지', v: 5, what: '이능 기술 피해, 기술 쿨' },
      { label: '정', v: 4, what: '필살 충전, 상태 이상·정신 피해' },
    ],
    derived: [
      { label: '체력', v: '1,100', now: '1,200' }, { label: '근접', v: '116' }, { label: '사격', v: '84' }, { label: '이능', v: '100' },
      { label: '받는 피해', v: '100%', now: '98%' }, { label: '속도', v: '94' }, { label: '기술 쿨', v: '100%' }, { label: '필살 충전', v: '94%' },
    ],
    skills: [
      { key: 'Z', label: '약공', icon: 'punch', name: '약공' }, { key: 'X', label: '강공', icon: 'kick', name: '강공' },
      { key: 'S', label: '충전', icon: 'wave', name: '구역 정리' },
      { key: 'D', label: '고유', icon: 'bolt', name: '근접 폭파' }, { key: 'F', label: '필살', icon: 'star', name: '보면 알아' },
    ],
    pick: { skill: 3, desc: ['장갑을 당겨 끼고 편 손바닥을 내지르면 손바닥 바로 앞 한 점이 터진다.', '맞은 적은 크게 날아가 쓰러진다. 약공 3타 뒤에 쓰면 띄워진 채 날아간다.', '내지르는 동안 슈퍼아머.'], nums: '판정 이능(지) · 쿨 6초 · 앞 0.5~2m' },
    perks: [
      { name: '3단 점프', effect: '공중에서 한 번 더 뛴다', badge: jump },
      { name: '탄 +1', effect: '사격 한 번에 탄 하나 더', badge: shot },
      { name: '단련', effect: '체 +1', badge: vit },
      { name: '무모함', effect: '피해↑ 받는 피해↑', badge: reck, trait: true },
    ],
    perkSlots: 24, perkPick: 0,
    quick: [{ label: '붕대', count: 3 }, { label: '진통제', count: 1 }], bag: [{ label: '부적', count: 2 }, { label: '손전등', count: 1 }, { label: '열쇠', count: 1 }], bagSlots: 12,
    money: '₩140,000',
  }, tab);
  draw(); setTimeout(() => { draw(); (window as unknown as { __done: boolean }).__done = true; }, 300);
})();
