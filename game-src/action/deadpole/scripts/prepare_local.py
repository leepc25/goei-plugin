"""Prepare sequential combat repairs without submitting or replacing paid requests."""
import json
from pathlib import Path
import production as p
import rig

def main():
    drafts=p.designs()
    # One generated boundary image is shared by the two runtime clips.
    catch=drafts['catch_body'][1]
    counter=drafts['counter_body'][1]
    # Use complete new combo, including the unchanged design of the middle strike.
    retention=drafts['cq1_body'][1]
    aim=[rig.staged(retention[-1],rig.A2,.5),rig.A2,rig.A2r,rig.A2]
    palm=drafts['cq3_palm'][1]
    jobs={
        'catch_counter': ('catch a wrist, sidestep, low hand extends and recoils, high hand holds',catch+counter[1:],
                          {'catch':list(range(6)),'counter':list(range(5,10))}),
        'close_combo': ('low chest retention recoil, two hands extend, recoil, open palm shove and recover',retention+aim+palm,
                        {'cq1':list(range(4)),'cq2':list(range(4,8)),'cq3':list(range(8,14))}),
    }
    template=json.loads((p.OUT/'requests/pipe_body.json').read_text(encoding='utf-8'))
    for name,(action,poses,ranges) in jobs.items():
        request=json.loads(json.dumps(template))
        args=request['arguments'];args['action']=action;args['keypoints']=[rig.kp(pose) for pose in poses]
        request.update(request_sha256=p.sha(json.dumps(args,sort_keys=True,separators=(',',':')).encode()),
                       estimated_generations=rig.cost(len(poses)),runtime_ranges=ranges,
                       reference_keypoints_status='visually_reviewed_reference-alignment.png',
                       status='draft_not_submitted')
        target=p.OUT/'requests'/f'{name}.json'
        if target.exists(): raise RuntimeError('Request already exists: '+str(target))
        p.save(target,request)
        print(name,len(poses),request['estimated_generations'],request['request_sha256'])

if __name__=='__main__': main()
