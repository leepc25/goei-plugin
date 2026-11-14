# ---------- 묶기 ----------
CSS = '''
@font-face{font-family:'DungGeunMo';src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff') format('woff');font-weight:normal;font-style:normal}
body{margin:0;width:860px}
.plate{position:relative;width:860px;overflow:hidden;box-sizing:border-box;background:var(--bg);box-shadow:0 2px 0 var(--bg),0 -2px 0 var(--bg);color:var(--fg);font-family:'IBM Plex Sans KR','Noto Sans KR',sans-serif;letter-spacing:-0.01em}
.plate *{box-sizing:border-box}
.plate .d{font-family:'Black Han Sans','Noto Sans KR',sans-serif;font-weight:400;letter-spacing:-0.015em}
.plate .led{font-family:'DungGeunMo',monospace;color:#FFB000;letter-spacing:0}
.plate .px{image-rendering:pixelated}
.plate .mark{position:absolute;left:40px;top:40px;display:flex;align-items:center;gap:18px}
.plate .ind{display:inline-block;background:#1B130A;color:#FFB000;font-family:'DungGeunMo',monospace;font-size:42px;line-height:1;padding:11px 16px 9px;border-radius:5px}
.plate .mark .nm{font-family:'Black Han Sans';font-size:44px;line-height:1}
.plate .band{position:absolute;left:0;top:0;width:860px;background:#1B130A}
.plate .band .title{position:absolute;left:40px;top:38px;font-size:92px;line-height:1;white-space:nowrap}
.plate .band .ind.big{position:absolute;right:40px;top:34px;font-size:92px;padding:6px 20px 2px;background:#2b2013}
.plate .jang{display:inline-block;width:46px;height:70px;position:relative;vertical-align:-4px}
.plate .jang b{position:absolute;left:14px;width:18px;height:18px;background:#FFB000}
.plate .jang b:first-child{top:12px}.plate .jang b:last-child{top:44px}
.plate .gap{position:absolute;background-repeat:no-repeat;box-shadow:inset 0 0 0 5px #1B130A, inset 22px 0 26px -12px rgba(0,0,0,.7), inset -22px 0 26px -12px rgba(0,0,0,.7)}
.plate .leafline{position:absolute;width:3px;background:rgba(27,19,10,.55)}
.plate .src{font-size:30px;line-height:1.34;font-weight:500;opacity:.8;word-break:keep-all}
.plate .kv .k{font-size:30px;font-weight:600;line-height:1.2;opacity:.8;margin-bottom:8px}
.plate .kv .v{font-family:'Black Han Sans';line-height:1.12;letter-spacing:-0.015em;word-break:keep-all}
.plate s{text-decoration-thickness:.07em;opacity:.62}
.plate b.em{font-weight:inherit;color:#9C1708}
.plate b.plain{font-weight:inherit}
.plate .rule{position:absolute;left:40px;width:780px;height:3px;background:currentColor;opacity:.5}
.plate .panel{position:absolute;right:40px;top:60px;width:330px;height:1130px;background:#1B130A;border-radius:10px;padding:22px 26px;color:#FFF0D2}
.plate .prow{display:flex;align-items:center;gap:18px;height:83.5px}
.plate .btn{display:flex;align-items:center;justify-content:center;flex:none;width:64px;height:64px;border-radius:50%;border:3px solid #6b5327;color:#c79a3c;font-family:'DungGeunMo';font-size:24px}
.plate .btn.lit{background:#FFB000;border-color:#FFB000;color:#1B130A;box-shadow:0 0 18px rgba(255,176,0,.6)}
.plate .pl{font-size:32px;font-weight:700;white-space:nowrap}
.plate .faces{position:absolute;left:0;top:0;width:860px;display:flex;flex-wrap:wrap;background:#1B130A}
.plate .face{display:block;background-repeat:no-repeat;background-color:rgba(255,240,210,.07);box-shadow:inset 0 0 0 1px rgba(0,0,0,.5)}
.plate .vrow{border-top:3px solid rgba(255,230,184,.3);padding:12px 0 16px}
.plate .vrow .k{display:block;font-size:30px;font-weight:500;opacity:.75}
.plate .vrow .v{display:block;font-size:56px;line-height:1.1;color:#FFB000}
.plate .shot{position:absolute;background-repeat:no-repeat;border-radius:10px;box-shadow:0 0 0 3px rgba(255,230,184,.25)}
'''
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">'
        f'<style>{CSS}</style></head><body>\n' + '\n'.join(out) + '\n</body></html>')
open(ROOT + '.scratch/arca/c/page.html', 'w').write(html)
json.dump(USED, open(ROOT + '.scratch/arca/c/used_quotes.json', 'w'), ensure_ascii=False, indent=1)
print('plates', sum('class="plate"' in o for o in out), 'arca', sum('class="arca"' in o for o in out), 'quotes', len(USED))
