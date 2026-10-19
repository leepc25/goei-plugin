"""Build dependency-free offline HTML and a Risu API 3.0 plugin from the same engine."""
from pathlib import Path
import json,base64,zipfile,gzip,re
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
css=(ROOT/'src/style.css').read_text();meta=json.loads((ROOT/'assets/jyaldi.json').read_text())
atlas='data:image/png;base64,'+base64.b64encode((ROOT/'assets/jyaldi.png').read_bytes()).decode()
parts=[(ROOT/f'src/{n}.js').read_text() for n in ['engine','renderer','app']]
code='\n'.join(parts)
boot='window.JyaldiLab=mountJyaldi(document.getElementById("jy-root"),'+json.dumps(atlas)+','+json.dumps(meta,separators=(',',':'))+');'
html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><title>쟈알디 · 작전 구역</title><style>'+css+'</style></head><body><div id="jy-root"></div><script>'+code.replace('</script','<\\/script')+'\n'+boot+'</script></body></html>'
(OUT/'Jyaldi_ARPG.html').write_text(html)
headers='''//@name jyaldi_arpg_lab
//@display-name 쟈알디 · 액션 RPG
//@api 3.0
//@version 0.9.0
//@description 직접 조작·자동 전투를 전환하는 경량 2D 액션 RPG 시험본. 추가 모델 호출 없음.
'''
wrapper='''
(async function(){
let controller=null,host=null,style=null;
const open=async()=>{
  if(!host){
    document.body.classList.add('jy-in-plugin');
    style=document.createElement('style');style.textContent=CSS;document.head.appendChild(style);
    host=document.createElement('div');host.id='jy-root';document.body.appendChild(host);
    controller=mountJyaldi(host,ATLAS,META,{onClose:async()=>{controller.suspend();await risuai.hideContainer();}});
    controller.suspend();
  }
  await risuai.showContainer('fullscreen');controller.resume();
};
await risuai.registerSetting('쟈알디 · 액션 RPG',open,'◇','html');
if(typeof risuai.onUnload==='function')await risuai.onUnload(async()=>{controller?.destroy();host?.remove();style?.remove();controller=null;host=null;});
})().catch(e=>console.error('[Jyaldi ARPG]',e));
'''
plugin=headers+'\n'+code+'\n'+wrapper.replace('style.textContent=CSS','style.textContent='+json.dumps(css)).replace('mountJyaldi(host,ATLAS,META,','mountJyaldi(host,'+json.dumps(atlas)+','+json.dumps(meta,separators=(',',':'))+',')
(OUT/'Jyaldi_ARPG_Risu.js').write_text(plugin)
size={'standingHeight':meta['nativeHeight'],'uniquePoses':sum(f.get('kind')!='limb' for f in meta['frames']),'limbParts':sum(f.get('kind')=='limb' for f in meta['frames']),'motionDefinitions':len(re.findall(r'\b([a-z_]+):M\(',parts[0])),'paletteColors':meta['colors'],'spritePNGBytes':(ROOT/'assets/jyaldi.png').stat().st_size,'spriteMetadataBytes':(ROOT/'assets/jyaldi.json').stat().st_size,'htmlBytes':len(html.encode()),'pluginBytes':len(plugin.encode()),'pluginGzipBytes':len(gzip.compress(plugin.encode())),'atlasPixels':meta['atlasSize'][0]*meta['atlasSize'][1],'atlasRGBABytes':meta['atlasSize'][0]*meta['atlasSize'][1]*4,'notes':['HTML and plugin contain the same assets; do not add them when calculating deployment size.','RGBA figure is atlas backing data only, not total browser memory.','Plugin file bytes include Base64 overhead.','Backgrounds, enemies and effects are procedural.']}
(OUT/'SIZE_REPORT.json').write_text(json.dumps(size,ensure_ascii=False,indent=2))
readme=f'''쟈알디 · 경량 액션 RPG / 엔진 0.9.0

실행
Jyaldi_ARPG.html: 내려받아 데스크톱 브라우저에서 엽니다. 설치·네트워크 불필요.
Jyaldi_ARPG_Risu.js: 리수 플러그인으로 불러온 뒤 플러그인 설정의 '쟈알디 · 액션 RPG'를 누릅니다.
현재는 독립 시험 플러그인이며 기존 괴이 플러그인에 병합하지 않았습니다.
두 실행본은 같은 데이터를 포함하므로 하나만 사용하면 됩니다.

조작
방향키 / WASD: 벨트스크롤 이동
Shift: 달리기 / Space: 점프 / C: 정지 시 회피, 달리는 중 슬라이드 / V: 방어·정확한 타이밍에 받아넘기기
Z: 연속 공격. 동작 중 다시 누르면 다음 공격으로 연계합니다.
X: 파쇄장. 누르고 있다 놓으면 충전 파쇄장.
Q: 전방 파괴파 / F: 광역 파괴
J: 지면 파괴 / K: 상향 파괴 / U: 후방 파괴
B: 돌진 공격 / L: 백스텝 / N: 슬라이드
Ctrl: 쪼그리기 / Alt+이동: 바라보는 방향을 유지하며 이동
공중 Z: 공중 파쇄장 / 받아넘기기 직후 Z: 반격
충전 중 Escape: 충전 취소
H: 치료제 / E: 가까운 의자·보급함·단말기 상호작용
T: 자동 전투 ON/OFF. 이동 입력 시 직접 조작으로 전환.
P: 일시 정지 / R: 다시 시작
모바일: 방향 패드와 행동 버튼. 달리기는 버튼을 누른 채 이동하며, 슬라이드 버튼도 있습니다.
추가 동작: 화면 아래 메뉴에서 생활·조사·통신·투입·철수 동작을 선택해 실제 현장에서 실행.
연습 모드: 적을 지우고 추가 생성을 중지해 조작·동작 확인에 집중합니다.

이번 수정 (0.9.0)
- 원본 기본 대기를 유지하고 전투/보행/달리기/쪼그림/잽/2타/3타 원화를 교체.
- 독립 시트의 전체 키 정규화 대신, 원본 정수리–턱 축25.30픽셀에 전신 원화의 측정 축을 맞춤.
- 골반 위치를 각 프레임에 수동 지정. 도형 중간 띠에서 골반을 추정하던 처리 제거.
- 걷기 팔꿈치 굽힘과 어깨 반동 수정, 달리기는 기존 다리 자세를 바탕으로 재제작해 행 전환의 크기 불연속 축소.
- 2타는 어깨/상체가 전진하는 스트레이트,3타는 몸을 낮춘 준비→팔을 올린 추진→상체 전진 강타→회수로 교체.
- 쪼그린 이동에 발을 모아 통과시키는 자세를 넣어 반복 순서 수정. 앉기/일어서기 전환도 중간 자세 추가.
- 머리/골반 지정값: assets/v09-landmarks.json. 원화 경로·내장 이미지 생성 원문: ARTWORK_V09_PROMPTS.json.
- Jyaldi_fullbody_review.html에서 기준 대기와 동작을 나란히 재생/정지/반속 비교.

현재 구현
- 여성 쟈알디: 긴 흑발·붉은 눈·검은 바지 정장·흰 셔츠·검은 넥타이·검은 장갑.
- 서 있는 실제 키160픽셀, {size['uniquePoses']}개 고유 자세와 {size['motionDefinitions']}개 동작 정의(전환·공용 자세 조합 포함).
- 직접 조작·자동 전투, 연속 공격·충전 능력·방어·회피·점프.
- 전용8자세 달리기, 거리 기반 보행 위상, 출발·급정지·착지·백스텝·뒷걸음·쪼그려 이동.
- 슬라이드 진입/유지/복귀, 방어 경직·받아넘기기·반격, 지면/상향/후방/공중 파괴.
- 생활·조사·통신·지휘·임무 전환 동작을 공용 자세로 확장. 일부 행동은 소규모 부분 교체 표현입니다.
- 적 공격 준비/판정/경직/처치, 경험치·레벨·치료제·에너지 수집.
- 공용 타일 기반 배경, 3종 적의 공용 도형 리그, 코드 기반 타격·능력 효과와 선택적 합성음.
- 휴식·보급함·단말기, 별도 동작 감상 화면.
- 60Hz 고정 시뮬레이션과 30FPS 기본/60FPS 선택 렌더링을 분리, 화면 비활성·닫기 시 루프 정지, 배경 캐시 최대4청크.

용량
최종 리수 플러그인: {size['pluginBytes']:,}바이트
오프라인 HTML: {size['htmlBytes']:,}바이트
캐릭터 PNG: {size['spritePNGBytes']:,}바이트
자세 메타데이터: {size['spriteMetadataBytes']:,}바이트
아틀라스 RGBA 데이터: {size['atlasRGBABytes']:,}바이트. 브라우저 전체 메모리는 별도입니다.

검증과 범위
Node에서 전투·입력·성장·자동전투 시뮬레이션을 검사했습니다.
네이티브 Canvas2D로 캐릭터 자세·현장·이펙트 렌더링을 검사했습니다.
달리기8자세와 머리 위치 정합, 슬라이드 전환, 사각형 없는 잔상/피격 마스크, 충전 초기화·방어 유지도 회귀 검사했습니다.
실제 Chrome 브라우저에서 키 입력과 표시 상태를 검사합니다. 결과는 browser-validation.json에 기록합니다. 리수 실제 환경은 아직 검증하지 못했습니다.
키보드 달리기→슬라이드, 현장 추가 동작, 연습 모드, 창 숨김·닫기·재개는 모의 DOM/API 계약 검사 범위입니다. 모바일 터치는 실제 기기에서 검증하지 못했습니다.
현재는 한 명의 조작과 반복 구역을 시험하는 엔진 시연이며, 완성된 전체 RPG가 아닙니다.
이전 131클립을 모두 별도 작화로 재현한 패키지는 아닙니다. 지원 동작은 동작 확인 탭에서 확인합니다.
전체 게임·여러 캐릭터의 최종 용량이나 리수 실측 성능을 보증하는 수치가 아닙니다.

원화 제작
내장 이미지 생성으로 여성 쟈알디의 2D 도트 자세를 제작했습니다.
투명 영역 연결 요소로 자세를 추출하고, 시트별 공통 배율로160픽셀 기준을 맞췄습니다.
달리기8자세는 눈 위치 기준으로 정합해 프레임 사이 머리 튀는 현상을 줄였습니다.
64색 공용 팔레트와 투명 PNG 아틀라스로 구성했습니다. 3D 모델은 포함하지 않습니다.
초기 원화 프롬프트는 PROMPTS.json, 새 전신 작화는 ARTWORK_V08_PROMPTS.json에 기록했습니다.

소스
src/engine.js: DOM과 독립된 시뮬레이션·입력·공용 모션
src/renderer.js: Canvas2D·타일·절차적 적/이펙트
src/app.js: 화면·키보드·터치·재생 중지/재개
assets/jyaldi.png, jyaldi.json: 유일한 캐릭터 아틀라스와 기준점
build.py: Python 표준 라이브러리로 실행본 재생성
pack_assets.py: 선택 사항. 원화 시트 재컴파일에는 Pillow/numpy/scipy 필요
tests/: 시뮬레이션·렌더 검사

재빌드: python build.py
시뮬레이션: node tests/simulation.cjs
추가 원화 시트와 통합 스크립트, 통합 전 아틀라스는 소스 ZIP에 포함됩니다. 실행본에는 압축된 최종 아틀라스만 포함합니다.
'''
(OUT/'README_ko.txt').write_text(readme)
with zipfile.ZipFile(OUT/'Jyaldi_ARPG_source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for sub in ['src','assets','tests']:
        for p in sorted((ROOT/sub).glob('*')):
            if p.is_file():z.write(p,p.relative_to(ROOT))
    for n in ['build.py','pack_assets.py','append_motion_assets.py','append_crouch_assets.py','append_v04_assets.py','PROMPTS.json','ARTWORK_V04_PROMPTS.json','ARTWORK_V05_PROMPTS.json','append_v05_assets.py','append_v06_assets.py','ARTWORK_V06_PROMPTS.json','append_v07_assets.py','ARTWORK_V07_PROMPTS.json','append_v08_assets.py','connect_v08.py','review-v08.cjs','build_v08_review.py','make-v08-walk-guide.cjs','make-v08-crouch-guide.cjs','ANIMATION_MODEL_V08.md','ARTWORK_V08_PROMPTS.json','ARTWORK_V09_PROMPTS.json','pack_v09_assets.py','inspect_v09_assets.py','connect_v09.py','make-v09-walk-guide.cjs']:
        p=ROOT/n
        if p.exists():z.write(p,n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v021'/n
        if p.exists():z.write(p,'backup-v021/'+n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v031'/n
        if p.exists():z.write(p,'backup-v031/'+n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v04'/n
        if p.exists():z.write(p,'backup-v04/'+n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v05'/n
        if p.exists():z.write(p,'backup-v05/'+n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v06'/n
        if p.exists():z.write(p,'backup-v06/'+n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v07'/n
        if p.exists():z.write(p,'backup-v07/'+n)
    for n in ['jyaldi.png','jyaldi.json']:
        p=ROOT/'backup-v08'/n
        if p.exists():z.write(p,'backup-v08/'+n)
    for n in ['README_ko.txt','SIZE_REPORT.json','simulation-validation.json','render-validation.json','ui-validation.json','motion-validation.json','artwork-v04-validation.json','artwork-v05-validation.json','artwork-v06-validation.json','v09-registration-validation.json','wholebody-validation.json','artwork-v08-registration.json','browser-validation.json','Jyaldi_fullbody_review.html']:
        p=OUT/n
        if p.exists():z.write(p,n)
print(json.dumps(size,ensure_ascii=False))
