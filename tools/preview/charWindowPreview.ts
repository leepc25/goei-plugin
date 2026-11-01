// 통합창 시안 미리보기: node tools/preview/char_window.mjs → 화면 사진
import { drawCharWindow } from '../../src/game/action/ui/charWindow';
import { ensureKit } from '../../src/game/action/ui/kit';
import { FACE_JYALDI } from '../../src/game/action/ui/kit.gen';

const load = (src: string) => new Promise<HTMLImageElement>((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(im); im.src = src; });
(async () => {
  ensureKit();
  const B = (window as unknown as { __badges: Record<string, string> }).__badges;
  const [face, undying, jump, shot, vit] = await Promise.all([FACE_JYALDI[0], B.undying, B.triplejump, B.extrashot, B.vitality].map(load));
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 400));
  const cv = document.getElementById('c') as HTMLCanvasElement;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#1c2428'; c.fillRect(0, 0, 1280, 720);
  const draw = () => drawCharWindow(c, {
    name: '쟈알디', team: '종합대응팀 · 부장', state: '출동 중', face, hp: 690, maxHp: 920,
    stats: [
      { label: '체력', base: '920' }, { label: '피해', base: '1.00', now: '1.10' }, { label: '속도', base: '0.95' },
      { label: '쿨', base: '1.05' }, { label: '받는 피해', base: '1.00' }, { label: '경직', base: '0' },
    ],
    skills: [
      { key: 'Z', label: '약공', icon: 'punch', name: '약공' }, { key: 'X', label: '강공', icon: 'kick', name: '강공' },
      { key: 'C', label: '사격', icon: 'gun', name: '사격', off: true }, { key: 'S', label: '충전', icon: 'wave', name: '구역 정리' },
      { key: 'D', label: '고유', icon: 'bolt', name: '근접 폭파' }, { key: 'F', label: '필살', icon: 'star', name: '보면 알아' },
    ],
    pick: { skill: 4, desc: ['편 손바닥을 내질러 바로 앞 한 점을 터뜨린다.', '맞은 적은 크게 날아가 쓰러진다. 내지르는 동안 슈퍼아머.'], nums: '피해 ×2.4 · 쿨 6초 · 앞 0.5~2m' },
    unique: { name: '보면 알아', effect: '날려 다운시킬 때마다 3초 피해 +10%', badge: undying },
    perks: [
      { name: '3단 점프', effect: '공중에서 한 번 더 뛴다', badge: jump },
      { name: '탄 +1', effect: '사격 한 번에 탄 하나 더', badge: shot },
      { name: '최대 체력 +', effect: '최대 체력 +10%', badge: vit },
    ],
    perkSlots: 10, perkPick: 0,
    quick: [{ label: '붕대', count: 3 }, { label: '진통제', count: 1 }], bag: [{ label: '부적', count: 2 }, { label: '손전등', count: 1 }, { label: '열쇠', count: 1 }], bagSlots: 8,
    money: '₩140,000',
  });
  draw(); setTimeout(() => { draw(); (window as unknown as { __done: boolean }).__done = true; }, 300);
})();
