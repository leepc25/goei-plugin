// 맵 에디터 배포판: tools/mapedit/index.html에 저장소 소품(game-pack/jr-field의 jo_·jc_ 그림)과 기본 캐릭터(에일린 서기)를 넣어
// release/demo/goei-map-editor.html 한 장으로 만든다. 파일로 열어도(인터넷 없이) 저장소 소품을 바로 고를 수 있다.
// 사용: node tools/mapedit/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const LABEL = {
  jo_heolgap_0: '헐값매입 의자', jo_heolgap_1: '헐값매입 의자2', jo_daebak_0: '대박알선 소파', jo_daebak_1: '대박알선 탁자', jo_daebak_2: '대박알선 의자', jo_daebak_3: '대박알선 카운터',
  jo_daebak_4: '포커 의자 황토', jo_daebak_5: '포커 의자 빨강', jo_daebak_6: '포커 의자 갈색', jo_daebak_7: '포커 탁자', jo_daebak_8: '포커 의자 초록',
  jo_jinryo_0: '진료 책상', jo_jinryo_1: '의사 의자', jo_jinryo_2: '환자 의자', jo_jinryo_3: '진료 침대', jo_op_0: '수술 의자',
  jo_songil_0: '손길 접수대', jo_songil_1: '손길 접수 의자', jo_songil_2: '벤치 청록', jo_songil_3: '벤치 상아',
  jo_youngchang_0: '영창 사장 의자', jo_youngchang_1: '영창 책상', jo_youngchang_2: '영창 손님 의자',
  jc_jr_b1_chair: '지하 의자', jc_jr_b1_table: '지하 탁자', jc_jr_b1_bench_1: '지하 벤치1', jc_jr_b1_bench_2: '지하 벤치2', jc_jr_b1_stool_1: '지하 스툴1', jc_jr_b1_stool_2: '지하 스툴2',
  jc_jr_b1_stool_b: '플라스틱 의자 파랑', jc_jr_b1_stool_r: '플라스틱 의자 빨강', jc_jr_b1_cart: '지하 카트', jc_jr_b1_crates: '상자 더미', jc_jr_b1_can: '깡통',
  jc_jr_alley_stool: '골목 의자', jc_jr_alley_stool_b: '골목 의자 파랑', jc_jr_alley_stool_r: '골목 의자 빨강', jc_jr_alley_table: '골목 탁자', jc_jr_alley_cart: '골목 카트',
  jc_jr_alley_cases: '골목 진열장', jc_jr_alley_box: '골목 상자', jc_jr_alley_bin: '골목 쓰레기통',
  jc_jr_b2_chair: 'B2 의자', jc_jr_b2_desk: 'B2 책상', jc_jr_b2_wheelchair: '휠체어', jc_jr_b2_cart: 'B2 카트', jc_jr_b2_gurney: '들것', jc_jr_b2_locker: '사물함', jc_jr_b2_chest: '궤짝', jc_jr_b2_pile: '쌓인 짐',
  jc_jr_heolgap_desk: '옛 감정대', jc_jr_op_table: '수술대', jc_jr_op_cart_l: '수술 카트 왼', jc_jr_op_cart_r: '수술 카트 오른', jc_jr_op_iv: '링거대',
  jc_jr_entry_busstop: '정류장', jc_jr_entry_bin: '거리 쓰레기통',
};
const dir = 'game-pack/jr-field';
const props = readdirSync(dir).filter((f) => /^(jo_|jc_).*\.webp$/.test(f) && LABEL[f.replace('.webp', '')])
  .sort((a, b) => Object.keys(LABEL).indexOf(a.replace('.webp', '')) - Object.keys(LABEL).indexOf(b.replace('.webp', '')))
  .map((f) => ({ file: f.replace('.webp', ''), label: LABEL[f.replace('.webp', '')], url: 'data:image/webp;base64,' + readFileSync(`${dir}/${f}`).toString('base64') }));
// 기본 캐릭터: 에일린 서기 첫 장(128×256)을 잘라 PNG로 (sharp 없이: 원본 webp를 그대로 쓰고 에디터가 첫 장만 자른다)
// 테스트룸 8방향 의자(PixelLab, 1배 = 에일린과 같은 점 크기)
const DIRS = [['south', '남'], ['south-east', '남동'], ['east', '동'], ['north-east', '북동'], ['north', '북'], ['north-west', '북서'], ['west', '서'], ['south-west', '남서']];
// anchor = 바닥 가운데(원본 200칸의 100,171)를 8방향 합집합으로 자른 그림 안 좌표
const chairs = [['c01', 'C01 사무의자', [50, 135]], ['c02', 'C02 기댄 사무의자', [63, 134]]].map(([set, label, anchor]) => ({ set, label, anchor,
  dirs: DIRS.map(([d, k]) => ({ d, k, url: 'data:image/png;base64,' + readFileSync(`game-src/art/objects/chairs/${set}_${d}.png`).toString('base64') })) }));
// Claude가 미리 찍어 둔 장면: game-src/mapedit/<장면>/map.json + 그림 (에디터가 처음부터 연다)
const SCENE_LABEL = { jr_heolgap: '중림 · 헐값매입' };
const mimeOf = (n) => (n.endsWith('.png') ? 'image/png' : n.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
const scenes = readdirSync('game-src/mapedit', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
  const dir = `game-src/mapedit/${d.name}`, map = JSON.parse(readFileSync(`${dir}/map.json`, 'utf8')), files = {};
  for (const f of readdirSync(dir)) if (/\.(png|webp|jpe?g)$/.test(f)) files[f] = `data:${mimeOf(f)};base64,` + readFileSync(`${dir}/${f}`).toString('base64');
  return { id: d.name, label: SCENE_LABEL[d.name] || d.name, map, files };
});
const charUrl = 'data:image/png;base64,' + readFileSync('tools/mapedit/eileen_stand.png').toString('base64');
const html = readFileSync('tools/mapedit/index.html', 'utf8')
  .replace("<script>\n'use strict';", `<script>window.__MAPEDIT_EMBED__ = ${JSON.stringify({ props, chairs, scenes, char: charUrl })};</script>\n<script>\n'use strict';`);
writeFileSync('release/demo/goei-map-editor.html', html);
console.log('release/demo/goei-map-editor.html', (html.length / 1048576).toFixed(1) + 'MB', '소품', props.length, '의자', chairs.length + '×8', '장면', scenes.map((q) => q.id).join(','));
