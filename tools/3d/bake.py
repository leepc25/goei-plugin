# 3D 캐릭터 → 게임 도트 시트 (128×256, 남동, 낮은 탑다운). 사용: python3 bake.py glb 출력폴더 action:장수 ... [--pose sit]
import bpy, math, sys, mathutils, os
args = sys.argv[1:]
glb, out = args[0], args[1]; jobs = [a for a in args[2:] if not a.startswith('--') and not a.startswith('{')]
pose = args[args.index('--pose') + 1] if '--pose' in args else None
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = 16; s.cycles.use_denoising = False
s.render.resolution_x, s.render.resolution_y = 128, 256; s.render.film_transparent = True
s.render.filter_size = 0.6
s.view_settings.view_transform = 'Standard'
s.world = bpy.data.worlds.new('w'); s.world.use_nodes = True; s.world.node_tree.nodes['Background'].inputs[1].default_value = 0.0
# 그림체: 텍스처 색 + 약한 명암 (빛 하나)
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree; b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED']
    if not b: continue
    b = b[0]; src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    o = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 0.72
    df = nt.nodes.new('ShaderNodeBsdfDiffuse')
    ad = nt.nodes.new('ShaderNodeAddShader')
    if src: nt.links.new(src, em.inputs['Color']); nt.links.new(src, df.inputs['Color'])
    nt.links.new(em.outputs[0], ad.inputs[0]); nt.links.new(df.outputs[0], ad.inputs[1]); nt.links.new(ad.outputs[0], o.inputs['Surface'])
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 1.6; so = bpy.data.objects.new('sun', sun); s.collection.objects.link(so)
so.rotation_euler = (math.radians(50), 0, math.radians(120))
# 카메라: 캐릭터 앞(+X)에서 오른쪽으로 45° 돌린 곳, 25° 내려다봄 → 화면에서 남동을 봄
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; co = bpy.data.objects.new('c', cam); s.collection.objects.link(co); s.camera = co
az, el = math.radians(float(os.environ.get('AZ', 45))), math.radians(float(os.environ.get('EL', 25)))
dirv = mathutils.Vector((math.cos(az) * math.cos(el), -math.sin(az) * math.cos(el), math.sin(el)))
from bpy_extras.object_utils import world_to_camera_view
dg = bpy.context.evaluated_depsgraph_get()
me = mesh.evaluated_get(dg); pts = [me.matrix_world @ v.co for v in me.data.vertices]
zmin = min(p.z for p in pts); zmax = max(p.z for p in pts)
ctr = sum(pts, mathutils.Vector()) / len(pts)
co.rotation_euler = (-dirv).to_track_quat('-Z', 'Y').to_euler()
# 카메라 위 방향 성분으로 투영 높이를 재서 서 있는 몸이 235px, 발이 아래 7px
up = co.rotation_euler.to_matrix() @ mathutils.Vector((0, 1, 0))
proj = [p.dot(up) for p in pts]; lo_, hi_ = min(proj), max(proj)
px = (hi_ - lo_) / 235.0          # 1px당 월드 길이
cam.ortho_scale = 256 * px
right = co.rotation_euler.to_matrix() @ mathutils.Vector((1, 0, 0))
cx = sum(p.dot(right) for p in pts) / len(pts)
mid_up = lo_ + (128 - 7) * px     # 캔버스 가운데에 올 위 방향 값
co.location = right * cx + up * mid_up + dirv * 10
print('PX', px, 'height', zmax - zmin)
if pose:
    import json
    arm.animation_data_clear() if arm.animation_data else None
    for bn, rot in json.loads(pose).items():
        pb = arm.pose.bones['mixamorig:' + bn]; pb.rotation_mode = 'XYZ'; pb.rotation_euler = [math.radians(v) for v in rot]
    bpy.context.view_layer.update()
def render(tag, frame=None):
    if frame is not None: s.frame_set(frame)
    s.render.filepath = os.path.join(out, tag + '.png'); bpy.ops.render.render(write_still=True)
if pose: render('pose')
for job in jobs:
    name, n = job.split(':'); n = int(n)
    act = bpy.data.actions[name]
    arm.animation_data_create(); arm.animation_data.action = act
    a, b = act.frame_range
    for i in range(n):
        render(f'{name}_{i}', round(a + (b - a) * i / n))
