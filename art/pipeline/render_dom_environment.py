"""Map-derived layered Blender environment candidate; no automatic public copy.

Reuse the existing licensed builders/models. Floor receivers and each occluding
depth slice are camera-visible separately, with the complete geometry retained
for shadow/diffuse/glossy rays. A full 3D reference is exported for recomposition.
"""
from __future__ import annotations
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_environment as source
from gltf_stdlib import import_model
from render_dom_characters import ROOT, PIXELS_PER_UNIT, configure_device, calibrate, digest, safe_output

try:
    import bpy
    import bmesh
    from mathutils import Vector, Matrix
    from bpy_extras.object_utils import world_to_camera_view
except ImportError:
    bpy = None

LOW = {'furniture_prayer_rug_shaf.png', 'furniture_ground_shadow.png',
       'furniture_pool_basin.png', 'furniture_pool_water.png'}
PALETTE = {'WallStone':'#71828f','WallCoping':'#354653','WallMortar':'#566875',
           'CutWall':'#71828f','CutTop':'#354653','DevDeskWood':'#bc9566',
           'GuestDesk':'#bc9566','StandDeskTop':'#c6a676','DoorFrame':'#354653',
           'WinFrame':'#354653'}


def linear(hex_color):
    channels = [int(hex_color.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in channels)+(1,)


def make_mat(name, hex_color, roughness=.5, emission_hex=None, emission_strength=4):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = linear(PALETTE.get(name,hex_color))
    bsdf.inputs['Roughness'].default_value = max(.35,roughness)
    bsdf.inputs['Emission Strength'].default_value = emission_strength if emission_hex else 0
    if emission_hex:
        bsdf.inputs['Emission Color'].default_value = linear(emission_hex)
    return material


def read_contract(zone=None):
    path = ROOT/'frontend/public/maps/floor1.tmj'
    doc = json.loads(path.read_text())
    names = {t['firstgid']+v['id']:v['image'] for t in doc['tilesets'] for v in t['tiles'] if 'image' in v}
    sys.path.insert(0,str(ROOT/'scripts'))
    from visual_migration_contract import canonical
    contract = canonical(doc)
    bounds = (0,43,0,31)
    if zone:
        definition = next(z for z in contract['zones'] if z['zone_id']==zone)
        bounds = (max(0,definition['gx_min']-2),min(43,definition['gx_max']+2),
                  max(0,definition['gy_min']-2),min(31,definition['gy_max']+2))
    instances = []
    for layer in doc['layers']:
        if layer['name'] not in ('floor','furniture','walls_back','walls_front'):
            continue
        for index,gid in enumerate(layer['data']):
            gx,gy = index%44,index//44
            if gid and bounds[0]<=gx<=bounds[1] and bounds[2]<=gy<=bounds[3]:
                instances.append({'id':f"{layer['name']}-{index}",'layer':layer['name'],
                                  'gx':gx,'gy':gy,'sprite':names[gid]})
    return doc,contract,bounds,instances


def build_template(name):
    previous = set(bpy.data.objects)
    custom = {v[3]:v for v in source.ENV_RENDER_MANIFEST}
    kenney = {name:model for model,name in source.KENNEY_MODELS}
    floors = {v[4]:v for v in source.FLOOR_TILE_SPECS}
    if name in floors:
        _,base,accent,pattern,_ = floors[name]
        if any(v in name for v in ('z02','z05','z08','z13','z17')):
            base,accent,pattern = '#ba9466','#a78358','planks'
        source.build_floor_tile(base,accent,pattern)
        for obj in set(bpy.data.objects)-previous:
            if obj.type=='MESH': obj.location.z -= .08
    elif name in custom:
        _,builder,arg,*_ = custom[name]
        builder() if arg is None else builder(arg)
    elif name in kenney:
        import_model(ROOT/'art/sumber/furniture'/kenney[name])
    else:
        raise RuntimeError(f'Missing model builder for canonical asset: {name}')
    created = list(set(bpy.data.objects)-previous)
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    meshes = []
    for obj in created:
        if obj.type!='MESH': continue
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(graph),depsgraph=graph)
        mesh.transform(obj.matrix_world)
        meshes.append(mesh)
    for obj in created:
        bpy.data.objects.remove(obj,do_unlink=True)
    if not meshes:
        raise RuntimeError(f'Empty canonical model: {name}')
    if name in kenney:
        vertices = [v.co for mesh in meshes for v in mesh.vertices]
        offset = Vector(((min(v.x for v in vertices)+max(v.x for v in vertices))/2,
                         (min(v.y for v in vertices)+max(v.y for v in vertices))/2,
                         min(v.z for v in vertices)))
        for mesh in meshes: mesh.transform(Matrix.Translation(-offset))
    scale_z = 1.8 if name.startswith('wall_back') else .785 if name.startswith('wall_front') else 1
    for mesh in meshes:
        if scale_z!=1: mesh.transform(Matrix.Diagonal((1,1,scale_z,1)))
    if name.startswith('tile_floor') or name in LOW:
        return [(0,meshes)]
    values = [v.co.x-v.co.y for mesh in meshes for v in mesh.vertices]
    lo,hi = min(values),max(values)
    count = max(1,math.ceil((hi-lo)/.65))
    result = []
    # Open cuts introduce no artificial interior caps in the recomposed image.
    for band in range(count):
        bottom,top = lo+(hi-lo)*band/count,lo+(hi-lo)*(band+1)/count
        pieces = []
        for mesh in meshes:
            bm = bmesh.new(); bm.from_mesh(mesh)
            for depth,inner,outer in ((bottom,True,False),(top,False,True)):
                geometry = list(bm.verts)+list(bm.edges)+list(bm.faces)
                bmesh.ops.bisect_plane(bm,geom=geometry,dist=1e-6,plane_co=Vector((depth,0,0)),
                                      plane_no=Vector((1,-1,0)),clear_inner=inner,clear_outer=outer)
            if bm.faces:
                piece = bpy.data.meshes.new(f'{name}-band-{band}')
                for material in mesh.materials: piece.materials.append(material)
                bm.to_mesh(piece); piece.update(); pieces.append(piece)
            bm.free()
        if pieces: result.append(((bottom+top)/2,pieces))
    return result


def setup_scene(device,samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source.setup_blender_scene(samples=samples,res_x=5120,res_y=2880)
    configure_device(device)
    scene = bpy.context.scene
    scene.render.resolution_percentage = 100
    scene.render.use_persistent_data = True
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('WarmStudio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.72,.78,.88,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    light = bpy.data.lights.new('SoftDaylight','SUN'); light.energy=2.5; light.angle=.3
    sun = bpy.data.objects.new('SoftDaylight',light); bpy.context.collection.objects.link(sun)
    sun.rotation_euler = tuple(math.radians(v) for v in (38,-20,-35))
    target = Vector((23.5,-17.5,0))
    camera = source.setup_camera(target,ortho_scale=1440/PIXELS_PER_UNIT)
    forward = camera.matrix_world.to_3x3()@Vector((0,0,-1))
    camera.location = target-forward*100
    camera.data.clip_end = 500
    bpy.context.view_layer.update()
    for gx,gy in ((0,0),(1,0),(0,1),(43,31)):
        p = world_to_camera_view(scene,camera,Vector((gx,-gy,0)))
        assert abs(p.x*5120-2*(1088+(gx-gy)*32))<1e-4
        assert abs((1-p.y)*2880-2*(64+(gx+gy)*16))<1e-4
    source.make_mat = make_mat
    return scene


def screen_bounds(objects,padding=6):
    scene = bpy.context.scene
    corners = [world_to_camera_view(scene,scene.camera,obj.matrix_world@Vector(v)) for obj in objects for v in obj.bound_box]
    return (max(0,math.floor(min(p.x for p in corners)*5120)-padding),
            max(0,math.floor(min(1-p.y for p in corners)*2880)-padding),
            min(5120,math.ceil(max(p.x for p in corners)*5120)+padding),
            min(2880,math.ceil(max(1-p.y for p in corners)*2880)+padding))


def render_region(path,rect):
    scene = bpy.context.scene
    left,top,right,bottom = rect
    scene.render.use_border = scene.render.use_crop_to_border = True
    scene.render.border_min_x,scene.render.border_max_x = left/5120,right/5120
    scene.render.border_min_y,scene.render.border_max_y = 1-bottom/2880,1-top/2880
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render(args):
    output = safe_output(args.output_dir)
    if output.exists() and any(output.iterdir()): raise RuntimeError('Use a fresh candidate output directory')
    output.mkdir(parents=True,exist_ok=True)
    _,contract,bounds,instances = read_contract(args.zone)
    calibrate(output,args.device)
    scene = setup_scene(args.device,args.samples)
    templates = {name:build_template(name) for name in sorted({i['sprite'] for i in instances})}
    groups = []; floor = []
    for instance in instances:
        for band,(depth,meshes) in enumerate(templates[instance['sprite']]):
            objects = []
            for index,mesh in enumerate(meshes):
                obj = bpy.data.objects.new(f"{instance['id']}-{band}-{index}",mesh)
                bpy.context.collection.objects.link(obj)
                obj.location = (instance['gx'],-instance['gy'],0)
                objects.append(obj)
            if instance['layer']=='floor' or instance['sprite'] in LOW:
                floor.extend(objects)
            else:
                offset = {'walls_back':5,'furniture':10,'walls_front':30}[instance['layer']]
                groups.append({**instance,'pieceId':f"{instance['id']}-part-{band}",
                               'depthOffset':depth,'z':(instance['gx']+instance['gy']+depth)*1000+offset,'objects':objects})
    bpy.context.view_layer.update()
    all_objects = floor+[obj for group in groups for obj in group['objects']]
    area = screen_bounds(all_objects,padding=16)
    scene.render.use_border = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output/'canonical-scene.blend'),compress=True)
    render_region(output/'canonical-reference.png',area)
    for obj in all_objects: obj.visible_camera = obj in floor
    render_region(output/'floor.png',area)
    (output/'pieces').mkdir()
    exports = []
    for obj in all_objects: obj.visible_camera = False
    for index,group in enumerate(sorted(groups,key=lambda g:(g['z'],g['pieceId']))):
        for obj in group['objects']: obj.visible_camera = True
        rect = screen_bounds(group['objects'])
        path = output/'pieces'/f"{group['pieceId']}.png"
        render_region(path,rect)
        for obj in group['objects']: obj.visible_camera = False
        exports.append({k:v for k,v in group.items() if k!='objects'}|{
            'file':f"pieces/{group['pieceId']}.png",'sha256':digest(path),
            'bounds':{'x':rect[0]/2,'y':rect[1]/2,'width':(rect[2]-rect[0])/2,'height':(rect[3]-rect[1])/2},
            'source':'existing Office procedural/Kenney model','license':'See LICENSES.md',
            'exportScale':2,'reviewed':False})
        print(json.dumps({'environmentPiece':index+1,'total':len(groups),'file':path.name}),flush=True)
    manifest = {'schemaVersion':2,'styleVersion':'AO_CLAUDE_2P5D_V1_CANDIDATE','finalArt':False,
                'exportScale':2,'logicalMapSha256':digest(ROOT/'frontend/public/maps/floor1.tmj'),
                'zone':args.zone or 'all','mapBounds':bounds,'projectionVerified':True,
                'floor':{'file':'floor.png','x':area[0]/2,'y':area[1]/2,'width':(area[2]-area[0])/2,'height':(area[3]-area[1])/2},
                'reference':{'file':'canonical-reference.png','rectRaster':area},'props':exports,
                'zones':contract['zones'],'slots':contract['slots'],'doors':contract['doors'],
                'sourceSha256':digest(source.__file__),'rendererSha256':digest(__file__)}
    (output/'environment-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps({'exportedPieces':len(exports),'scope':args.zone or 'all','finalArt':False}),flush=True)


def main():
    argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',required=True)
    parser.add_argument('--zone')
    parser.add_argument('--samples',type=int,default=32)
    parser.add_argument('--device',choices=('auto','cpu','cuda','optix'),default='auto')
    args = parser.parse_args(argv)
    if bpy is None: parser.error('Blender required; no render performed')
    render(args)


if __name__=='__main__': main()
