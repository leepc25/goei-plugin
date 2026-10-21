// 본부 걷는 화면: 엔진 벨트 장면 (게임_통합_규격 2·4장). 장소 자료와 메뉴 창은 본부 모듈(hq/)이 주고, 엔진은 걷기·그리기만 한다.
// 장소마다 벽 색·간판·문, 동료는 플레이어 클립을 색만 바꾼 대역. 문 앞에서 E → 본부 모듈이 그 장소 메뉴 창을 연다.
import type { FloorPlan, PropSpec, StageModule, WorldView } from './contract';
import { SCREEN_H } from './contract';
import { HQ_PLACE, drawFloor, drawWallCrop } from '../art/bg';

export interface HubPlace {
  id: string;
  name: string;
  floor?: string;
  x: number;
  w: number;
  npc?: string | null;
  color?: string;
  open: boolean;
  /** 잠겨 있을 때 보일 조건 */
  opens?: string;
}

const LANE: [number, number] = [440, 690];
const WALL_TOP = 70;

export function makeHub(places: () => HubPlace[], openPlace: (id: string) => void): StageModule {
  let cur: HubPlace[] = [];
  const floor = (): FloorPlan => {
    cur = places();
    const length = Math.max(1280, ...cur.map((p) => p.x + p.w + 40));
    const props: PropSpec[] = [];
    cur.forEach((p, i) => {
      if (!p.open) return;
      props.push({ id: p.id, kind: 'hubdoor', x: p.x + p.w / 2, y: LANE[0], w: Math.min(140, p.w * 0.5), h: 220, label: p.name });
      if (p.npc && p.npc !== '전원') props.push({ id: `npc-${p.id}`, kind: 'npc', x: p.x + p.w * 0.78, y: LANE[0] + 50, w: 50, h: 200, label: p.npc, actor: { hue: (i * 47) % 360, face: -1 } });
    });
    return {
      id: 'hq',
      title: '관리국 본부',
      type: 'hq',
      length,
      lane: LANE,
      startX: (cur.find((p) => p.id === 'office') ?? cur[0])?.x + 120 || 200,
      exitX: Infinity,
      props,
      encounters: [],
      drawBackground(c: CanvasRenderingContext2D, camX: number) {
        const top = LANE[0];
        // 장소마다 벽 (어둡게 = 잠김)
        for (const p of cur) {
          if (p.x + p.w < camX - 40 || p.x > camX + 1320) continue;
          // 배경 그림(art/bg)이 있으면 그 장소 벽, 없으면 단색
          const art = HQ_PLACE[p.id] ? drawWallCrop(c, HQ_PLACE[p.id], p.id, p.x, p.w, top) : false;
          if (!art) {
            c.fillStyle = p.color ?? '#2b343a';
            c.fillRect(p.x, WALL_TOP, p.w, top - WALL_TOP);
          }
          if (!p.open) {
            c.fillStyle = 'rgba(0,0,0,0.55)';
            c.fillRect(p.x, 0, p.w, top);
          }
          c.fillStyle = 'rgba(0,0,0,0.25)';
          c.fillRect(p.x + p.w - 6, WALL_TOP, 26, top - WALL_TOP);
          // 간판
          c.fillStyle = 'rgba(0,0,0,0.45)';
          c.fillRect(p.x + 16, WALL_TOP + 16, p.w - 32, 44);
          c.fillStyle = p.open ? '#ece6d4' : '#6d767b';
          c.font = 'bold 22px sans-serif';
          c.textAlign = 'center';
          c.fillText(p.name, p.x + p.w / 2, WALL_TOP + 46);
          c.font = '15px sans-serif';
          c.fillStyle = '#9aa6ad';
          if (p.floor) c.fillText(p.floor, p.x + p.w / 2, WALL_TOP + 80);
          // 문
          const dw = Math.min(140, p.w * 0.5);
          const dx = p.x + p.w / 2 - dw / 2;
          c.fillStyle = p.open ? 'rgba(20,26,30,0.85)' : 'rgba(10,12,14,0.9)';
          if (!art) c.fillRect(dx, top - 220, dw, 220);
          c.strokeStyle = 'rgba(236,230,212,0.25)';
          c.lineWidth = 3;
          if (!art) c.strokeRect(dx, top - 220, dw, 220);
          if (!p.open) {
            c.fillStyle = '#8e9aa1';
            c.font = '15px sans-serif';
            c.fillText(`잠김 · ${p.opens ?? ''}`, p.x + p.w / 2, top - 100);
          }
          c.textAlign = 'left';
        }
        // 걸레받이와 바닥 (앞뒤 줄 원근)
        const x0 = camX - 40,
          x1 = camX + 1320;
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.fillRect(x0, top - 12, x1 - x0, 12);
        const g = c.createLinearGradient(0, top, 0, SCREEN_H);
        g.addColorStop(0, '#3c4549');
        g.addColorStop(1, '#1a1f22');
        c.fillStyle = g;
        if (!drawFloor(c, 'hq_office', x0, x1, top, SCREEN_H)) c.fillRect(x0, top, x1 - x0, SCREEN_H - top);
        c.strokeStyle = 'rgba(255,255,255,0.06)';
        c.lineWidth = 2;
        for (const y of [top + 40, top + 100, top + 175, top + 250]) {
          c.beginPath();
          c.moveTo(x0, y);
          c.lineTo(x1, y);
          c.stroke();
        }
        const mid = camX + 640;
        for (let x = Math.floor(x0 / 160) * 160; x < x1 + 400; x += 160) {
          c.beginPath();
          c.moveTo(x, top);
          c.lineTo(x + (x - mid) * 0.45, SCREEN_H);
          c.stroke();
        }
      },
      drawForeground(c: CanvasRenderingContext2D, _camX: number, w: WorldView) {
        // 문 앞 안내
        const px = w.player.x;
        const near = cur.find((p) => p.open && Math.abs(p.x + p.w / 2 - px) < 60);
        if (!near) return;
        c.font = 'bold 22px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(px - 110, w.player.y - 300, 220, 36);
        c.fillStyle = '#f0d890';
        c.fillText(`E · ${near.name}`, px, w.player.y - 274);
        c.textAlign = 'left';
      },
    };
  };
  return {
    id: 'hq',
    label: '본부',
    firstFloor: () => floor(),
    nextFloor: () => null,
    onInteract(_api, _floor, prop) {
      if (prop.kind === 'hubdoor') openPlace(prop.id);
    },
  };
}
