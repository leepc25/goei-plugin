"""Tripo 뼈대·동작 GLB 여러 개 → 게임용 캐릭터 GLB 하나.
첫 파일의 메시·뼈대를 쓰고, 다른 파일의 동작(action)을 모두 모은다. 면을 줄이고, 카툰 렌더링에 필요 없는 노멀·재질 맵은 버리고, 색 텍스처만 남긴다.
사용: python3 tools/3d/pack_char.py 출력.glb 면수 텍스처px 입력1.glb 입력2.glb ...
"""
import bpy, sys
out, faces, tex, srcs = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=srcs[0])
keep = set(bpy.context.scene.objects)
arm = [o for o in keep if o.type == 'ARMATURE'][0]
for o in list(keep):
    if o.type == 'MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
for p in srcs[1:]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    for o in set(bpy.context.scene.objects) - before: bpy.data.objects.remove(o)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
n0 = len(mesh.data.polygons)
if n0 > faces:
    bpy.context.view_layer.objects.active = mesh
    md = mesh.modifiers.new('dec', 'DECIMATE'); md.ratio = faces / n0
    # 아마추어 변형보다 먼저 적용되게 맨 앞으로
    while mesh.modifiers[0] != md: bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
print('faces', n0, '->', len(mesh.data.polygons))
for m in mesh.data.materials:
    nt = m.node_tree; b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    for name in ('Normal', 'Metallic', 'Roughness'):
        for l in list(b.inputs[name].links): nt.links.remove(l)
    for n in list(nt.nodes):
        if n.type == 'NORMAL_MAP': nt.nodes.remove(n)
    b.inputs['Metallic'].default_value = 0; b.inputs['Roughness'].default_value = 1
for im in list(bpy.data.images):
    if im.name.startswith('Color'): im.scale(tex, tex)
    elif im.users == 0 or not im.name.startswith('Color'): bpy.data.images.remove(im)
names = sorted(a.name for a in bpy.data.actions)
print('actions', names)
# 모든 동작을 NLA 트랙으로 붙여야 GLB에 다 들어간다
arm.animation_data_create()
for a in bpy.data.actions:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name; tr.strips.new(a.name, int(a.frame_range[0]), a)
arm.animation_data.action = None
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_apply=False)
