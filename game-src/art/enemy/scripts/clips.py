# 몹별 클립 표 (자동 검사용): SPEC[kind][clip] = (장 수, 발이 땅에 닿은 클립인지)
import os,sys
sys.path.insert(0,os.path.dirname(__file__))
FREE={'air','lie','getup','hang','drop','rise','down','flip','ceiling','shatter','die','break','collapse','emerge','hidden','sit','standup',
      'leap_hit','hop','reveal','grin','hurt','hurt_l','hurt_h','noose_pull','jerk','idle_float'}
FLOAT={'edge','shade','doorhand','wallface','floorhand','specimen_frog','specimen_snake','specimen_jar','crawler','dusty_table','dusty_chair','tv402','predator'}
def build():
    import mobs_h, anim
    S={}
    for k,f in mobs_h.BUILD.items():
        try: m=f()
        except Exception: continue
        S[k]={n:(len(ps),n not in FREE and not n.endswith('_hit') or n in ('walk',)) for n,ps in m.CLIPS.items() if not n.startswith('_')}
        for c in mobs_h.CODE_CLIPS.get(k,[]): S[k][c]=({'turn':3,'rise':3}[c],False)
    for k,name,act,n,mp,src in anim.J:
        S.setdefault(k,{})
        for c,idx in mp.items(): S[k][c]=(len(idx),False)
    S.setdefault('crawler',{})['ceiling']=(4,False)
    return S
SPEC=build()
