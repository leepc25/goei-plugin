// 에일린 3D 그리기 (시험, 2026-10-28): 판정·키·이펙트는 테스트룸 코어(core.ts) 그대로 두고, 몸 그림만 3D 모델로 바꾼다.
// 모델: game-pack/eileen-3d/eileen3d.glb (Tripo 모델·뼈대·동작 8개, gltfpack 압축). 카툰 명암(3단) + 외곽선.
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
}

/** 테스트룸 동작 번호 → 3D 동작. loop = 시간으로 돈다, 나머지는 코어의 장 진행률로 [시작초, 끝초] 구간을 고른다 */
const CLIP: Record<string, { a: string; loop?: boolean; span?: [number, number] }> = {
  '1': { a: 'idle', loop: true }, '2': { a: 'idle', loop: true }, '3': { a: 'idle', loop: true }, W: { a: 'idle', loop: true },
  '4': { a: 'walk', loop: true }, '37': { a: 'walk', loop: true }, '37_1': { a: 'walk', loop: true },
  '5': { a: 'run', loop: true }, '13': { a: 'run', loop: true }, '16': { a: 'run', loop: true }, '16_1': { a: 'run', loop: true },
  '6': { a: 'jump', span: [0.9, 1.4] }, '7': { a: 'jump', span: [0.2, 0.9] }, '14': { a: 'slash', span: [0, 0.9] },
  '9': { a: 'slash', span: [0, 0.7] }, '10': { a: 'slash', span: [0.7, 1.4] }, '11': { a: 'slash', span: [1.4, 2.1] }, '12': { a: 'slash', span: [2.1, 3.0] },
  '15': { a: 'shoot', span: [0, 1.0] }, '15_1': { a: 'shoot', span: [0, 1.0] }, '22': { a: 'shoot', span: [0, 1.2] }, '23': { a: 'shoot', span: [0, 0.5] },
  '24': { a: 'shoot', span: [0.5, 1.2] }, '25': { a: 'shoot', span: [0, 2.0] },
  '18': { a: 'hurt', span: [0, 0.8] }, '21': { a: 'hurt', span: [0, 1.2] },
  '19': { a: 'fall', span: [0, 1.6] }, '20': { a: 'fall', span: [1.6, 0] },
};

const W = 520, H = 560;
/** 모델 키(1단위) → 렌더 캔버스 px. 2D 그림의 몸 키 235px과 맞춘다 */
const PX = 470, BODY = 235;
let ready: {
  r: THREE.WebGLRenderer; fx: OutlineEffect; scene: THREE.Scene; cam: THREE.OrthographicCamera; root: THREE.Object3D;
  mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; durs: Record<string, number>; current: string;
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
    const actions: Record<string, THREE.AnimationAction> = {}, durs: Record<string, number> = {};
    for (const c of g.animations) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); actions[c.name] = a; durs[c.name] = c.duration; }
    ready = { r, fx, scene, cam, root, mixer, actions, durs, current: '' };
    addEventListener('keydown', (e) => { if (e.code === 'F8') eileen3D.on = !eileen3D.on; });
  } catch (e) {
    failed = true;
    console.warn('[goei] 에일린 3D 실패, 2D 그림으로', e);
  }
}

/** 몸을 그린다. 그렸으면 true (코어는 2D 그림을 건너뛴다) */
export function drawEileen3D(ctx: CanvasRenderingContext2D, b: Body3D): boolean {
  const s = ready;
  if (!s || !eileen3D.on) return false;
  const c = CLIP[b.id] ?? { a: 'idle', loop: true };
  const name = s.actions[c.a] ? c.a : 'idle';
  if (s.current !== name) {
    for (const [k, a] of Object.entries(s.actions)) a.setEffectiveWeight(k === name ? 1 : 0);
    s.current = name;
  }
  const act = s.actions[name], dur = s.durs[name];
  let time: number;
  if (c.loop) time = b.t % dur;
  else {
    const [a0, a1] = c.span ?? [0, dur], p = b.n > 1 ? b.f / (b.n - 1) : 0;
    time = Math.max(0, Math.min(dur - 0.001, a0 + (a1 - a0) * p));
  }
  act.time = time;
  s.mixer.update(0);
  // Tripo 모델은 +X(화면 오른쪽 옆)를 보고 있다. 남동(카메라 쪽에서 오른쪽으로 55°) = -35°, 남서 = -145°
  s.root.rotation.y = THREE.MathUtils.degToRad(b.face > 0 ? -35 : -145);
  s.fx.render(s.scene, s.cam);
  const k = b.k * (BODY / PX);
  const dw = W * k, dh = H * k;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.r.domElement, Math.round(b.x - dw / 2), Math.round(b.y - b.z - dh * 0.86), dw, dh);
  ctx.restore();
  return true;
}
