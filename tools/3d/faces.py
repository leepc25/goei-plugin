import bpy, math, sys, mathutils
glb, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = 32; s.cycles.use_denoising = False
s.view_settings.view_transform = 'Standard'
s.world = bpy.data.worlds.new('w'); s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs[0].default_value = (0.85, 0.86, 0.9, 1); s.world.node_tree.nodes['Background'].inputs[1].default_value = 1.2
l = bpy.data.lights.new('l', 'SUN'); l.energy = 2.0; o = bpy.data.objects.new('l', l); s.collection.objects.link(o); o.rotation_euler = (0.8, 0, 0.4)
pts = []
for ob in s.objects:
    if ob.type == 'MESH': pts += [ob.matrix_world @ mathutils.Vector(v) for v in ob.bound_box]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
C = (lo + hi) / 2; H = hi.z - lo.z; print('BBOX', lo, hi)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; co = bpy.data.objects.new('c', cam); s.collection.objects.link(co); s.camera = co
s.render.resolution_x = s.render.resolution_y = 420
for i, az in enumerate([0, 90, 180, 270]):
    a = math.radians(az); d = mathutils.Vector((math.sin(a), -math.cos(a), 0.05))
    co.location = mathutils.Vector((C.x, C.y, C.z + 0.40 * H)) + d * 5 * H
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.ortho_scale = 0.2 * H
    s.render.filepath = f'{out}_{i}.png'; bpy.ops.render.render(write_still=True)
