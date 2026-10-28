"""무료 동작 묶음(Quaternius UAL, Rigify DEF-* 뼈)을 Tripo 캐릭터(Mixamo 뼈)에 옮겨 붙여 게임용 GLB 하나로 만든다.
옮기는 법: 원본 뼈의 「쉬는 자세에서 얼마나 돌았나」를 대상 뼈에 그대로 준다. 쉬는 자세가 다르면(T자·A자) 대상 뼈를 먼저
원본 쉬는 방향으로 돌려 맞춘 자세를 기준으로 삼는다. 엉덩이 위치는 다리 길이 비율로 줄인다.
사용: python3 tools/3d/retarget_ual.py 대상.glb 출력.glb 면수 텍스처px 원본1.glb[,원본2.glb] 이름=원본동작 ...
  예: Idle=Idle_Loop Walk=Walk_Loop Punch1=Punch_Jab
"""
import bpy, sys, math
from mathutils import Matrix, Vector, Quaternion

tgt_path, out, faces, tex, srcs = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5].split(',')
want = dict(a.split('=', 1) for a in sys.argv[6:])

MAP = {'Hips': 'DEF-hips', 'Spine': 'DEF-spine.001', 'Spine1': 'DEF-spine.002', 'Spine2': 'DEF-spine.003', 'Neck': 'DEF-neck', 'Head': 'DEF-head'}
for side, s in (('Left', 'L'), ('Right', 'R')):
    MAP.update({f'{side}Shoulder': f'DEF-shoulder.{s}', f'{side}Arm': f'DEF-upper_arm.{s}', f'{side}ForeArm': f'DEF-forearm.{s}', f'{side}Hand': f'DEF-hand.{s}',
                f'{side}UpLeg': f'DEF-thigh.{s}', f'{side}Leg': f'DEF-shin.{s}', f'{side}Foot': f'DEF-foot.{s}', f'{side}ToeBase': f'DEF-toe.{s}'})
    for f, g in (('Index', 'f_index'), ('Middle', 'f_middle'), ('Ring', 'f_ring'), ('Pinky', 'f_pinky'), ('Thumb', 'thumb')):
        for i in (1, 2, 3): MAP[f'{side}Hand{f}{i}'] = f'DEF-{g}.0{i}.{s}'

# UAL 2편은 언리얼 마네킹 이름
UE = {'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'Head'}
for side, s_ in (('Left', 'l'), ('Right', 'r')):
    UE.update({f'{side}Shoulder': f'clavicle_{s_}', f'{side}Arm': f'upperarm_{s_}', f'{side}ForeArm': f'lowerarm_{s_}', f'{side}Hand': f'hand_{s_}',
               f'{side}UpLeg': f'thigh_{s_}', f'{side}Leg': f'calf_{s_}', f'{side}Foot': f'foot_{s_}', f'{side}ToeBase': f'ball_{s_}'})
    for f, g in (('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky'), ('Thumb', 'thumb')):
        for i in (1, 2, 3): UE[f'{side}Hand{f}{i}'] = f'{g}_0{i}_{s_}'
mapof = lambda S: UE if 'pelvis' in S.data.bones else MAP
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=tgt_path)
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
T = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
if T.animation_data: T.animation_data_clear()
pre = lambda n: 'mixamorig:' + n

sources = []
act_owner = {}
for p in srcs:
    before = set(bpy.context.scene.objects); acts0 = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=p)
    new = set(bpy.context.scene.objects) - before
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o.type == 'MESH': o.hide_render = True; o.hide_viewport = True
    # 가져오기가 모든 동작을 NLA 트랙으로 깔아 둔다: 섞이면 쉬는 자세만 남으니 지운다
    if arm.animation_data:
        for t in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(t)
    sources.append(arm)
    for a in set(bpy.data.actions) - acts0: act_owner.setdefault(a.name, arm)

def wrest(arm, name):
    return arm.matrix_world @ arm.data.bones[name].matrix_local
def rot(m):
    return m.to_quaternion()

# 대상 기준 자세: 대상 뼈를 원본 쉬는 방향으로 돌린 것 (방향만 맞추고 비틀림은 대상 그대로)
def ref_rot(S, tn, sn):
    rt = rot(wrest(T, pre(tn))); rs = rot(wrest(S, sn))
    yt = rt @ Vector((0, 1, 0)); ys = rs @ Vector((0, 1, 0))
    return yt.rotation_difference(ys) @ rt

bones = [b.name[len('mixamorig:'):] for b in T.data.bones if b.name.startswith('mixamorig:') and b.name[len('mixamorig:'):] in MAP]
order = [b for b in (bb.name[len('mixamorig:'):] for bb in T.data.bones if bb.name.startswith('mixamorig:')) if b in MAP]
scene = bpy.context.scene

made = []
for name, src_action in want.items():
    if src_action not in act_owner: print('없음', src_action); continue
    S = act_owner[src_action]; act = bpy.data.actions[src_action]
    S.animation_data_create(); S.animation_data.action = act
    if act.slots: S.animation_data.action_slot = act.slots[0]
    M_ = mapof(S)
    Q = {b: rot(wrest(S, M_[b])).inverted() @ ref_rot(S, b, M_[b]) for b in order if M_[b] in S.data.bones}
    # 엉덩이 높이 비율
    hs = wrest(S, M_['Hips']).translation.z; ht = wrest(T, pre('Hips')).translation.z
    k = ht / hs if hs else 1
    f0, f1 = (int(round(v)) for v in act.frame_range)
    new = bpy.data.actions.new(name); T.animation_data_create(); T.animation_data.action = new
    base_xy = None
    for fr in range(f0, f1 + 1):
        scene.frame_set(fr)
        world = {}
        for b in order:
            sn = M_[b]
            if b not in Q: continue
            sp = S.matrix_world @ S.pose.bones[sn].matrix
            wr = rot(sp) @ Q[b]
            if b == 'Hips':
                loc = sp.translation.copy()
                if base_xy is None: base_xy = Vector((loc.x, loc.y))
                tl = wrest(T, pre('Hips')).translation
                loc = Vector((tl.x, tl.y, loc.z * k))   # 제자리: 앞뒤·좌우 이동은 게임이 한다, 높이만 따른다
            else:
                loc = None
            world[b] = (wr, loc)
        posed = {}
        Tinv = T.matrix_world.inverted()
        for b in order:
            if b not in world: continue
            pb = T.pose.bones[pre(b)]
            wr, loc = world[b]
            par = pb.parent
            if par is not None and par.name[len('mixamorig:'):] in posed:
                parent_arm = posed[par.name[len('mixamorig:'):]]
            elif par is not None:
                parent_arm = par.bone.matrix_local.copy()
            else:
                parent_arm = None
            # 원하는 armature 공간 행렬
            arm_rot = (Tinv.to_quaternion() @ wr).to_matrix().to_4x4()
            if loc is not None: arm_m = Matrix.Translation(Tinv @ loc) @ arm_rot
            else:
                # 위치는 부모를 따라간다 (뼈 길이 유지)
                if parent_arm is not None:
                    rest_off = par.bone.matrix_local.inverted() @ pb.bone.matrix_local
                    arm_m = Matrix.Translation((parent_arm @ rest_off).translation) @ arm_rot
                else:
                    arm_m = Matrix.Translation(pb.bone.matrix_local.translation) @ arm_rot
            posed[b] = arm_m
            rest = pb.bone.matrix_local
            if parent_arm is not None:
                basis = (par.bone.matrix_local.inverted() @ rest).inverted() @ (parent_arm.inverted() @ arm_m)
            else:
                basis = rest.inverted() @ arm_m
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = basis.to_quaternion()
            pb.keyframe_insert('rotation_quaternion', frame=fr - f0)
            if b == 'Hips':
                pb.location = basis.translation
                pb.keyframe_insert('location', frame=fr - f0)
    made.append(name)
    print('옮김', name, '<-', src_action, f1 - f0 + 1, '장')

# 원본 지우기
for s in sources:
    for c in list(s.children): bpy.data.objects.remove(c)
    bpy.data.objects.remove(s)
for a in list(bpy.data.actions):
    if a.name not in made: bpy.data.actions.remove(a)
# 면 줄이기 · 노멀/재질 맵 버리기 · 텍스처 줄이기
n0 = len(mesh.data.polygons)
if n0 > faces:
    bpy.context.view_layer.objects.active = mesh
    md = mesh.modifiers.new('dec', 'DECIMATE'); md.ratio = faces / n0
    while mesh.modifiers[0] != md: bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
for m in mesh.data.materials:
    nt = m.node_tree; b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    for nm in ('Normal', 'Metallic', 'Roughness'):
        for l in list(b.inputs[nm].links): nt.links.remove(l)
for im in list(bpy.data.images):
    if im.name.startswith('Color'): im.scale(tex, tex)
    else: bpy.data.images.remove(im)
# 동작마다 슬롯을 대상에 맞춘다 (ACTIONS 내보내기는 각 동작을 이 뼈대에 걸어 본다)
T.animation_data.action = None
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_animations=True, export_animation_mode='ACTIONS', export_frame_step=1, export_optimize_animation_size=True)
print('완료', len(made), '동작')
