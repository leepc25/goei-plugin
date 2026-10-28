// 에일린 3D 그리기 (시험, 2026-10-28): 판정·키·이펙트는 테스트룸 코어(core.ts) 그대로 두고, 몸 그림만 3D 모델로 바꾼다.
// 모델: game-pack/eileen-3d/eileen3d.glb (Tripo 모델·뼈대 + Quaternius UAL 무료 동작 38개, gltfpack 압축). 카툰 명암(3단) + 외곽선.
// 따로 둔 WebGL 캔버스에 그린 뒤 게임 2D 화면에 그림 한 장처럼 붙인다(깊이 순서는 엔진 그대로).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';

/** 코어가 넘기는 지금 몸 상태 */
export interface Body3D {
  id: string;
  f: number;
  n: number;
  x: number;
  y: number;
  z: number;
  face: 1 | -1;
  /** 원근 배율 (코어 K(y)): 2D 그림 1px이 화면에서 이만큼 */
  k: number;
  t: number;
  mode: string;
  armed: boolean;
  combat: boolean;
}

/** 3D 동작 (tools/3d/retarget_ual.py, Quaternius UAL CC0). loop = 반복, speed = 재생 배속, hold = 끝 장에서 멈춤 */
type Clip = { a: string; loop?: boolean; speed?: number; hold?: boolean };
const L = (a: string, speed = 1): Clip => ({ a, loop: true, speed });
const O = (a: string, speed = 1, hold = false): Clip => ({ a, speed, hold });
/** 테스트룸 동작 번호 → 3D 동작. 장 번호로 시간을 정하지 않고, 바뀌는 순간 처음부터 원래 속도로 재생하고 섞는다 */
const CLIP: Record<string, Clip> = {
  '1': L('Idle'), '2': L('Idle'), '3': L('PistolIdle'), W: O('PistolReload', 1.6),
  '4': L('Walk'), '37': L('Walk'), '37_1': L('Walk'), '5': L('Sprint'), '13': O('SlideStart', 1.2),
  '6': O('JumpLand', 1.4), '7': L('JumpLoop'), '14': O('Hook', 1.3),
  '9': O('Jab', 1.4), '10': O('Cross', 1.4), '11': O('Hook', 1.3), '12': O('Hook', 1.1),
  '15': L('PistolShoot', 1.3), '15_1': L('PistolShoot', 1.3), '22': L('PistolShoot', 1.6), '23': L('PistolAim'), '24': O('PistolShoot', 1.2), '25': O('Spell', 0.9),
  '16': O('Roll', 1.5), '16_1': O('Roll', 1.5), '17': L('CrouchIdle'),
  '18': O('HitChest', 1.2), '21': L('HitHead'), '19': O('Death', 1.3, true), '20': O('GetUp', 1.3),
  '26': O('Consume'), '27': O('PickUp', 1.2), '28': O('Yes'), '29': L('Talk'), '30': O('Yes'), '31': L('Talk'),
  '39': L('CrouchIdle'), '40': L('CrouchWalk'), '42': L('CrouchWalk'), '42_1': L('CrouchWalk'),
};
/** 모드가 장 번호보다 앞선다 */
const MODE: Record<string, Clip> = { sit: L('SitIdle'), scoot: L('SitIdle'), crouch: L('CrouchIdle'), crawl4: L('CrouchWalk'), flee: L('Sprint'), down: O('Death', 1.3, true), belly: O('Death', 1.3, true) };

const W = 520, H = 560;
/** 모델 키(1단위) → 렌더 캔버스 px. 2D 그림의 몸 키 235px과 맞춘다 */
const PX = 470, BODY = 235;
let ready: {
  r: THREE.WebGLRenderer; fx: OutlineEffect; scene: THREE.Scene; cam: THREE.OrthographicCamera; root: THREE.Object3D;
  mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; current: string; key: string;
  hips: THREE.Object3D | null; hipsY: number;
  yaw: number; lastX: number; lastY: number; lastT: number;
} | null = null;
let failed = false;
export const has3D = () => !!ready;
/** 시험용 끄고 켜기 (F8) */
export const eileen3D = { on: true };

export async function prepareEileen3D(bytes: Uint8Array | null): Promise<void> {
  if (ready || failed || !bytes) return;
  try {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
    r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
    const fx = new OutlineEffect(r, { defaultThickness: 0.0045, defaultColor: [0.09, 0.07, 0.1], defaultAlpha: 1 });
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const g = await loader.parseAsync(buf, '');
    const scene = new THREE.Scene();
    // 카툰 명암: 3단
    const grad = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (/^Icosphere/.test(m.name)) { m.visible = false; return; }
      const old = m.material as THREE.MeshStandardMaterial;
      m.material = new THREE.MeshToonMaterial({ map: old.map ?? null, color: old.map ? 0xffffff : old.color, gradientMap: grad });
      m.frustumCulled = false;
    });
    const root = new THREE.Group(); root.add(g.scene); scene.add(root);
    // 발이 원점에 오게
    const box = new THREE.Box3().setFromObject(g.scene);
    g.scene.position.y -= box.min.y; g.scene.position.x -= (box.min.x + box.max.x) / 2; g.scene.position.z -= (box.min.z + box.max.z) / 2;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0c8, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-1, 2.2, 2); scene.add(sun);
    // 낮은 탑다운: 앞에서 18° 내려다봄. 화면 1px = 1/PX 단위
    const cam = new THREE.OrthographicCamera(-W / 2 / PX, W / 2 / PX, H / PX * 0.86, -H / PX * 0.14, 0.01, 20);
    const el = THREE.MathUtils.degToRad(18);
    cam.position.set(0, Math.sin(el) * 5, Math.cos(el) * 5); cam.lookAt(0, 0, 0);
    // lookAt이 위아래 범위를 비튼다: 시선만 내리고 범위는 그대로 (발 = 아래 14%)
    cam.updateProjectionMatrix();
    const mixer = new THREE.AnimationMixer(g.scene);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const c of g.animations) actions[c.name] = mixer.clipAction(c);
    const hips = g.scene.getObjectByName('mixamorigHips') ?? null;
    ready = { r, fx, scene, cam, root, mixer, actions, current: '', key: '', hips, hipsY: hips ? hips.position.y : 0, yaw: 0, lastX: 0, lastY: 0, lastT: performance.now() };
    addEventListener('keydown', (e) => { if (e.code === 'F8') eileen3D.on = !eileen3D.on; });
  } catch (e) {
    failed = true;
    console.warn('[goei] 에일린 3D 실패, 2D 그림으로', e);
  }
}

/** 이 방향을 보는 모델 회전 (모델 앞 = +X). dx 오른쪽, dz 화면 아래(카메라 쪽) */
const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
const turn = (from: number, to: number, k: number) => { let d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return from + d * k; };

/** 몸을 그린다. 그렸으면 true (코어는 2D 그림을 건너뛴다) */
export function drawEileen3D(ctx: CanvasRenderingContext2D, b: Body3D): boolean {
  const s = ready;
  if (!s || !eileen3D.on) return false;
  const now = performance.now(), dt = Math.min(0.1, (now - s.lastT) / 1000); s.lastT = now;
  let c = MODE[b.mode] ?? CLIP[b.id] ?? L('Idle');
  if (c.a === 'Idle' && b.armed) c = L('PistolIdle');
  if (!s.actions[c.a]) c = L('Idle');
  // 바뀌면 처음부터, 짧게 섞는다 (같은 동작으로 다시 들어온 연타는 다시 재생)
  const key = c.a + ':' + b.id;
  if (key !== s.key) {
    const next = s.actions[c.a], prev = s.actions[s.current];
    next.reset(); next.setLoop(c.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); next.clampWhenFinished = !c.loop;
    next.timeScale = c.speed ?? 1; next.enabled = true; next.setEffectiveWeight(1); next.play();
    if (prev && prev !== next) next.crossFadeFrom(prev, c.loop ? 0.18 : 0.08, false);
    s.current = c.a; s.key = key;
  }
  s.mixer.update(dt);
  // 공중에선 게임이 높이(z)를 준다: 점프 동작의 엉덩이 상승은 빼서 두 번 뜨지 않게
  if (s.hips && (b.mode === 'air' || /^Jump/.test(c.a))) s.hips.position.y = s.hipsY;
  // 방향: 걸으면 걷는 쪽(360°), 서 있으면 마지막 방향, 공격·사격은 좌우 판정 쪽(팔이 보이게 카메라 쪽으로 비스듬히)
  const mx = b.x - s.lastX, my = b.y - s.lastY; s.lastX = b.x; s.lastY = b.y;
  const moving = Math.hypot(mx, my) > 0.4 && Math.hypot(mx, my) < 60;
  const attack = /^(Jab|Cross|Hook|Pistol|Spell|Slide)/.test(c.a);
  const want = attack ? yawOf(b.face, 0.75) : moving ? yawOf(mx, my * 1.6) : s.yaw;
  s.yaw = turn(s.yaw, want, Math.min(1, dt * (attack ? 24 : 12)));
  s.root.rotation.y = s.yaw;
  s.fx.render(s.scene, s.cam);
  const k = b.k * (BODY / PX);
  const dw = W * k, dh = H * k;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.r.domElement, Math.round(b.x - dw / 2), Math.round(b.y - b.z - dh * 0.86), dw, dh);
  ctx.restore();
  return true;
}
