import bpy, math, sys, mathutils
glb, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = 48; s.cycles.use_denoising = False
s.view_settings.view_transform = 'Standard'
s.render.resolution_x, s.render.resolution_y = 520, 900; s.render.film_transparent = False
s.world = bpy.data.worlds.new('w'); s.world.use_nodes = True
bgn = s.world.node_tree.nodes['Background']; bgn.inputs[0].default_value = (0.82, 0.83, 0.86, 1); bgn.inputs[1].default_value = 0.9
def light(rot, e, size=4):
    l = bpy.data.lights.new('l', 'SUN'); l.energy = e; l.angle = math.radians(size); o = bpy.data.objects.new('l', l); s.collection.objects.link(o); o.rotation_euler = [math.radians(v) for v in rot]
light((50, 0, 30), 2.2); light((60, 0, -120), 0.8); light((100, 0, 180), 1.0)
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in s.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(dg); pts += [me.matrix_world @ v.co for v in me.data.vertices]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
C = (lo + hi) / 2; Hh = hi.z - lo.z
print('BBOX', lo, hi)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; co = bpy.data.objects.new('c', cam); s.collection.objects.link(co); s.camera = co
def shot(name, az, el, z, scale):
    a, e = math.radians(az), math.radians(el)
    d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    co.location = mathutils.Vector((C.x, C.y, C.z + z * Hh)) + d * 6 * Hh
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.ortho_scale = scale * Hh
    s.render.filepath = f'{out}_{name}.png'; bpy.ops.render.render(write_still=True)
shot('front', 0, 5, 0, 1.12); shot('q', 35, 8, 0, 1.12); shot('side', 90, 5, 0, 1.12); shot('back', 180, 5, 0, 1.12)
s.render.resolution_x, s.render.resolution_y = 600, 600
shot('face', 15, 5, 0.40, 0.22)
