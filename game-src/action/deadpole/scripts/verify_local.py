"""Check provenance, immutable sources, recovery and the actual transition pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'game-src/action/deadpole/resume'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    preserved=0
    for item in read(OUT/'source-inventory.json')['files']:
        if '/deadpole/full/' in item['path']:
            path=ROOT/item['path']
            # The inherited inventory was made on Linux; Git may check text out as CRLF.
            raw=path.read_bytes()
            candidates={hashlib.sha256(raw).hexdigest()}
            if path.suffix=='.json': candidates.add(hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest())
            assert item['sha256'] in candidates,item['path']
            preserved+=1
    totals=0; ids=[]; count=0
    for name in ['pipe_body','catch_counter','close_combo','combo_bridge']:
        folder=OUT/'attempts'/name
        req=read(folder/'request.json');meta=read(folder/'result.json');rows=read(folder/'frames.json')
        assert req['input_sha256']==sha(OUT/'attempts/close_combo/07.png' if name=='combo_bridge' else ROOT/'game-src/action/deadpole/full/base.png')
        assert req['request_sha256']==hashlib.sha256(json.dumps(req['arguments'],sort_keys=True,separators=(',',':')).encode()).hexdigest()
        assert len(rows)==meta['frames']==(req['arguments']['frame_count']+1 if name=='combo_bridge' else len(req['arguments']['keypoints']))
        assert meta['status']=='completed'
        assert meta['charged_generations']==(2 if name=='combo_bridge' else 3)
        assert read(folder/'state.json')['state']=='recovered'
        ids.append(meta['job_id']);totals+=meta['charged_generations'];count+=len(rows)
        for row in rows: assert row['sha256']==sha(folder/f"{row['index']:02d}.png")
    assert len(set(ids))==4
    # Service echoes the first frame exactly but redraws parts of the requested last frame.
    # Runtime uses only intermediate frames 1..3, then the actual input endpoint from cq3.
    assert Image.open(OUT/'attempts/combo_bridge/00.png').tobytes()==Image.open(OUT/'attempts/close_combo/07.png').tobytes()
    returned_last=Image.open(OUT/'attempts/combo_bridge/04.png').tobytes()==Image.open(OUT/'attempts/close_combo/08.png').tobytes()
    a=Image.open(OUT/'final/catch.png').crop((5*192,0,6*192,144))
    b=Image.open(OUT/'final/counter.png').crop((0,0,192,144))
    assert a.tobytes()==b.tobytes(),'catch/counter boundary pixels differ'
    manifest=read(OUT/'final/manifest.json')
    clips={c['name']:c for c in manifest['clips']}
    assert clips['cq_bridge']['source_indices']==[1,2,3]
    assert clips['cq2']['source_sha256'][-1]==sha(OUT/'attempts/close_combo/07.png')
    assert clips['cq3']['source_sha256'][0]==sha(OUT/'attempts/close_combo/08.png')
    assert clips['catch']['offsets'][-1]==clips['counter']['offsets'][0]
    assert clips['catch']['anchors'][-1]==clips['counter']['anchors'][0]
    assert all(c['user_visual_approval'] is False for c in clips.values())
    for c in clips.values():
        assert len(c['anchors'])==c['frames']
        assert len(c['offsets'])==c['frames']
    report=dict(original_files_preserved=preserved,recovered_frames=count,unique_jobs=ids,actual_generations=totals,
                shared_boundary_pixels_identical=True,shared_boundary_offset_and_prop_identical=True,
                request_and_frame_hashes_verified=True,runtime_uses_original_endpoints=True,
                returned_interpolation_last_frame_identical=returned_last,user_visual_approval=False)
    (OUT/'review/provenance-test.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))

if __name__=='__main__': main()
