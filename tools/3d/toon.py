# 카툰 렌더링 미리보기: 텍스처 색 × 2단 명암 + 뒤집은 껍질 외곽선
import bpy, math, sys, mathutils
glb, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = 24; s.cycles.use_denoising = False
s.view_settings.view_transform = 'Standard'
s.world = bpy.data.worlds.new('w'); s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs[0].default_value = (0.86, 0.87, 0.9, 1)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3; sun.angle = 0.02; so = bpy.data.objects.new('sun', sun); s.collection.objects.link(so)
so.rotation_euler = (math.radians(45), 0, math.radians(25))
for m in list(bpy.data.materials):
    if not m.use_nodes: continue
    nt = m.node_tree; b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED']
    if not b: continue
    b = b[0]; src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    o = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    df = nt.nodes.new('ShaderNodeBsdfDiffuse'); s2r = None
    # Cycles에는 Shader to RGB가 없어 빛 방향과 법선으로 직접 명암 단계를 만든다
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
    ld = mathutils.Vector((0, 0, 1)); ld.rotate(so.rotation_euler)
    dot.inputs[1].default_value = ld
    nt.links.new(geo.outputs['Normal'], dot.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.72, 0.70, 0.78, 1)
    ramp.color_ramp.elements[1].position = 0.15; ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(dot.outputs['Value'], ramp.inputs['Fac'])
    mul = nt.nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs['Fac'].default_value = 1
    if src: nt.links.new(src, mul.inputs['Color1'])
    else: mul.inputs['Color1'].default_value = b.inputs['Base Color'].default_value
    nt.links.new(ramp.outputs['Color'], mul.inputs['Color2'])
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(mul.outputs[0], em.inputs['Color'])
    nt.links.new(em.outputs[0], o.inputs['Surface'])
# 외곽선: 뒤집은 껍질
ol = bpy.data.materials.new('outline'); ol.use_nodes = True; nt = ol.node_tree; nt.nodes.clear()
e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (0.08, 0.06, 0.08, 1)
lp = nt.nodes.new('ShaderNodeLightPath'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
geo = nt.nodes.new('ShaderNodeNewGeometry')
nt.links.new(geo.outputs['Backfacing'], mx.inputs[0]); nt.links.new(e.outputs[0], mx.inputs[1]); nt.links.new(tr.outputs[0], mx.inputs[2])
out_ = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(mx.outputs[0], out_.inputs['Surface'])
for o in s.objects:
    if o.type != 'MESH': continue
    o.data.materials.append(ol)
    md = o.modifiers.new('ol', 'SOLIDIFY'); md.thickness = -0.0025; md.use_flip_normals = True; md.material_offset = len(o.data.materials) - 1; md.use_rim = False
dg = bpy.context.evaluated_depsgraph_get(); pts = []
for o in s.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(dg); pts += [me.matrix_world @ v.co for v in me.data.vertices]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
C = (lo + hi) / 2; Hh = hi.z - lo.z
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; co = bpy.data.objects.new('c', cam); s.collection.objects.link(co); s.camera = co
def shot(name, az, el, z, scale, rx, ry):
    s.render.resolution_x, s.render.resolution_y = rx, ry
    a, e = math.radians(az), math.radians(el)
    d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    co.location = mathutils.Vector((C.x, C.y, C.z + z * Hh)) + d * 6 * Hh
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.ortho_scale = scale * Hh
    s.render.filepath = f'{out}_{name}.png'; bpy.ops.render.render(write_still=True)
shot('front', 90, 5, 0, 1.08, 480, 860); shot('q', 55, 10, 0, 1.08, 480, 860)
shot('face', 90, 3, 0.405, 0.2, 600, 600); shot('faceq', 60, 8, 0.405, 0.2, 600, 600)
