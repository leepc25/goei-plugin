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
 ("16","16","E","뒤 회피"),("16_1","16_1","E","앞 회피"),("17","17","E","막기"),("18","18","E","맞기"),("19","19","E","날아가 쓰러지기"),
 ("20","20","E","일어나기"),("21","21","E","스턴"),("22","22","E","고유기술 판독"),("23","23","E","충전 모으기"),("24","24","E","충전 방출"),
 ("25","25","E","필살기 증명해"),("26","26","SE","섭취"),("27","27","SE","줍기"),("28","28","SE","응대"),("29","29","SE","말하며 손짓"),
 ("30","30","SE","끄덕이기"),("31","31","SE","고개 젓기"),("32","32","SE","화내기"),("33","33","E","발견 반응"),("34","34","SE","놀라기"),
 ("35","35","SE","기뻐하기"),("36","36","E","도망"),("37","37","E","뒷걸음질"),("38","38_SW","SW","엎드려 기기"),("39","39","SE","주저앉기"),
 ("40","40","SE","주저앉아 뒤로 밀려나기"),("41","41","SE","웅크려 떨기"),("42","42_E","E","네발로 기기"),
]
data = {}
for aid, folder, d, name in LIST:
    fs = sorted((M / folder).glob("[0-9][0-9].png"))
    ims = [Image.open(f).convert("RGBA") for f in fs]
    w, h = ims[0].size
    sheet = Image.new("RGBA", (w * len(ims), h))
    bot, reach, top = [], [], []
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0))
        bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, w, h)
        bot.append(bb[3]); top.append(bb[1]); reach.append(bb[2] - w // 2)
    buf = io.BytesIO(); sheet.save(buf, "PNG", optimize=True)  # WebP는 일부 앱 보기 화면에서 안 나옴
    data[aid] = dict(name=name, dir=d, n=len(ims), w=w, h=h, bot=bot, top=top, reach=reach,
                     src="data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())
html = (HERE / "room.html").read_text(encoding="utf-8").replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False))
out = M / "에일린_테스트룸.html"
out.write_text(html, encoding="utf-8")
print(out, out.stat().st_size // 1024, "KB")
