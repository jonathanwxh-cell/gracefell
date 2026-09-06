"""Gracefell v2.28: original, articulated Blender models and a lit reliquary.

blender --background --factory-startup --python-exit-code 1 --python scripts/art/build_reliquary.py
No downloaded meshes, no root motion. +Y is forward, Z is up; glTF converts to Y-up.
Rigid anatomical pivots are retained for the simulation-driven runtime poses.
"""
import bpy
import math
import random
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/art/reliquary"
SOURCE = ROOT / "art/blender/reliquary"
REVIEW = ROOT / ".artifacts/reliquary"
for folder in (OUT, SOURCE, REVIEW):
    folder.mkdir(parents=True, exist_ok=True)
random.seed(228)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.world = bpy.data.worlds.new('Reliquary twilight')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.12, .16, .23, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    scene.view_settings.view_transform = 'AgX'
    return scene


def mat(name, color, metal=0, rough=.5, glow=0, texture=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if glow:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = glow
    if texture:
        noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 16
        noise.inputs['Detail'].default_value = 4
        bump = m.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .28
        bump.inputs['Distance'].default_value = .055
        m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    return m


def parent_obj(obj, parent):
    if parent:
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    bpy.context.view_layer.update()
    parent_obj(obj, parent)
    return obj


def finish(obj, name, material, parent=None, bevel=0):
    obj.name = name
    if material:
        obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new('Forged edge bevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new('Weighted plate normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    bpy.context.view_layer.update()
    return parent_obj(obj, parent)


def ellipsoid(name, loc, scale, material, parent=None, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=16, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material, parent)


def box(name, loc, scale, material, parent=None, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material, parent, bevel)


def tube(name, coords, radius, material, parent=None):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(coords)-1)
    for p, co in zip(spline.points, coords):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, name, material, parent)


def loft(name, rings, material, parent=None, n=32):
    # Anatomical plate cross sections: (z, width, depth, forward_offset).
    vertices, faces = [], []
    for z, w, d, y in rings:
        for i in range(n):
            a = i*math.tau/n
            vertices.append((math.cos(a)*w, y+math.sin(a)*d, z))
    for j in range(len(rings)-1):
        for i in range(n):
            a=j*n+i; b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces += [tuple(reversed(range(n))), tuple((len(rings)-1)*n+i for i in range(n))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, material, parent)


def blade(name, origin, length, width, material, trim, parent):
    # Diamond cross section, a real fuller, pointed blade and swept guard.
    x,y,z = origin
    rings=[(z, width*.6, .025,y),(z+.12,width,.042,y),
           (z+length*.78,width*.65,.032,y),(z+length, .003,.003,y)]
    obj=loft(name, rings, material, parent, n=4)
    obj.location.x+=x
    tube('Blade central fuller', [(x,y+.045,z+.18),(x,y+.036,z+length*.77)], .009, trim, parent)
    tube('Swept cruciform guard', [(x-width*2.4,y,z+.08),(x-width*1.2,y+.035,z),
                                 (x,y,z),(x+width*1.2,y+.035,z),(x+width*2.4,y,z+.08)], .038,trim,parent)
    box('Leather wrapped grip',(x,y,z-.17),(.075,.075,.3),DARK,parent,.02)
    for i in range(7):
        tube('Grip binding',[(x-.04,y+.043,z-.30+i*.038),(x+.04,y+.043,z-.27+i*.038)],.005,trim,parent)
    ellipsoid('Sword pommel',(x,y,z-.36),(.065,.065,.095),trim,parent)


def cloth(name, start, length, width, material, parent, split=False):
    verts, faces=[],[]
    nx,nz=20,26
    for j in range(nz+1):
        t=j/nz
        for i in range(nx+1):
            u=i/nx*2-1
            edge=.07*math.sin(i*2.2) if j==nz else 0
            # A scalloped, folded mantle, swept back, with two pointed tails.
            tail=(.19*abs(u) if split else -.16*(1-u*u))*t**6
            verts.append((start[0]+u*width*(.62+.38*t),
                          start[1]-.28*t-.095*math.cos(u*math.pi*5)*(t+.2),
                          start[2]-length*t+edge+tail))
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i
            if split and j>nz*.74 and abs(i-nx/2)<1:
                continue
            faces.append((a,a+1,a+nx+2,a+nx+1))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
    finish(obj,name,material,parent)
    # Raised piping catches the rim light on the actual silhouette.
    for side in (-1,1):
        tube('Mantle embroidered edge', [verts[j*(nx+1)+(0 if side<0 else nx)] for j in range(nz+1)], .009, GOLD, parent)
    return obj


def consolidate():
    # One draw per anatomical pivot/material, rather than one per rivet.
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':
            key=(obj.parent, obj.data.materials[0].name if obj.data.materials else '')
            groups.setdefault(key,[]).append(obj)
    for (par,material),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        objects[0].name=f'{par.name if par else "Stage"}_{material}'


def camera_at(loc,target,scale,resolution):
    bpy.ops.object.camera_add(location=loc)
    camera=bpy.context.object
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=scale
    scene=bpy.context.scene; scene.camera=camera
    scene.render.resolution_x=resolution; scene.render.resolution_y=resolution


def area(name,loc,color,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    obj=bpy.context.object; obj.name=name; obj.data.energy=power; obj.data.color=color; obj.data.shape='DISK'; obj.data.size=size
    obj.rotation_euler=(-obj.location+Vector((0,0,1))).to_track_quat('-Z','Y').to_euler()


def character(kind):
    global GOLD, DARK
    scene=reset()
    boss=kind=='malakar'
    steel=mat('Blackened tempered steel' if boss else 'Ivory silver plate',(.085,.095,.12) if boss else (.48,.56,.62),.86,.29)
    edge=mat('Burnished plate edges',(.26,.29,.32) if boss else (.72,.77,.8),.92,.23)
    GOLD=mat('Antique electrum',(.5,.31,.095),.82,.31)
    DARK=mat('Oiled leather',(.024,.018,.023),.03,.82)
    textile=mat('Royal charcoal velvet' if boss else 'Pilgrim teal linen',(.03,.018,.044) if boss else (.035,.14,.16),0,.94)
    emission=mat('Sovereign ember' if boss else 'Pilgrim grace',(.95,.45,.09) if boss else (.24,.78,.84),.3,.26,3)
    root=empty('Malakar_Root' if boss else 'KiteVeil_Root')
    pelvis=empty('Pelvis',(0,0,1.02),root)
    torso=empty('Torso',(0,0,1.25),pelvis)
    # Tapered waist, barrel ribcage, peaked gorget. The armor is not a sphere stack.
    loft('Cuirass',[(1.04,.25,.16,0),(1.18,.31,.19,0),(1.43,.43 if boss else .35,.22,.015),
                     (1.6,.39 if boss else .32,.18,0),(1.7,.21,.13,0)],steel,torso)
    for side in (-1,1):
        tube('Raised breastplate ridge',[(side*.05,.228,1.13),(side*.18,.245,1.38),(side*.33,.185,1.58)],.014,GOLD,torso)
        for i in range(4):
            tube('Chased ribs',[(side*.075,.226,1.24+i*.064),(side*(.25+i*.015),.185,1.29+i*.064)],.007,edge,torso)
    for i in range(4):
        loft('Articulated fauld',[(.91+i*.068,.30-i*.012,.205,0),(.97+i*.068,.29-i*.012,.19,0)],steel,torso)
        tube('Fauld hem',[(math.cos(a)*(.30-i*.012),math.sin(a)*.21,.918+i*.068) for a in [j*math.pi/20 for j in range(21)]],.007,GOLD,torso)
    ellipsoid('Grace reliquary socket',(0,.23,1.42),(.105,.048,.13),GOLD,torso)
    ellipsoid('Grace reliquary crystal',(0,.269,1.42),(.059,.021,.083),emission,torso)
    for i in range(8):
        a=i*math.tau/8
        tube('Reliquary radial engraving',[(math.cos(a)*.12,.235,1.42+math.sin(a)*.15),(math.cos(a)*.16,.215,1.42+math.sin(a)*.2)],.007,GOLD,torso)
    head=empty('Head',(0,0,1.73),torso)
    loft('Sallet helm',[(1.70,.16,.15,0),(1.82,.215,.205,.015),(1.99,.19,.17,0),(2.10,.10,.10,-.015),(2.13,.016,.02,0)],steel,head)
    # Visor slit and angular nose plate sit on the front, with a defined eye line.
    tube('Lit visor slit',[(-.15,.202,1.9),(-.045,.229,1.905),(0,.232,1.89),(.045,.229,1.905),(.15,.202,1.9)],.010,emission,head)
    tube('Visor brow',[(-.17,.19,1.937),(0,.245,1.961),(.17,.19,1.937)],.022,edge,head)
    loft('Beaked visor',[(1.73,.026,.035,.165),(1.83,.062,.06,.20),(1.96,.042,.035,.21)],edge,head,n=4)
    for side in (-1,1):
        for i in range(4):
            ellipsoid('Visor breathing port',(side*(.08+i*.025),.196-i*.008,1.82+i*.007),(.006,.006,.013),DARK,head,12)
        ellipsoid('Sallet hinge',(side*.206,.02,1.87),(.012,.032,.032),GOLD,head,16)
    if boss:
        for i in range(9):
            a=i*math.tau/9
            height=.25+(.16 if i%2==0 else 0)
            x,y=.195*math.cos(a),.17*math.sin(a)
            spike=loft('Broken crown tine',[(2.015,.04,.035,0),(2.10,.026,.023,0),(2.10+height,.003,.003,0)],GOLD,head,n=6)
            spike.location.x+=x; spike.location.y+=y
        tube('Crown circlet',[(math.cos(i*math.tau/64)*.206,math.sin(i*math.tau/64)*.18,2.04) for i in range(65)],.018,GOLD,head)
    else:
        cloth('Kite veil',(0,-.05,2.04),.62,.24,textile,head,True)
        tube('Helm crest',[(0,-.14,1.9),(0,-.14,2.07),(0,0,2.18),(0,.14,2.06)],.025,GOLD,head)
    cape=empty('Cape',(0,-.17,1.62),torso)
    cloth('Divided mantle',(0,-.17,1.62),1.35 if boss else 1.18,.65 if boss else .40,textile,cape,True)
    # Three-segment legs: real knee and ankle pivots keep planted feet level
    # while the pelvis transfers weight. Preserve world rest positions.
    for side,label in ((-1,'L'),(1,'R')):
        leg=empty('Leg_'+label,(side*.18,0,1.02),pelvis)
        ellipsoid('Mail thigh',(side*.18,0,.80),(.145,.14,.25),DARK,leg)
        ellipsoid('Thigh cuisse',(side*.18,.08,.8),(.132,.12,.23),steel,leg)
        knee=empty('Knee_'+label,(side*.18,0,.54),leg)
        ellipsoid('Pointed poleyn',(side*.18,.135,.54),(.15,.11,.115),edge,knee)
        shin=loft('Fluted greave',[(.13,.115,.11,.025),(.29,.105,.09,0),(.46,.12,.13,0),(.52,.105,.095,0)],steel,knee)
        shin.location.x+=side*.18
        tube('Greave raised flute',[(side*.18,.13,.17),(side*.18,.143,.40),(side*.18,.14,.49)],.014,GOLD,knee)
        foot=empty('Foot_'+label,(side*.18,0,.12),knee)
        box('Sabatons',(side*.18,.09,.075),(.22,.40,.15),steel,foot,.048)
        for i in range(4):
            tube('Sabatons overlapping lames',[(side*.18-.09,.07+i*.05,.15),(side*.18,.085+i*.05,.16),(side*.18+.09,.07+i*.05,.15)],.009,edge,foot)
        arm=empty('Arm_'+label,(side*.4,0,1.53),torso)
        ellipsoid('Upper arm',(side*.46,0,1.32),(.11,.12,.23),DARK,arm)
        for j in range(3):
            plate=ellipsoid('Overlapping pauldron',(side*(.40+j*.056),.015,1.58-j*.075),(.22-j*.026,.205-j*.017,.135),steel,arm)
            tube('Pauldron gilt rim',[(side*(.4+j*.056)+math.cos(a)*(.21-j*.026),.015+math.sin(a)*(.21-j*.017),1.54-j*.075) for a in [k*math.tau/32 for k in range(33)]],.008,GOLD,arm)
            for k in (-1,0,1):
                ellipsoid('Pauldron rivet',(side*(.42+j*.056)+k*.054,.184-j*.017,1.58-j*.075),(.013,.013,.013),GOLD,arm,12)
        if boss:
            for j in range(3):
                spike=loft('Crown shoulder spike',[(1.62,.045,.045,0),(1.91+j*.035,.002,.002,0)],edge,arm,n=6)
                spike.location.x+=side*(.38+j*.095); spike.location.y+=-.045
        ellipsoid('Elbow couter',(side*.49,.045,1.11),(.125,.14,.12),edge,arm)
        fore=empty('Forearm_'+label,(side*.49,.035,1.12),arm)
        gauntlet=loft('Vambrace',[(.87,.082,.095,0),(1.04,.11,.105,0),(1.12,.10,.095,0)],steel,fore)
        gauntlet.location.x+=side*.49; gauntlet.location.y+=.09
        box('Gauntlet',(side*.49,.13,.83),(.17,.18,.19),steel,fore,.045)
        for k in range(4):
            tube('Articulated finger',[(side*.49-.061+k*.039,.2,.86),(side*.49-.061+k*.039,.23,.81),(side*.49-.061+k*.039,.19,.76)],.016,edge,fore)
        # Weapon points upward in rest source; runtime owns local arm/sword poses.
        weapon=empty('Sword_'+label,(side*.49,.15,.83),fore)
        blade('Sovereign blade' if boss else 'Pilgrim longsword',(side*.49,.15,.88),1.50 if boss else 1.19,.10 if boss else .062,edge,GOLD,weapon)
        if not boss and label=='L':
            # Player has only one sword. A scabbard is visible at the other hip.
            for obj in list(weapon.children_recursive): bpy.data.objects.remove(obj,do_unlink=True)
            bpy.data.objects.remove(weapon,do_unlink=True)
            box('Hip scabbard',(side*.30,-.04,.71),(.065,.085,.59),DARK,torso,.02)
    consolidate()
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for obj in root.children_recursive: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/f'{kind}-raw.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    camera_at((3.8,6,3.4),(0,0,1.25),3.5,900)
    area('Softbox gold',(-3,4,6),(1,.78,.51),700,4)
    area('Cold rim',(3,-2,4),(.36,.64,1),950,3)
    area('Front fill',(0,5,2),(.8,.91,1),120,3)
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(REVIEW/f'{kind}-model.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{kind}.blend'),compress=True)
    bpy.ops.render.render(write_still=True)
    print('CHARACTER_DONE',kind,flush=True)


def arena():
    global GOLD,DARK
    scene=reset(); random.seed(228)
    stone=mat('Blue basalt',(.105,.12,.145),.06,.84,texture=True)
    stones=[mat('Basalt variant '+str(i),(.10+i*.01,.112+i*.011,.132+i*.012),.08,.8,texture=True) for i in range(5)]
    carved=mat('Chiseled limestone',(.24,.26,.29),.05,.87,texture=True)
    GOLD=mat('Tarnished bronze inlay',(.24,.155,.058),.7,.47)
    DARK=mat('Dark mortar',(.023,.028,.038),0,.96)
    glow=mat('Candle amber',(.9,.40,.055),.1,.4,5)
    root=empty('Ashen_Reliquary_Root')
    # CC0 photographic stone from Poly Haven; packed into the source .blend.
    # Texture coordinates are shared world coordinates, so no wedge stretches.
    texture_dir=REVIEW/'textures'
    if not (texture_dir/'Diffuse.jpg').exists():
        raise RuntimeError('Run scripts/art/build_reliquary.ps1 to fetch the pinned CC0 stone maps first')
    for material in [stone,carved,*stones]:
        nodes=material.node_tree.nodes; links=material.node_tree.links
        bs=nodes.get('Principled BSDF')
        coord=nodes.new('ShaderNodeTexCoord'); coord.object=root
        mapping=nodes.new('ShaderNodeVectorMath'); mapping.operation='SCALE'; mapping.inputs[3].default_value=.6
        links.new(coord.outputs['Object'],mapping.inputs[0])
        images={}
        for channel in ('Diffuse','Displacement','Rough'):
            tex=nodes.new('ShaderNodeTexImage')
            tex.image=bpy.data.images.load(str(texture_dir/f'{channel}.jpg'),check_existing=True)
            if channel!='Diffuse': tex.image.colorspace_settings.name='Non-Color'
            tex.image.pack(); tex.projection='BOX'; tex.projection_blend=.22
            links.new(mapping.outputs[0],tex.inputs['Vector']); images[channel]=tex
        tint=nodes.new('ShaderNodeMixRGB'); tint.blend_type='MULTIPLY'; tint.inputs[0].default_value=1
        tint.inputs[2].default_value=(.36,.40,.48,1) if material==carved else (.12,.145,.18,1)
        links.new(images['Diffuse'].outputs['Color'],tint.inputs[1]); links.new(tint.outputs[0],bs.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump'); bump.inputs['Distance'].default_value=.07; bump.inputs['Strength'].default_value=.65
        links.new(images['Displacement'].outputs['Color'],bump.inputs['Height']); links.new(bump.outputs[0],bs.inputs['Normal'])
        links.new(images['Rough'].outputs['Color'],bs.inputs['Roughness'])
    bpy.ops.mesh.primitive_cylinder_add(vertices=192,radius=6.25,depth=.32,location=(0,0,-.22))
    finish(bpy.context.object,'Raised circular plinth',carved,root,.025)
    bpy.ops.mesh.primitive_cylinder_add(vertices=160,radius=5.92,depth=.08,location=(0,0,-.025))
    finish(bpy.context.object,'Mortar bed',DARK,root)
    # Individually beveled voussoirs catch grazing light; concentric stone courses.
    for band in range(10):
        inner=.16+band*.56; outer=inner+.546
        count=max(9,round(outer*10))
        for i in range(count):
            a=(i+(band%2)*.5)*math.tau/count
            half=math.pi/count-.0018
            verts=[]
            height=random.uniform(.028,.057)
            for z in (-.055,height):
                for r,t in ((inner,a-half),(outer,a-half),(outer,a+half),(inner,a+half)):
                    verts.append((math.cos(t)*r,math.sin(t)*r,z))
            mesh=bpy.data.meshes.new('Wedge'); mesh.from_pydata(verts,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
            obj=bpy.data.objects.new('Hand set radial ashlar',mesh); bpy.context.collection.objects.link(obj)
            finish(obj,obj.name,random.choice(stones),root,.018)
    for radius in (1.29,3.54,5.64,5.88,6.10):
        tube('Inlaid concentric ward',[(math.cos(i*math.tau/256)*radius,math.sin(i*math.tau/256)*radius,.072) for i in range(257)],.013,GOLD,root)
    for i in range(85):
        a=random.uniform(0,math.tau); r=random.uniform(1.4,5.7)
        x,y=math.cos(a)*r,math.sin(a)*r
        heading=random.uniform(0,math.tau); length=random.uniform(.14,.48)
        coords=[(x+math.cos(heading)*length*j/7+random.uniform(-.025,.025),
                 y+math.sin(heading)*length*j/7+random.uniform(-.025,.025),.059) for j in range(8)]
        tube('Hairline stone fracture',coords,.003,DARK,root)
    # Quiet central rosette, engraved in the floor rather than luminous HUD-like marks.
    for i in range(12):
        a=i*math.tau/12
        tube('Seal petal',[(math.cos(a+t)*(.32+.89*math.sin(t*math.pi/.48)),math.sin(a+t)*(.32+.89*math.sin(t*math.pi/.48)),.073) for t in [j*.48/24 for j in range(25)]],.009,GOLD,root)
    # Architectural weight stays outside the playable 5.6m radius.
    for i in range(12):
        a=i*math.tau/12; x,y=6.02*math.cos(a),6.02*math.sin(a)
        box('Buttress foot',(x,y,.12),(.46,.46,.35),carved,root,.035)
        height=1.5 if y>-.5 else .52
        pillar=box('Broken clustered pier',(x,y,height*.5+.22),(.25,.25,height),stone,root,.025)
        for dx,dy in ((-.13,0),(.13,0),(0,-.13),(0,.13)):
            bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.068,depth=height,location=(x+dx,y+dy,height*.5+.2))
            finish(bpy.context.object,'Bundled gothic shaft',carved,root)
        box('Weathered pier capital',(x,y,height+.22),(.38,.38,.13),carved,root,.035)
        if y>1:
            # A pointed, broken rib vault rising around the far silhouette.
            b=a+.43; ex,ey=6.02*math.cos(b),6.02*math.sin(b)
            coords=[]
            for k in range(31):
                t=k/30
                coords.append((x+(ex-x)*t,y+(ey-y)*t,height+.23+.94*math.sin(t*math.pi)**.75))
            tube('Pointed arch rib',coords,.09,carved,root)
            tube('Arch bronze reveal',[(px,py-.052,pz+.018) for px,py,pz in coords],.014,GOLD,root)
        # Candle clusters on plinths; warm pools frame, never occupy the fighting lane.
        for j in range(3):
            cx,cy=x*.94+(j-1)*.12,y*.94
            ch=.12+(j%2)*.09
            box('Ivory candle',(cx,cy,.18+ch*.5),(.052,.052,ch),carved,root,.012)
            ellipsoid('Candle flame',(cx,cy,.20+ch),(.016,.016,.044),glow,root,12)
        bpy.ops.object.light_add(type='POINT',location=(x*.92,y*.92,.48))
        bpy.context.object.data.energy=12; bpy.context.object.data.color=(1,.47,.12); bpy.context.object.data.shadow_soft_size=.35
    for i in range(150):
        a=random.uniform(0,math.tau); r=random.uniform(5.67,6.35)
        scale=random.uniform(.035,.11)
        chip=box('Spalled stone',(math.cos(a)*r,math.sin(a)*r,.10),(scale*2,scale,scale),random.choice(stones),root,.012)
        chip.rotation_euler.z=a
    # The projection exactly preserves the circular gameplay ground plane.
    camera_at((0,-.001,18),(0,0,0),13.2,2048)
    area('Moon through ruined vault',(-5,-1,10),(.58,.72,1),1150,5)
    area('Western firelight',(-6,3,5),(1,.62,.26),850,3)
    area('Silver fill',(5,-3,7),(.58,.81,1),280,6)
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='WEBP'; scene.render.image_settings.quality=86
    scene.render.filepath=str(OUT/'arena.webp')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'reliquary.blend'),compress=True)
    bpy.ops.render.render(write_still=True)
    print('ARENA_DONE',flush=True)


args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for kind in ('kiteveil','malakar'):
    if not args or kind in args: character(kind)
if not args or 'arena' in args: arena()
