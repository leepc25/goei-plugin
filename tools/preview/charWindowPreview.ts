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
  const BASE = [
      { name: '3단 점프', cat: '몸놀림', flavor: '두 번째 점프 뒤에 허공을 한 번 더 밟았다. 물리팀이 아직 조사 중이다.', effect: '점프 +1회(2 → 3), 공중 좌우 이동 +40%', rank: [1, 1], grade: '일반', badge: jump },
      { name: '체 단련', cat: '단련', flavor: '이삿날 사무실 책상을 혼자 옮겼다.', effect: '체 +2. 최대 체력이 늘고 받는 피해가 준다', rank: [2, 3], grade: '희귀', badge: vit },
      { name: '무모함', cat: '특성', flavor: '방패는 바닥에 두고 왔다. 다시 주우러 갈 생각도 없다.', effect: '모든 피해 +20%', cost: '받는 피해 +15%', badge: reck, trait: true },
    ];
  // 스크롤 시험: 같은 견본 뱃지를 되풀이해 14개로
  const many = (window as unknown as { __many?: boolean }).__many;
  // 1판 실제 뱃지(64px 32개 중 앞 12개)로 보기
  const W = window as unknown as { __sheet?: string; __sheetNames?: [string, string, string][] };
  let SHEET: typeof BASE = [];
  if (W.__sheet) {
    const W2 = W as unknown as { __sheetB: string; __sheetG: string };
    const shs = await Promise.all([W2.__sheetB, W.__sheet, W2.__sheetG].map(load)); // 일반 = 동, 희귀 = 은, 특급 = 금
    SHEET = W.__sheetNames!.slice(0, 12).map(([name, eff, flavor], k) => {
      const cv2 = document.createElement('canvas'); cv2.width = 64; cv2.height = 64;
      cv2.getContext('2d')!.drawImage(shs[k % 3], (k % 8) * 64, Math.floor(k / 8) * 64, 64, 64, 0, 0, 64, 64);
      return { name, cat: k < 7 ? '연타' : '강타', flavor, effect: eff, rank: [Math.floor(k / 3) % 3 + 1, 3] as [number, number], grade: (['일반', '희귀', '특급'] as const)[k % 3], badge: cv2 };
    });
  }
  const PERKS = W.__sheet ? SHEET : (window as unknown as { __none?: boolean }).__none ? [] : many ? Array.from({ length: 14 }, (_, n) => BASE[n % 2]) : BASE;
  const draw = () => drawCharWindow(c, {
    name: '쟈알디', team: '종합대응팀 · 부장', state: '출동 중', face, body, hp: 830, maxHp: 1200,
    base: [
      { label: '힘', v: 7, now: 12, what: '몸으로 때리는 기술 피해' }, { label: '민', v: 3, what: '총·투척 피해, 속도' },
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
    perks: PERKS,
    perkSlots: 24, perkPick: (window as unknown as { __sheet?: string }).__sheet ? 7 : 1,
    ...((window as unknown as { __many?: boolean }).__many ? { perkPick: 12 } : {}),
    quick: [{ label: '붕대', count: 3 }, { label: '진통제', count: 1 }], bag: [{ label: '부적', count: 2 }, { label: '손전등', count: 1 }, { label: '열쇠', count: 1 }], bagSlots: 12,
    money: '₩140,000',
  }, tab);
  draw(); setTimeout(() => { draw(); (window as unknown as { __done: boolean }).__done = true; }, 300);
})();
