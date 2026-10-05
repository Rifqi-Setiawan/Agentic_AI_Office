"""Small, dependency-free reader for the repository's uncompressed GLB models.

Reads triangle meshes, materials, node transforms and skin weights/bind poses.
It does not load the blocked NumPy DLL, change Application Control, fetch external
resources, or execute model content. Unsupported formats fail explicitly.
"""
import json
import math
import struct
from pathlib import Path

FORMATS = {5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
WIDTHS = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}


class GLB:
    def __init__(self,path):
        data = Path(path).read_bytes()
        if len(data)<20 or struct.unpack_from('<III',data)!=(0x46546c67,2,len(data)):
            raise ValueError('Expected a complete glTF 2 GLB')
        offset = 12; self.doc=None; self.binary=b''
        while offset<len(data):
            size,kind=struct.unpack_from('<II',data,offset); offset+=8
            if offset+size>len(data): raise ValueError('GLB chunk out of bounds')
            chunk=data[offset:offset+size];offset+=size
            if kind==0x4e4f534a: self.doc=json.loads(chunk)
            elif kind==0x004e4942: self.binary=chunk
        if self.doc is None or self.doc.get('extensionsRequired'):
            raise ValueError('Unsupported GLB extensions or missing JSON')
        if self.doc.get('textures') or any(b.get('uri') for b in self.doc.get('buffers',[])):
            raise ValueError('Only self-contained, untextured source models are supported')

    def values(self,index):
        accessor=self.doc['accessors'][index]
        if 'sparse' in accessor: raise ValueError('Sparse accessor unsupported')
        view=self.doc['bufferViews'][accessor['bufferView']]
        if view.get('buffer',0)!=0: raise ValueError('External buffer unsupported')
        code,size=FORMATS[accessor['componentType']];width=WIDTHS[accessor['type']]
        count=accessor['count'];stride=view.get('byteStride',size*width)
        if count>1000000: raise ValueError('Accessor exceeds source model limits')
        offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        if offset+(count-1)*stride+size*width>len(self.binary): raise ValueError('Accessor out of bounds')
        result=[]
        for i in range(count):
            row=struct.unpack_from('<'+code*width,self.binary,offset+i*stride)
            if accessor.get('normalized') and code!='f':
                limit={5120:127,5121:255,5122:32767,5123:65535}[accessor['componentType']]
                row=tuple(max(-1,v/limit) for v in row)
            if not all(math.isfinite(v) for v in row): raise ValueError('Nonfinite model coordinate')
            result.append(row)
        return result


def import_model(path):
    import bpy
    from mathutils import Matrix,Quaternion,Vector
    glb=GLB(path);doc=glb.doc;nodes=doc.get('nodes',[])
    parents={child:i for i,node in enumerate(nodes) for child in node.get('children',[])}
    worlds={}
    def matrix(i):
        if i in worlds: return worlds[i]
        node=nodes[i]
        if 'matrix' in node:
            v=node['matrix'];local=Matrix([v[row::4] for row in range(4)])
        else:
            x,y,z,w=node.get('rotation',(0,0,0,1))
            local=Matrix.LocRotScale(Vector(node.get('translation',(0,0,0))),Quaternion((w,x,y,z)),Vector(node.get('scale',(1,1,1))))
        worlds[i]=(matrix(parents[i])@local) if i in parents else local
        return worlds[i]
    conversion=Matrix.Rotation(math.pi/2,4,'X')
    root_index=next((i for i,n in enumerate(nodes) if n.get('name')=='RootNode'),None)
    root=bpy.data.objects.new('RootNode',None)
    bpy.context.collection.objects.link(root)
    root.matrix_world=conversion@matrix(root_index) if root_index is not None else conversion
    materials=[]
    for i,data in enumerate(doc.get('materials',[])):
        material=bpy.data.materials.new(data.get('name',f'Material-{i}'));material.use_nodes=True
        shader=material.node_tree.nodes.get('Principled BSDF')
        pbr=data.get('pbrMetallicRoughness',{})
        shader.inputs['Base Color'].default_value=pbr.get('baseColorFactor',(1,1,1,1))
        shader.inputs['Metallic'].default_value=pbr.get('metallicFactor',1)
        shader.inputs['Roughness'].default_value=pbr.get('roughnessFactor',1)
        if 'emissiveFactor' in data:
            shader.inputs['Emission Color'].default_value=(*data['emissiveFactor'],1)
            shader.inputs['Emission Strength'].default_value=1
        materials.append(material)
    joint_indices={j for skin in doc.get('skins',[]) for j in skin['joints']}
    arm=None;bone_names={}
    if joint_indices:
        arm_index=next((i for i,n in enumerate(nodes) if n.get('name')=='CharacterArmature'),None)
        if arm_index is None: raise ValueError('Expected the source CharacterArmature')
        arm_data=bpy.data.armatures.new('CharacterArmature')
        arm=bpy.data.objects.new('CharacterArmature',arm_data);bpy.context.collection.objects.link(arm)
        arm.parent=root;arm.matrix_world=conversion@matrix(arm_index)
        inverse_arm=matrix(arm_index).inverted()
        by_name={nodes[j].get('name'):j for j in joint_indices}
        next_bone={'Root':'Hips','Hips':'Torso','Torso':'Chest','Chest':'Neck','Neck':'Head'}
        for side in ('L','R'):
            next_bone.update({f'UpperArm.{side}':f'LowerArm.{side}',f'LowerArm.{side}':f'Hand.{side}',
                              f'UpperLeg.{side}':f'LowerLeg.{side}',f'LowerLeg.{side}':f'Foot.{side}'})
        bpy.context.view_layer.objects.active=arm;arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for joint in sorted(joint_indices):
            bone=arm_data.edit_bones.new(nodes[joint].get('name',f'Joint-{joint}'))
            bone_names[joint]=bone.name
            rest=inverse_arm@matrix(joint)
            translation,rotation,_=rest.decompose()
            bone.matrix=Matrix.LocRotScale(translation,rotation,None)
            child_lengths=[(inverse_arm@matrix(c)).translation.__sub__(translation).length for c in nodes[joint].get('children',[]) if c in joint_indices]
            bone.length=max(.0001,min(child_lengths,default=.0005))
            # Anatomical axes make the baseline pose table explicit rather than
            # depending on a version-specific GLTF importer bone heuristic.
            name=nodes[joint].get('name','')
            target=by_name.get(next_bone.get(name))
            if target is not None:
                tail=(inverse_arm@matrix(target)).translation
                if (tail-translation).length>1e-6:
                    bone.head=translation;bone.tail=tail
            if name.startswith('UpperLeg.'):
                roll=Vector((-1,0,0))
            elif name.startswith('LowerLeg.'):
                roll=Vector((0,1,0))
            elif 'Arm.' in name or name.startswith('Hand.'):
                roll=Vector((0,0,1))
            elif name in ('Root','Hips','Torso','Chest','Neck','Head'):
                roll=Vector((0,-1,0))
            else:
                roll=None
            if roll is not None: bone.align_roll(roll)
        for joint in sorted(joint_indices):
            parent=parents.get(joint)
            if parent in bone_names: arm_data.edit_bones[bone_names[joint]].parent=arm_data.edit_bones[bone_names[parent]]
        bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
    objects=[]
    for ni,node in enumerate(nodes):
        if 'mesh' not in node: continue
        mesh_info=doc['meshes'][node['mesh']]
        vertices=[];faces=[];face_materials=[];normals=[];uvs=[];weights=[]
        skin=doc['skins'][node['skin']] if 'skin' in node else None
        if skin:
            for joint,raw in zip(skin['joints'],glb.values(skin['inverseBindMatrices'])):
                inverse_bind=Matrix([raw[row::4] for row in range(4)])
                rest_product=matrix(joint)@inverse_bind
                if max(abs(rest_product[r][c]-matrix(ni)[r][c]) for r in range(4) for c in range(4))>1e-3:
                    raise ValueError('Source inverse bind does not match its rest node transforms')
        for primitive in mesh_info['primitives']:
            if primitive.get('mode',4)!=4: raise ValueError('Only triangle source meshes supported')
            attributes=primitive['attributes'];positions=glb.values(attributes['POSITION'])
            index_values=[v[0] for v in glb.values(primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
            if len(index_values)%3: raise ValueError('Invalid triangle index count')
            used=sorted(set(index_values));start=len(vertices);mapping={v:start+i for i,v in enumerate(used)}
            normal_values=glb.values(attributes['NORMAL']) if 'NORMAL' in attributes else [(0,0,1)]*len(positions)
            uv_values=glb.values(attributes['TEXCOORD_0']) if 'TEXCOORD_0' in attributes else [(0,0)]*len(positions)
            joint_values=glb.values(attributes['JOINTS_0']) if skin else None
            weight_values=glb.values(attributes['WEIGHTS_0']) if skin else None
            for v in used:
                vertices.append(positions[v]);normals.append(normal_values[v]);uvs.append(uv_values[v])
                weights.append([(bone_names[skin['joints'][j]],w) for j,w in zip(joint_values[v],weight_values[v]) if w>0] if skin else [])
            for start_index in range(0,len(index_values),3):
                faces.append(tuple(mapping[v] for v in index_values[start_index:start_index+3]))
                face_materials.append(primitive.get('material',0))
        mesh=bpy.data.meshes.new(node.get('name',mesh_info.get('name','Mesh')))
        mesh.from_pydata(vertices,[],faces);mesh.update()
        for material in materials: mesh.materials.append(material)
        for polygon,material_index in zip(mesh.polygons,face_materials):
            polygon.material_index=material_index;polygon.use_smooth=True
        mesh.normals_split_custom_set([normals[loop.vertex_index] for loop in mesh.loops])
        uv_layer=mesh.uv_layers.new(name='UVMap')
        for loop in mesh.loops:
            u,v=uvs[loop.vertex_index];uv_layer.data[loop.index].uv=(u,1-v)
        obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(obj)
        obj.parent=root;obj.matrix_world=conversion@matrix(ni)
        if skin:
            groups={name:obj.vertex_groups.new(name=name) for name in set(bone_names.values())}
            for vi,row in enumerate(weights):
                for name,weight in row: groups[name].add([vi],weight,'REPLACE')
            modifier=obj.modifiers.new('SourceSkin','ARMATURE');modifier.object=arm
        objects.append(obj)
    bpy.context.view_layer.update()
    print(json.dumps({'glbImported':Path(path).name,'meshes':len(objects),'bones':len(bone_names),'importer':'stdlib GLB; no NumPy DLL'}),flush=True)
    return root,arm,objects
