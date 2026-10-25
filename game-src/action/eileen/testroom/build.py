"""에일린 테스트룸(동작 45개를 키로 직접 조종) 한 파일 HTML을 만든다.
사용: python3 game-src/action/eileen/testroom/build.py → motion_v3/에일린_테스트룸.html"""
import base64, io, json, math
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
 ("16","16","E","뒤 회피"),("16_1","16_1","E","앞 회피"),("17","17","E","막기"),("18","18","E","맞기"),("19","19","E","날아가 쓰러지기"),("19_1","19_1","E","날아가 쓰러지기 (누워 숨)"),
 ("20","20","E","일어나기"),("21","21","E","스턴"),("22","22","E","고유기술 판독"),("23","23","E","충전 모으기"),("24","24","E","충전 방출"),
 ("25","25","E","필살기 증명해"),("26","26","SE","섭취"),("27","27","SE","줍기"),("28","28","SE","응대"),("29","29","SE","말하며 손짓"),
 ("30","30","SE","끄덕이기"),("31","31","SE","고개 젓기"),("32","32","SE","화내기"),("33","33","E","발견 반응"),("34","34","SE","놀라기"),
 ("35","35","SE","기뻐하기"),("36","36","E","도망"),("37","37","E","뒷걸음질"),("37_1","37_1","E","뒷걸음질 반복"),("38","38_SW","SW","엎드려 기기"),("38_1","38_1","SW","엎드려 기기 반복"),("39","39","SE","주저앉기"),
 ("40","40","SE","주저앉아 뒤로 기어나가기"),("41","41","SE","웅크려 떨기"),("42","42","E","네발로 기기"),("42_1","42_1","E","네발로 기기 반복"),
 ("W1","W_1","E","무기 대기"),("22_1","22_1","E","고유기술 제압사격"),
]
CLEAN = {}   # (동작, 장): 왼쪽 몇 px 지우기 — 그림 찌꺼기용
GUN = {"W", "15", "22", "23", "24", "25", "W1", "22_1", "25_1", "25_2"}
def main_mask(im):   # 불투명 픽셀 중 가장 큰 8방향 연결 덩어리
    px = im.load(); W_, H_ = im.size; seen = set(); best = set()
    for y0 in range(H_):
        for x0 in range(W_):
            if px[x0, y0][3] > 40 and (x0, y0) not in seen:
                comp = set(); st = [(x0, y0)]; seen.add((x0, y0))
                while st:
                    x, y = st.pop(); comp.add((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                        if 0 <= nx < W_ and 0 <= ny < H_ and (nx, ny) not in seen and px[nx, ny][3] > 40:
                            seen.add((nx, ny)); st.append((nx, ny))
                if len(comp) > len(best): best = comp
    return best

data = {}
for aid, folder, d, name in LIST:
    fs = sorted((M / folder).glob("[0-9][0-9].png"))
    if not fs: continue   # 아직 안 뽑은 줄(무기 대기 등)
    ims = [Image.open(f).convert("RGBA") for f in fs]
    KEEP_FLASH = GUN   # 사용자 2026-10-24: 총 쏠 때는 그림에 그려진 원래 불꽃을 씀(덧붙이는 이펙트 없음) → 지우지 않음
    if aid in GUN and aid not in KEEP_FLASH:   # 그림에 그려진 총구 불꽃 지우기(불꽃은 코드·VFX가 그림): 노랑·주황·흰 심 색만 지움 — 회색·검정 총구 끝은 남김
        for im in ims:
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b_, a = px[x, y]
                    if a == 0: continue
                    warm = r > 200 and g > 130 and b_ < 100 and x > im.width * 0.55   # 노랑·주황 불꽃(앞쪽만, 피부·머리는 파랑값이 높아 안 걸림)
                    core = r > 235 and g > 225 and b_ > 180 and abs(r - b_) < 60 and y < im.height * 0.75 and x > im.width * 0.55   # 흰 불꽃 심(앞쪽)
                    if warm or core: px[x, y] = (0, 0, 0, 0)
    for im in ims:   # 몸에서 떨어진 작은 점(15px 미만) 지우기 — 무릎 앞 찌꺼기 등
        px = im.load(); W_, H_ = im.size; seen = set()
        for y0 in range(H_):
            for x0 in range(W_):
                if px[x0, y0][3] > 40 and (x0, y0) not in seen:
                    comp = []; st = [(x0, y0)]; seen.add((x0, y0))
                    while st:
                        x, y = st.pop(); comp.append((x, y))
                        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                            if 0 <= nx < W_ and 0 <= ny < H_ and (nx, ny) not in seen and px[nx, ny][3] > 40:
                                seen.add((nx, ny)); st.append((nx, ny))
                    if len(comp) < 15:
                        for x, y in comp: px[x, y] = (0, 0, 0, 0)
    for (cid, fi), xmax in CLEAN.items():   # 그림 가장자리의 떨어진 찌꺼기 지우기
        if cid == aid and fi < len(ims):
            im = ims[fi]; px = im.load()
            for y in range(im.height):
                for x in range(xmax): px[x, y] = (0, 0, 0, 0)
    w, h = ims[0].size
    sheet = Image.new("RGBA", (w * len(ims), h))
    bot, reach, top, mz, foot, cx, flash, ang = [], [], [], [], [], [], [], []
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0))
        bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, w, h)
        flash.append(sum(1 for y in range(h) for x in range(w // 2, w) if (lambda c: c[3] > 0 and c[0] > 200 and c[1] > 130 and c[2] < 100)(im.getpixel((x, y)))) > 20 if aid in GUN else False)
        bot.append(bb[3]); top.append(bb[1]); reach.append(bb[2] - w // 2); cx.append((bb[0] + bb[2]) // 2 - w // 2)
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
            # 총구 = 몸과 이어진 가장 큰 덩어리(불꽃 줄기는 떨어져 있어 빠짐) 안에서, 상체 높이 띠의 가장 앞 무채색(검정·회색) 픽셀
            body = main_mask(im)
            y0, y1 = bb[1] + int((bb[3] - bb[1]) * 0.12), bb[1] + int((bb[3] - bb[1]) * 0.55)
            best = None
            for y in range(y0, y1):
                for x in range(w - 1, -1, -1):
                    c = px[x, y]
                    if (x, y) in body and 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] < 130 and max(c[:3]) - min(c[:3]) < 35:
                        if best is None or x > best[0]: best = (x, y)
                        break
            mz.append([best[0] - w // 2, best[1]] if best else [40, h // 2])
            pts = []
            if best:
                for y in range(max(0, best[1] - 25), min(h, best[1] + 25)):
                    for x in range(max(0, best[0] - 45), best[0] + 1):
                        c = px[x, y]
                        if (x, y) in body and 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] < 110 and max(c[:3]) - min(c[:3]) < 35: pts.append((x, y))
            if len(pts) > 8:   # 기울기 = 공분산/분산
                mxx = sum(p[0] for p in pts) / len(pts); myy = sum(p[1] for p in pts) / len(pts)
                vx = sum((p[0] - mxx) ** 2 for p in pts); cv_ = sum((p[0] - mxx) * (p[1] - myy) for p in pts)
                ang.append(round(math.atan2(cv_ / vx if vx else 0, 1), 3))
            else: ang.append(0)
    buf = io.BytesIO(); sheet.save(buf, "PNG", optimize=True)  # WebP는 일부 앱 보기 화면에서 안 나옴
    data[aid] = dict(name=name, dir=d, n=len(ims), w=w, h=h, bot=bot, top=top, reach=reach, foot=foot, mz=mz, cx=cx, flash=flash, ang=ang, floor=max(bot),
                     src="data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())
# PixelLab VFX(이펙트 그림): vfx/<이름>.png + .json
VFX = {}
for js in sorted((HERE.parent / "vfx").glob("*.json")):
    meta = json.loads(js.read_text())
    png = js.with_suffix(".png").read_bytes()
    VFX[js.stem] = dict(frames=[[f["frame"]["x"], f["frame"]["y"], f["frame"]["w"], f["frame"]["h"], f["duration"]] for f in meta["frames"]],
                        pivot=[(lambda v, n: v / n if v > 1 else v)(meta["frames"][0]["pivot"]["x"], meta["frames"][0]["frame"]["w"]), (lambda v, n: v / n if v > 1 else v)(meta["frames"][0]["pivot"]["y"], meta["frames"][0]["frame"]["h"])],
                        src="data:image/png;base64," + base64.b64encode(png).decode())
html = (HERE / "room.html").read_text(encoding="utf-8").replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False)).replace("/*__VFX__*/null", json.dumps(VFX)).replace("/*__AUDIO__*/", (HERE / "audio.js").read_text(encoding="utf-8"))
out = M / "에일린_테스트룸.html"
out.write_text(html, encoding="utf-8")
print(out, out.stat().st_size // 1024, "KB")
