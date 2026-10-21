# 쟈알디 PixelLab 기본 길 시험 시연판: char/anim/*.png -> release/demo/jyaldi-template-test.html
import base64, json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
A = R / 'game-src/action/jyaldi-v5/char/anim'
clips = {'run': 8, 'jab': 3, 'punch': 6}
data = {k: ['data:image/png;base64,' + base64.b64encode((A / f'{k}-{i}.png').read_bytes()).decode() for i in range(n)] for k, n in clips.items()}
html = (R / 'tools/jyaldi_template_test.html').read_text().replace('/*DATA*/null', json.dumps(data))
out = R / 'release/demo/jyaldi-template-test.html'
out.write_text(html)
print(out, len(html))
