"""Generate Gracefell's Blender-authored 2.5D arena and Malakar proof.

Run only through Blender:

    blender --background --factory-startup --python scripts/art/generate_assets.py

The script is deterministic and owns no gameplay data. It creates:

* art/blender/source/ashen-reliquary.blend
* art/blender/source/malakar.blend
* art/blender/review-renders/*.png
* art/blender/exports/malakar-raw.glb
* public/art/arena/*.webp

The public Malakar GLB is produced from the raw export by build_assets.ps1 so
glTF Transform can optimize it without flattening its stable node hierarchy.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Color, Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT / "art" / "blender" / "source"
REVIEW_DIR = REPO_ROOT / "art" / "blender" / "review-renders"
EXPORT_DIR = REPO_ROOT / "art" / "blender" / "exports"
RECEIPT_DIR = REPO_ROOT / "art" / "blender" / "receipts"
ARENA_DIR = REPO_ROOT / "public" / "art" / "arena"
RAW_MALAKAR = EXPORT_DIR / "malakar-raw.glb"

ARENA_RADIUS = 5.6
QUIET_RADIUS = ARENA_RADIUS * 0.65
CAMERA_LOCATION = (0.0, -2.0, 15.0)
CAMERA_ORTHO_SCALE = 13.2
SEED = 0x47ACE11

PALETTE = {
    "abyss": "#050403",
    "charcoal": "#0b0907",
    "smoke": "#17120f",
    "stone": "#211b17",
    "stone_lift": "#2b241f",
    "bronze": "#665231",
    "muted_gold": "#9b7a3d",
    "parchment": "#c0ae79",
    "soot_violet": "#292332",
    "phase2_amber": "#c1863f",
    "phase3_grace": "#b7b6a1",
}


def ensure_dirs() -> None:
    for path in (SOURCE_DIR, REVIEW_DIR, EXPORT_DIR, RECEIPT_DIR, ARENA_DIR):
        path.mkdir(parents=True, exist_ok=True)


def linear_rgba(hex_value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_value.lstrip("#")
    color = Color(tuple(int(value[i : i + 2], 16) / 255.0 for i in (0, 2, 4)))
    color.from_srgb_to_scene_linear()
    return color.r, color.g, color.b, alpha


def reset_blender() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Generated sources are reproducible, so editor backup siblings add no value.
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    # Blender 5.2 exposes Eevee Next through the stable BLENDER_EEVEE enum.
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filter_size = 1.25
    scene.camera = None
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Gracefell_World")
    scene.world.color = linear_rgba(PALETTE["abyss"])[:3]
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        scene.view_settings.look = "AgX - Medium High Contrast"
    return scene


def new_collection(name: str, scene: bpy.types.Scene) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(
    name: str,
    hex_value: str,
    *,
    roughness: float = 0.88,
    metallic: float = 0.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = linear_rgba(hex_value)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = linear_rgba(hex_value)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = linear_rgba(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def make_floor_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.96
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.15
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.55
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = linear_rgba(PALETTE["charcoal"])
    ramp.color_ramp.elements[1].position = 0.80
    ramp.color_ramp.elements[1].color = linear_rgba(PALETTE["stone"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.06
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def create_ring_segment(
    name: str,
    r0: float,
    r1: float,
    a0: float,
    a1: float,
    z: float,
    height: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    bottom = z - height / 2.0
    top = z + height / 2.0
    verts = []
    for layer_z in (bottom, top):
        verts.extend(
            (
                (math.cos(a0) * r0, math.sin(a0) * r0, layer_z),
                (math.cos(a1) * r0, math.sin(a1) * r0, layer_z),
                (math.cos(a1) * r1, math.sin(a1) * r1, layer_z),
                (math.cos(a0) * r1, math.sin(a0) * r1, layer_z),
            )
        )
    faces = (
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    )
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft stone edge", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 1
    return obj


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation_z: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    bevel: float = 0.025,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0.0, 0.0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new("Worn edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    move_to_collection(obj, collection)
    return obj


def add_torus(
    name: str,
    radius: float,
    width: float,
    z: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    major_segments: int = 128,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=width,
        major_segments=major_segments,
        minor_segments=6,
        location=(0.0, 0.0, z),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_ico_rock(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_curve(
    name: str,
    points: list[tuple[float, float, float]],
    width: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = width
    curve.bevel_resolution = 0
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def setup_camera_and_lights(scene: bpy.types.Scene) -> bpy.types.Object:
    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    camera = bpy.context.object
    camera.name = "CAM_AshenReliquary_Orthographic"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = CAMERA_ORTHO_SCALE
    camera.data.lens = 52
    camera.data.clip_start = 0.1
    camera.data.clip_end = 60.0
    direction = Vector((0.0, 0.0, 0.0)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-4.6, -5.4, 10.5))
    key = bpy.context.object
    key.name = "LGT_Key_Grace"
    key.data.energy = 930.0
    key.data.shape = "DISK"
    key.data.size = 7.0
    key.data.color = (1.0, 0.77, 0.48)

    bpy.ops.object.light_add(type="AREA", location=(5.0, 3.5, 7.0))
    fill = bpy.context.object
    fill.name = "LGT_Fill_Ash"
    fill.data.energy = 410.0
    fill.data.size = 9.0
    fill.data.color = (0.28, 0.31, 0.42)

    bpy.ops.object.light_add(type="AREA", location=(0.0, 5.0, 6.0))
    rim = bpy.context.object
    rim.name = "LGT_Back_Quiet"
    rim.data.energy = 240.0
    rim.data.size = 6.0
    rim.data.color = (0.48, 0.34, 0.22)
    return camera


def build_arena_scene() -> tuple[bpy.types.Scene, bpy.types.Collection, bpy.types.Collection, bpy.types.Collection]:
    rng = random.Random(SEED)
    scene = reset_blender()
    base = new_collection("ARENA_BASE", scene)
    phase2 = new_collection("ARENA_PHASE_2_MASK", scene)
    phase3 = new_collection("ARENA_PHASE_3_MASK", scene)

    floor_mat = make_floor_material("MAT_AshenStone_Broad")
    floor_lift = make_material("MAT_AshenStone_Lift", PALETTE["stone_lift"], roughness=0.94)
    stone_mat = make_material("MAT_AshenStone_Outer", PALETTE["stone"], roughness=0.96)
    charcoal_mat = make_material("MAT_Charcoal", PALETTE["charcoal"], roughness=0.98)
    bronze_mat = make_material("MAT_AgedBronze", PALETTE["bronze"], roughness=0.72, metallic=0.32)
    gold_mat = make_material("MAT_MutedGold", PALETTE["muted_gold"], roughness=0.7, metallic=0.26)
    violet_mat = make_material("MAT_SootViolet", PALETTE["soot_violet"], roughness=0.95)
    phase2_mat = make_material(
        "MAT_Phase2_AmberMask",
        PALETTE["phase2_amber"],
        roughness=0.58,
        emission=PALETTE["phase2_amber"],
        emission_strength=0.55,
    )
    phase3_mat = make_material(
        "MAT_Phase3_GraceMask",
        PALETTE["phase3_grace"],
        roughness=0.64,
        emission=PALETTE["phase3_grace"],
        emission_strength=0.90,
    )

    bpy.ops.mesh.primitive_plane_add(size=40.0, location=(0.0, 0.0, -0.28))
    abyss = bpy.context.object
    abyss.name = "Abyss_Backplate"
    abyss.data.materials.append(charcoal_mat)
    move_to_collection(abyss, base)

    bpy.ops.mesh.primitive_cylinder_add(vertices=160, radius=QUIET_RADIUS, depth=0.16, location=(0.0, 0.0, -0.02))
    quiet_floor = bpy.context.object
    quiet_floor.name = "Quiet_Central_Disc"
    quiet_floor.data.materials.append(floor_mat)
    bevel = quiet_floor.modifiers.new("Central worn edge", "BEVEL")
    bevel.width = 0.045
    bevel.segments = 2
    move_to_collection(quiet_floor, base)

    for ring_index, (r0, r1, count) in enumerate(((QUIET_RADIUS + 0.02, 4.58, 28), (4.62, 5.36, 32))):
        step = math.tau / count
        for i in range(count):
            gap = 0.018 + rng.random() * 0.018
            a0 = i * step + gap
            a1 = (i + 1) * step - gap
            local_r0 = r0 + rng.uniform(-0.035, 0.035)
            local_r1 = r1 + rng.uniform(-0.045, 0.045)
            height = 0.12 + rng.uniform(-0.018, 0.026)
            mat = floor_lift if (i + ring_index) % 5 == 0 else stone_mat
            create_ring_segment(
                f"Outer_Slab_{ring_index}_{i:02d}",
                local_r0,
                local_r1,
                a0,
                a1,
                0.0 + rng.uniform(-0.015, 0.025),
                height,
                mat,
                base,
            )

    for radius, width, material in (
        (0.58, 0.012, bronze_mat),
        (2.16, 0.018, bronze_mat),
        (3.54, 0.025, gold_mat),
        (4.59, 0.034, bronze_mat),
        (5.34, 0.045, gold_mat),
    ):
        add_torus(f"Inlay_Ring_{radius:.2f}", radius, width, 0.105, material, base)

    for i in range(12):
        angle = i * math.tau / 12.0
        radius_mid = 4.44
        add_box(
            f"Outer_Radial_Seam_{i:02d}",
            (math.cos(angle) * radius_mid, math.sin(angle) * radius_mid, 0.11),
            (0.014, 0.90, 0.014),
            angle - math.pi / 2.0,
            bronze_mat,
            base,
            bevel=0.008,
        )

    for i in range(6):
        angle = i * math.tau / 6.0
        add_box(
            f"Central_Sigil_Ray_{i:02d}",
            (math.cos(angle) * 0.30, math.sin(angle) * 0.30, 0.104),
            (0.010, 0.30, 0.010),
            angle - math.pi / 2.0,
            bronze_mat,
            base,
            bevel=0.006,
        )

    wall_count = 24
    step = math.tau / wall_count
    for i in range(wall_count):
        a0 = i * step + 0.018
        a1 = (i + 1) * step - 0.018
        create_ring_segment(
            f"Reliquary_Wall_{i:02d}",
            5.40,
            5.78 + (0.08 if i % 4 == 0 else 0.0),
            a0,
            a1,
            0.13,
            0.34 + (0.09 if i % 6 == 0 else 0.0),
            stone_mat if i % 3 else violet_mat,
            base,
        )

    for i in range(10):
        angle = i * math.tau / 10.0 + math.pi / 10.0
        radius = 5.43
        bpy.ops.mesh.primitive_cone_add(
            vertices=4,
            radius1=0.28,
            radius2=0.11,
            depth=0.62 + (0.16 if i in (1, 2, 3) else 0.0),
            location=(math.cos(angle) * radius, math.sin(angle) * radius, 0.42),
            rotation=(0.0, 0.0, angle + math.pi / 4.0),
        )
        buttress = bpy.context.object
        buttress.name = f"Reliquary_Buttress_{i:02d}"
        buttress.data.materials.append(stone_mat if i % 2 else violet_mat)
        move_to_collection(buttress, base)

    for arch_index, angle in enumerate((math.radians(58), math.radians(90), math.radians(122))):
        radius = 5.12
        centre = Vector((math.cos(angle) * radius, math.sin(angle) * radius, 0.0))
        tangent = Vector((-math.sin(angle), math.cos(angle), 0.0))
        for side in (-1.0, 1.0):
            position = centre + tangent * side * 0.34
            add_box(
                f"Background_Arch_{arch_index}_Pillar_{'L' if side < 0 else 'R'}",
                (position.x, position.y, 0.43),
                (0.16, 0.22, 0.46 + 0.06 * arch_index),
                angle,
                stone_mat,
                base,
                bevel=0.04,
            )
        add_box(
            f"Background_Arch_{arch_index}_Lintel",
            (centre.x, centre.y, 0.86 + 0.05 * arch_index),
            (0.48, 0.15, 0.14),
            angle,
            stone_mat,
            base,
            bevel=0.04,
        )

    for i in range(48):
        angle = rng.random() * math.tau
        radius = rng.uniform(3.86, 5.62)
        scale = rng.uniform(0.045, 0.13)
        add_ico_rock(
            f"Outer_Rubble_{i:02d}",
            (math.cos(angle) * radius, math.sin(angle) * radius, 0.11 + scale * 0.35),
            (scale * rng.uniform(0.75, 1.35), scale * rng.uniform(0.65, 1.2), scale * rng.uniform(0.45, 0.9)),
            (rng.random() * math.pi, rng.random() * math.pi, rng.random() * math.pi),
            stone_mat if i % 5 else bronze_mat,
            base,
        )

    for i in range(7):
        angle = i * math.tau / 7.0 + 0.24
        radius = 4.78 + (i % 2) * 0.24
        centre = (math.cos(angle) * radius, math.sin(angle) * radius, 0.16)
        add_box(
            f"Fallen_Blade_{i:02d}",
            centre,
            (0.035, 0.34 + 0.06 * (i % 3), 0.018),
            angle - math.pi / 2.0 + rng.uniform(-0.22, 0.22),
            bronze_mat,
            base,
            bevel=0.012,
        )

    for index in range(13):
        base_angle = index * math.tau / 13.0 + 0.07
        start_radius = rng.uniform(3.82, 4.08)
        points = []
        for step_index in range(5):
            radius = start_radius + step_index * rng.uniform(0.25, 0.34)
            angle = base_angle + rng.uniform(-0.035, 0.035)
            points.append((math.cos(angle) * radius, math.sin(angle) * radius, 0.17))
        add_curve(f"Phase2_Seam_{index:02d}", points, 0.022 + rng.random() * 0.012, phase2_mat, phase2)
        if index % 3 == 0:
            branch_origin = points[2]
            branch_angle = base_angle + rng.choice((-1, 1)) * rng.uniform(0.10, 0.18)
            branch_end_radius = math.hypot(branch_origin[0], branch_origin[1]) + 0.38
            add_curve(
                f"Phase2_Branch_{index:02d}",
                [
                    branch_origin,
                    (math.cos(branch_angle) * branch_end_radius, math.sin(branch_angle) * branch_end_radius, 0.17),
                ],
                0.014,
                phase2_mat,
                phase2,
            )

    for index in range(16):
        base_angle = index * math.tau / 16.0 + 0.14
        start_radius = rng.uniform(3.70, 3.98)
        points = []
        for step_index in range(6):
            radius = start_radius + step_index * rng.uniform(0.22, 0.30)
            angle = base_angle + rng.uniform(-0.055, 0.055)
            points.append((math.cos(angle) * radius, math.sin(angle) * radius, 0.18))
        add_curve(f"Phase3_Fracture_{index:02d}", points, 0.019 + rng.random() * 0.010, phase3_mat, phase3)
    for arc_index, (a0, a1) in enumerate(((0.18, 0.78), (1.28, 1.92), (2.55, 3.18), (4.15, 4.85), (5.34, 5.94))):
        points = []
        for step_index in range(18):
            angle = a0 + (a1 - a0) * step_index / 17.0
            points.append((math.cos(angle) * 5.28, math.sin(angle) * 5.28, 0.18))
        add_curve(f"Phase3_Perimeter_Arc_{arc_index:02d}", points, 0.018, phase3_mat, phase3)

    setup_camera_and_lights(scene)
    return scene, base, phase2, phase3


def render_still(
    scene: bpy.types.Scene,
    path: Path,
    *,
    resolution: int,
    file_format: str,
    transparent: bool,
    quality: int = 82,
) -> None:
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = file_format
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    if file_format in {"WEBP", "AVIF", "JPEG"}:
        scene.render.image_settings.quality = quality
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def generate_arena() -> None:
    scene, base, phase2, phase3 = build_arena_scene()
    base.hide_render = False
    phase2.hide_render = True
    phase3.hide_render = True
    scene.render.film_transparent = False

    render_still(scene, REVIEW_DIR / "arena-base.png", resolution=2048, file_format="PNG", transparent=False)
    render_still(scene, ARENA_DIR / "arena-base.webp", resolution=2048, file_format="WEBP", transparent=False, quality=80)

    base.hide_render = True
    phase2.hide_render = False
    phase3.hide_render = True
    render_still(scene, REVIEW_DIR / "phase-2-mask.png", resolution=1024, file_format="PNG", transparent=True)
    render_still(scene, ARENA_DIR / "phase-2-mask.webp", resolution=1024, file_format="WEBP", transparent=True, quality=88)

    phase2.hide_render = True
    phase3.hide_render = False
    render_still(scene, REVIEW_DIR / "phase-3-mask.png", resolution=1024, file_format="PNG", transparent=True)
    render_still(scene, ARENA_DIR / "phase-3-mask.webp", resolution=1024, file_format="WEBP", transparent=True, quality=88)

    base.hide_render = False
    phase2.hide_render = True
    phase3.hide_render = True
    scene.render.film_transparent = False
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "ashen-reliquary.blend"), compress=True)


def create_prism_mesh(
    name: str,
    outline: list[tuple[float, float]],
    z0: float,
    z1: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
    count = len(outline)
    faces = [tuple(range(count)), tuple(range(count, count * 2))[::-1]]
    for i in range(count):
        next_i = (i + 1) % count
        faces.append((i, next_i, count + next_i, count + i))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def apply_and_join(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if obj.type == "MESH":
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    joined.data.name = f"{name}_Mesh"
    return joined


def build_malakar() -> bpy.types.Scene:
    scene = reset_blender()
    charcoal = make_material("MAT_Malakar_CharcoalBronze", "#211a18", roughness=0.72, metallic=0.24)
    amber = make_material(
        "MAT_Malakar_AmberCore",
        "#9f7334",
        roughness=0.48,
        metallic=0.18,
        emission="#c78f43",
        emission_strength=1.1,
    )

    body_parts: list[bpy.types.Object] = []
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0.0, 0.0, 1.28))
    torso = bpy.context.object
    torso.name = "Torso"
    torso.scale = (0.58, 0.46, 0.92)
    torso.data.materials.append(charcoal)
    body_parts.append(torso)

    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.44, radius2=0.08, depth=0.92, location=(0.0, 0.02, 2.14))
    helm = bpy.context.object
    helm.name = "Pointed_Helm"
    helm.rotation_euler[2] = math.radians(18)
    helm.scale.y = 0.78
    helm.data.materials.append(charcoal)
    body_parts.append(helm)

    for side in (-1.0, 1.0):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(0.55 * side, 0.02, 1.60))
        shoulder = bpy.context.object
        shoulder.name = f"Shoulder_{'L' if side < 0 else 'R'}"
        shoulder.scale = (0.34, 0.29, 0.28)
        shoulder.data.materials.append(charcoal)
        body_parts.append(shoulder)

    cape_outline = [(-0.58, -0.08), (0.58, -0.08), (0.86, -0.72), (0.34, -1.38), (0.0, -1.12), (-0.42, -1.48), (-0.90, -0.70)]
    cape = create_prism_mesh("Ash_Cape", cape_outline, 0.30, 0.40, charcoal)
    body_parts.append(cape)

    skirt_outline = [(-0.45, -0.18), (0.45, -0.18), (0.34, 0.28), (0.16, 0.56), (-0.16, 0.56), (-0.34, 0.28)]
    skirt = create_prism_mesh("Armour_Skirt", skirt_outline, 0.22, 0.88, charcoal)
    body_parts.append(skirt)

    blade_outline = [(-0.09, -0.18), (0.09, -0.18), (0.055, 1.28), (0.0, 1.58), (-0.055, 1.28)]
    sword = create_prism_mesh("Coatsword", blade_outline, 1.14, 1.22, charcoal)
    sword.location.x = 0.58
    sword.location.y = 0.16
    sword.rotation_euler[2] = math.radians(-13)
    body_parts.append(sword)

    body = apply_and_join(body_parts, "Malakar_Body")

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.18, location=(0.0, 0.43, 1.48))
    core = bpy.context.object
    core.name = "Malakar_Core"
    core.data.name = "Malakar_Core_Mesh"
    core.data.materials.append(amber)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    fragment_outline = [(-0.09, -0.30), (0.09, -0.30), (0.055, 0.32), (0.0, 0.56), (-0.055, 0.32)]
    fragment = create_prism_mesh("Halo_Fragment_Prototype", fragment_outline, 0.0, 0.06, amber)
    fragment.location = (0.0, -0.28, 2.88)
    bpy.context.view_layer.objects.active = fragment
    fragment.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    fragment.select_set(False)

    root = bpy.data.objects.new("Malakar_Root", None)
    scene.collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.3
    root["asset_role"] = "boss_visual_proof"
    # `pivot` is reserved by Three.js GLTFLoader for numeric geometry pivot
    # data. A descriptive string there poisons the loaded root with NaNs.
    root["pivot_role"] = "ground_contact"
    root["forward_axis_blender"] = "+Y"
    root["runtime_mapping"] = "game x/y -> three x/z"
    root["root_motion"] = False
    for child in (body, core, fragment):
        child.parent = root

    scene["asset_name"] = "Gracefell Malakar low-poly proof"
    scene["materials"] = 2
    scene["animation_authority"] = "runtime simulation; no animation clips in this proof"
    scene["halo_contract"] = "prototype mesh only; runtime state owns nine instances"
    return scene


def setup_malakar_review(scene: bpy.types.Scene) -> None:
    target = Vector((0.0, 0.0, 1.35))
    bpy.ops.object.camera_add(location=(4.4, -6.8, 3.9))
    camera = bpy.context.object
    camera.name = "CAM_Malakar_Review"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.2
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    for name, location, energy, size, color in (
        ("LGT_Malakar_Key", (-3.4, -4.0, 6.8), 720.0, 4.0, (1.0, 0.68, 0.34)),
        ("LGT_Malakar_Fill", (4.0, -1.0, 4.4), 420.0, 5.0, (0.30, 0.34, 0.50)),
        ("LGT_Malakar_Rim", (0.0, 3.4, 5.4), 560.0, 3.0, (0.74, 0.56, 0.30)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()


def generate_malakar() -> None:
    scene = build_malakar()
    setup_malakar_review(scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "malakar.blend"), compress=True)
    render_still(
        scene,
        REVIEW_DIR / "malakar-proof.png",
        resolution=1024,
        file_format="PNG",
        transparent=True,
    )
    bpy.ops.export_scene.gltf(
        filepath=str(RAW_MALAKAR),
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )


def write_generation_receipt() -> None:
    payload = {
        "generator": "scripts/art/generate_assets.py",
        "blender": bpy.app.version_string,
        "seed": SEED,
        "arena": {
            "radiusMeters": ARENA_RADIUS,
            "quietCentralRadiusMeters": QUIET_RADIUS,
            "quietCentralPercent": 65,
            "camera": {
                "type": "ORTHO",
                "location": CAMERA_LOCATION,
                "orthoScale": CAMERA_ORTHO_SCALE,
            },
            "baseResolution": [2048, 2048],
            "overlayResolution": [1024, 1024],
            "decorativeGeometryMinRadiusMeters": round(QUIET_RADIUS + 0.02, 2),
            "maxForegroundHeightMeters": 0.78,
            "dangerRedUsed": False,
            "palette": PALETTE,
        },
        "malakar": {
            "proofOnly": True,
            "materials": ["MAT_Malakar_CharcoalBronze", "MAT_Malakar_AmberCore"],
            "root": "Malakar_Root",
            "pivotRole": "ground_contact",
            "forwardAxisBlender": "+Y",
            "rootMotion": False,
            "halo": "Halo_Fragment_Prototype is authored once for runtime instancing",
            "animations": [],
        },
    }
    (RECEIPT_DIR / "generation.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()
    generate_arena()
    generate_malakar()
    write_generation_receipt()
    print(f"Gracefell art assets generated under {REPO_ROOT}")


if __name__ == "__main__":
    main()
