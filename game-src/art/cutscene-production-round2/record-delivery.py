from pathlib import Path
import json,hashlib,datetime
R=Path(__file__).resolve().parent
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
p=json.loads((R/'plan.json').read_text(encoding='utf-8-sig'))
p.update(status='produced-for-visual-review',generationCalls=1,chargedGenerations=1,blockers=[],generatedFrames=[f'frames/source/{i:04d}.png' for i in range(17)])
p['design'].update(generatedAnimationFrames=0,inputFramesReturnedByAPI=0,frameCount=17,animationMethod='integer translation of shared new door layers',note='17 distinct composites; AI animation not submitted; no duplicated frames')
p['doorStandard'].update(thresholdSourceY=156,openingSourceRect=[188,31,80,125],status='shared new door source; user visual approval pending',sourceJob='d0105c20-4b44-4ebb-b3a5-32ea1a4158c1')
p['doorStandard'].pop('commit',None)
p['doorStandard']['referenceProvenance']='references/hq-door/provenance.json'
p['actualPalette']='review/palette.json'
p['design']['keyframes'][-1]['role']='fully open; dark empty aperture'
p['production']=dict(status='completed-for-review',background=dict(tool='create_image_pixen',width=320,height=180,generations=1,jobId='21ec4c32-1bf3-4dba-a2c4-a8368d8af51f',recovered=True),doorRegion=dict(x=180,y=20,width=96,height=144),animation=dict(tool='local integer layer composition',uniqueFrames=17,aiGenerationCalls=0,chargedGenerations=0),actualGenerationCalls=1,actualTotalGenerations=1,accountQuoteConfirmed=True,actualUSD=None,firstFrameGate='Passed visual inspection before frame production; review/first-frame-review.json',composite='Shared fixed frame and prepared background; translate leaves only inside aperture; raw originals retained')
p['generationPlan']=dict(actualTool='create_image_pixen',actualCalls=1,chargedGenerations=1,aiAnimationCalls=0,previousAnimationReservation='cancelled before submission')
(R/'plan.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
reference=R/'references/hq-door'
prov=dict(branch='codex/pixellab-doors-round2',copiedFrom='peer local worktree during active production',jobId='d0105c20-4b44-4ebb-b3a5-32ea1a4158c1',userVisualApproval=False,files={str(f.relative_to(reference)).replace('\\','/'):h(f) for f in reference.rglob('*') if f.is_file() and f.name!='provenance.json'})
(reference/'provenance.json').write_text(json.dumps(prov,indent=2)+'\n')
events=[
 dict(sequence=1,tool='get_balance',chargedGenerations=0,result='authenticated; remaining14160.30',evidence='resume-evidence/local-auth-recovery.json'),
 dict(sequence=2,tool='list_jobs',chargedGenerations=0,result='no active or last30minute jobs',evidence='resume-evidence/local-auth-recovery.json'),
 dict(sequence=3,tool='list_images',chargedGenerations=0,search='corridor',result='no matches',evidence='resume-evidence/local-auth-recovery.json'),
 dict(sequence=4,tool='search_help',chargedGenerations=0,result='320x180 Pixen supported;1generation',evidence='resume-evidence/local-auth-recovery.json'),
 dict(sequence=5,tool='create_image_pixen',request='background-local.request.json',requestSha256=h(R/'background-local.request.json'),jobId='21ec4c32-1bf3-4dba-a2c4-a8368d8af51f',chargedGenerations=1,recovered=True,receipt='receipts/background-submit.json'),
 dict(sequence=6,tool='get_image',jobId='21ec4c32-1bf3-4dba-a2c4-a8368d8af51f',chargedGenerations=0,result='processing40%; no resubmit'),
 dict(sequence=7,tool='get_image',jobId='21ec4c32-1bf3-4dba-a2c4-a8368d8af51f',chargedGenerations=0,result='completed; generated image charge1 per server receipt',receipt='receipts/background-completed.json',recovered=True,path='raw/background/pixellab-21ec4c32.png',sha256=h(R/'raw/background/pixellab-21ec4c32.png')),
 dict(sequence=8,tool='get_balance',chargedGenerations=0,result='shared account remaining14158.30; includes peer door charge',receipt='receipts/balance-after-observation.json'),
 dict(sequence=9,tool='local-composition',chargedGenerations=0,uniqueFrames=17,aiGeneratedFrames=0,sourceDoorJob='d0105c20-4b44-4ebb-b3a5-32ea1a4158c1')]
(R/'calls.jsonl').write_text(''.join(json.dumps(dict(observedDateKST='2026-10-22',**e),ensure_ascii=False)+'\n' for e in events),encoding='utf8')
with (R/'spend.log').open('a',encoding='utf8') as f:f.write('\n'+datetime.datetime.now(datetime.timezone.utc).isoformat()+' | recovered job21ec4c32-1bf3-4dba-a2c4-a8368d8af51f; receipt charged1generation; paid calls1; source images generated here1; shared peer door1 (peer charged1, not ours); animation AI calls0; distinct composites17; duplicates0; first frame visually checked; PC/mobile emulation passed; calls.jsonl and receipts retained\n')
