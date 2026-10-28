# 고품질 Tripo 모델 → 게임용: 면 줄이기(UV 유지), 텍스처 줄이기, GLB
import bpy, sys
src, dst, target = sys.argv[1], sys.argv[2], int(sys.argv[3])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
n0 = len(ob.data.polygons)
md = ob.modifiers.new('dec', 'DECIMATE'); md.ratio = target / n0; md.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print('faces', n0, '->', len(ob.data.polygons))
for im in bpy.data.images:
    if im.size[0] > 0:
        k = 2048 if im.name.startswith('Color') else 1024
        im.scale(k, k)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88)
