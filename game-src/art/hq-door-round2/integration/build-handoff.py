"""Prepare a reviewable patch, pack staging and inline loader without modifying shared src/."""
import base64,difflib,json,subprocess,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1];REPO=R.parents[2]
BASE='59a2a883c6aca00f8c0e1e5fc2c421a6da770528'
out=R/'integration'; pack=out/'pack';pack.mkdir(exist_ok=True)
keys=['frame','aperture','leaf-left','leaf-right','entry-marker']
inline={}
for key in keys:
    p=R/'layers'/f'{key}.png';shutil.copyfile(p,pack/p.name)
    inline[key]='data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
(pack/'pack.json').write_text(json.dumps({'id':'hq-door-round2','required':True})+'\n',encoding='utf-8')
(out/'pack-inline.js').write_text('window.__GOEI_HQ_DOOR_ROUND2__='+json.dumps(inline)+';\n',encoding='utf-8')
paths={}
hub='src/game/action/engine/hub.ts'
old=subprocess.check_output(['git','show',BASE+':'+hub],cwd=REPO).decode()
new=old.replace("import { blockByProps", "import { drawHqDoorRound2 } from '../art/hqDoorRound2';\nimport { blockByProps",1)
needle="        for (const d of sc.doors) if (!isS(d)) drawDoorN(c, d, sc.look, openOf(d.id), camX);"
assert needle in new
new=new.replace(needle,"""        for (const d of sc.doors) if (!isS(d)) {
          if (sc.id === 'f2' && d.id === 'office' && d.kind === 'glass' &&
              drawHqDoorRound2(c, d.x, openOf(d.id), d.open)) continue;
          drawDoorN(c, d, sc.look, openOf(d.id), camX);
        }""")
paths[hub]=(old,new)
main='src/game/action/main.ts'
old=subprocess.check_output(['git','show',BASE+':'+main],cwd=REPO).decode()
new=old.replace("import { loadArt }", "import { prepareHqDoorRound2 } from './art/hqDoorRound2';\nimport { loadArt }",1)
new=new.replace("  void loadArt(urlOf)", "  const releaseDoorArt = prepareHqDoorRound2(bridge?.assets ? f => bridge.assets!.url('hq-door-round2', f) : undefined);\n  void loadArt(urlOf)",1)
new=new.replace("    dead = true;", "    dead = true;\n    releaseDoorArt();",1)
paths[main]=(old,new)
helper='src/game/action/art/hqDoorRound2.ts'
paths[helper]=('',(out/'hqDoorRound2.ts').read_text(encoding='utf-8'))
patch=''
for path,(old,new) in paths.items():
    patch+=f'diff --git a/{path} b/{path}\n'
    if not old:patch+='new file mode 100644\n'
    patch+=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+path if old else '/dev/null',tofile='b/'+path))
(out/'minimal-integration.patch').write_text(patch.replace('\n \n','\n\n'),encoding='utf-8',newline='\n')
print('Wrote patch and 5-file pack; no engine source modified')
