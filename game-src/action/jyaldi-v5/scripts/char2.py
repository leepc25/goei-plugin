# PixelLab 기본 길 2단계: 정면 그림으로 캐릭터 등록(v3, 옆 시점, 4방향) → 견본 동작(skeleton-v3, 동쪽만)
import sys,time,re,base64,json
sys.path.insert(0,'.'); import mcp
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' char2 '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
if sys.argv[1]=='create':
    img=base64.b64encode(open('../char/south-721e.png','rb').read()).decode()
    t=mcp.text(mcp.tool('create_character',{'description':'tall slim adult woman government agent, long straight black hair to the waist, pale skin, red eyes, black suit with hip-length open jacket, white shirt, black necktie, black gloves, pistol holster on right hip',
        'name':'Jyaldi','body_type':'humanoid','mode':'v3','reference_image_base64':img,'view':'side','n_directions':4}))
    log('create -> '+t[:300]); print(t[:600]); print(bal())
elif sys.argv[1]=='get':
    print(mcp.text(mcp.tool('get_character',{'character_id':sys.argv[2]}))[:6000])
elif sys.argv[1]=='anim':
    cid=sys.argv[2]
    for tpl in sys.argv[3:]:
        t=mcp.text(mcp.tool('animate_character',{'character_id':cid,'template_animation_id':tpl,'mode':'skeleton-v3','directions':['east']}))
        log(f'anim {tpl} -> '+t[:300]); print(tpl,t[:400],flush=True)
    print(bal())
