"""에일린 테스트룸(동작 45개를 키로 직접 조종) 한 파일 HTML을 만든다.
사용: python3 game-src/action/eileen/testroom/build.py → motion_v3/에일린_테스트룸.html"""
import base64, io, json
from pathlib import Path
from PIL import Image

M = Path(__file__).resolve().parents[1] / "motion_v3"
HERE = Path(__file__).resolve().parent
# (id, 폴더, 방향, 이름)
LIST = [
 ("1","1","SE","평상 대기"),("2","2","SE","개인 대기"),("3_0","3_0","E","전투 자세 잡기"),("3","3","E","전투 대기"),
 ("W","W","E","무기 꺼내기"),("4","4","E","걷기"),("5","5","E","뛰기"),("6","6","SE","제자리 점프"),("7","7","E","방향 점프"),
 ("8","8","E","달리다 점프"),("9","9","E","약1 손바닥 올려치기"),("10","10","E","약2 팔뚝 밀치기"),("11","11","E","약3 밀어차기"),
 ("12","12","E","강 뒷발 돌려차기"),("13","13","E","돌진 슬라이딩"),("14","14","E","점프 공격"),("15","15","E","원거리 공격"),
 ("16","16","E","뒤 회피"),("16_1","16_1","E","앞 회피"),("17","17","E","막기"),("18","18","E","맞기"),("19","19","E","날아가 쓰러지기"),("19_1","19_1","SW","날아가 쓰러지기 남서"),
 ("20","20","E","일어나기"),("21","21","E","스턴"),("22","22","E","고유기술 판독"),("23","23","E","충전 모으기"),("24","24","E","충전 방출"),
 ("25","25","E","필살기 증명해"),("26","26","SE","섭취"),("27","27","SE","줍기"),("28","28","SE","응대"),("29","29","SE","말하며 손짓"),
 ("30","30","SE","끄덕이기"),("31","31","SE","고개 젓기"),("32","32","SE","화내기"),("33","33","E","발견 반응"),("34","34","SE","놀라기"),
 ("35","35","SE","기뻐하기"),("36","36","E","도망"),("37","37","E","뒷걸음질"),("37_1","37_1","E","뒷걸음질 반복"),("38","38_SW","SW","엎드려 기기"),("38_1","38_1","SW","엎드려 기기 반복"),("39","39","SE","주저앉기"),
 ("40","40","SE","주저앉아 뒤로 기어나가기"),("41","41","SE","웅크려 떨기"),("42","42_E","E","네발로 기기"),
 ("W1","W_1","E","무기 대기"),("22_1","22_1","E","고유기술 제압사격"),("25_1","25_1","E","필살기 RPG"),
]
CLEAN = {}   # (동작, 장): 왼쪽 몇 px 지우기 — 그림 찌꺼기용
GUN = {"W", "15", "22", "23", "24", "25", "W1", "22_1", "25_1"}
data = {}
for aid, folder, d, name in LIST:
    fs = sorted((M / folder).glob("[0-9][0-9].png"))
    if not fs: continue   # 아직 안 뽑은 줄(무기 대기 등)
    ims = [Image.open(f).convert("RGBA") for f in fs]
    for (cid, fi), xmax in CLEAN.items():   # 그림 가장자리의 떨어진 찌꺼기 지우기
        if cid == aid and fi < len(ims):
            im = ims[fi]; px = im.load()
            for y in range(im.height):
                for x in range(xmax): px[x, y] = (0, 0, 0, 0)
    w, h = ims[0].size
    sheet = Image.new("RGBA", (w * len(ims), h))
    bot, reach, top, mz, foot = [], [], [], [], []
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0))
        bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, w, h)
        bot.append(bb[3]); top.append(bb[1]); reach.append(bb[2] - w // 2)
        px = im.load()
        # 발 = 맨 아래 12줄의 불투명 픽셀 범위(그림자 위치·폭)
        xs = [x for y in range(max(0, bb[3] - 26), bb[3]) for x in range(w) if px[x, y][3] > 40]
        if xs:
            x0, x1 = min(xs), max(xs)
            # 양쪽 발끝 기둥마다 가장 아래 픽셀 → 두 발이 땅에 닿는 높이(앞발이 화면 위쪽이면 그만큼 올림)
            def low(c0, c1):
                ys = [y for x in range(c0, c1 + 1) for y in range(max(0, bb[3] - 26), bb[3]) if px[x, y][3] > 40]
                return max(ys) if ys else bb[3] - 1
            span = max(1, x1 - x0)
            yl, yr = low(x0, x0 + span // 3), low(x1 - span // 3, x1)
            foot.append([(x0 + x1) // 2 - w // 2, span, bb[3] - (yl + yr) / 2, abs(yl - yr) / 2])
        else:
            foot.append([0, 40, 0, 0])
        if aid in GUN:
            # 총구 = 가슴~허리 높이 띠에서 가장 앞(오른쪽) 불투명 픽셀
            best = None
            for y in range(int(h * 0.28), int(h * 0.66)):
                for x in range(w - 1, -1, -1):
                    if px[x, y][3] > 40:
                        if best is None or x > best[0]: best = (x, y)
                        break
            mz.append([best[0] - w // 2, best[1]] if best else [40, h // 2])
    buf = io.BytesIO(); sheet.save(buf, "PNG", optimize=True)  # WebP는 일부 앱 보기 화면에서 안 나옴
    data[aid] = dict(name=name, dir=d, n=len(ims), w=w, h=h, bot=bot, top=top, reach=reach, foot=foot, mz=mz, floor=max(bot),
                     src="data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())
# PixelLab VFX(이펙트 그림): vfx/<이름>.png + .json
VFX = {}
for js in sorted((HERE.parent / "vfx").glob("*.json")):
    meta = json.loads(js.read_text())
    png = js.with_suffix(".png").read_bytes()
    VFX[js.stem] = dict(frames=[[f["frame"]["x"], f["frame"]["y"], f["frame"]["w"], f["frame"]["h"], f["duration"]] for f in meta["frames"]],
                        pivot=[meta["frames"][0]["pivot"]["x"], meta["frames"][0]["pivot"]["y"]],
                        src="data:image/png;base64," + base64.b64encode(png).decode())
html = (HERE / "room.html").read_text(encoding="utf-8").replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False)).replace("/*__VFX__*/null", json.dumps(VFX)).replace("/*__AUDIO__*/", (HERE / "audio.js").read_text(encoding="utf-8"))
out = M / "에일린_테스트룸.html"
out.write_text(html, encoding="utf-8")
print(out, out.stat().st_size // 1024, "KB")
