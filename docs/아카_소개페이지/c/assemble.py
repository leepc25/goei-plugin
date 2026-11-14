# gen_head.py(1차본의 앞부분) + gen_body.py(판면) + gen_tail.py(1차본의 CSS)를 고쳐 gen.py 로 묶는다.
h=open('gen_head.py').read()
h=h.replace("'B-4': ('#D2381E', CREAM), 'B-5': ('#A8221F', CREAM)","'B-4': ('#A5DACB', INK), 'B-5': ('#A8221F', SAND)")
a=h.index('def mark('); b=h.index('def kv(')
h=h[:a]+'''def flr(fl, style):
    bg, fg = FL[fl]
    c = 'rgba(27,19,10,0.13)' if fg == INK else 'rgba(255,176,0,0.16)'
    return f'<div class="flr" data-deco style="color:{c};{style}">{fl}</div>'


def lab(s):
    return s


'''+h[b:]
h+='''

def aflow(fl, items, emc=None):
    bg, fg = FL[fl]
    sub = 'rgba(27,19,10,0.72)' if fg == INK else 'rgba(255,240,210,0.62)'
    o = ''
    for k, v in items:
        o += (f'<div style="margin:0 0 14px 0;"><span style="color:{fg};{G}font-size:19px;font-weight:800;line-height:1.5;word-break:keep-all;">{awk(q(v), emc or fg)}</span>'
              f'<span style="color:{sub};{G}font-size:14px;word-break:keep-all;">&nbsp;&nbsp;{k}</span></div>')
    return o

'''
t=open('gen_tail.py').read()
def rep(a,b):
    global t
    assert a in t, a
    t=t.replace(a,b)
rep(".plate .mark{position:absolute;left:40px;top:40px;display:flex;align-items:center;gap:18px}\n",".plate .flr{position:absolute;font-family:'DungGeunMo',monospace;line-height:1;white-space:nowrap;letter-spacing:0}\n.plate .tag{font-weight:500;opacity:.72;margin-right:14px}\n.plate .k{font-size:34px;font-weight:600;line-height:1.2;opacity:.8}\n")
rep(".plate .band .title{position:absolute;left:40px;top:38px;font-size:92px;",".plate .band .title{position:absolute;left:40px;top:64px;font-size:112px;")
rep(".plate .jang{display:inline-block;width:46px;height:70px;position:relative;vertical-align:-4px}\n.plate .jang b{position:absolute;left:14px;width:18px;height:18px;background:#FFB000}\n.plate .jang b:first-child{top:12px}.plate .jang b:last-child{top:44px}",".plate .jang{display:inline-block;width:56px;height:86px;position:relative;vertical-align:-6px}\n.plate .jang b{position:absolute;left:17px;width:22px;height:22px;background:#FFB000}\n.plate .jang b:first-child{top:16px}.plate .jang b:last-child{top:54px}")
rep(".plate .src{font-size:30px;",".plate .src{font-size:34px;")
rep(".plate .kv .k{font-size:30px;font-weight:600;line-height:1.2;opacity:.8;margin-bottom:8px}",".plate .kv .k{margin-bottom:8px}")
rep(".plate .vrow .k{display:block;font-size:30px;",".plate .vrow .k{display:block;font-size:32px;")
rep(".plate .shot{position:absolute;background-repeat:no-repeat;border-radius:10px;box-shadow:0 0 0 3px rgba(255,230,184,.25)}",".plate .shot{position:absolute;background-repeat:no-repeat}")
open('gen.py','w').write(h+'\n'+open('gen_body.py').read()+'\n'+t)
