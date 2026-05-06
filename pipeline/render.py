"""Blender rendering for Helmholtz Stereopsis reciprocal pairs.

Run inside Blender:

    blender --background --python pipeline/render.py -- \
        --output data/suzanne \
        --object suzanne \
        --pairs 9 \
        --resolution 1024

The script clears the scene, places one object at a configurable pose, attaches
a procedural-noise (or plain Lambertian) material, then sweeps a camera/light
pair around a circle and renders both an image stack and a clean base view that
is used downstream for background masking.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path

import numpy as np

# bpy is only available inside Blender; guard the import so the file is still
# importable for static analysis / tests outside Blender.
try:
    import bpy  # type: ignore
except ImportError:  # pragma: no cover
    bpy = None


# Pre-defined object/pose presets for the six axis-aligned views.
#
# All views share the same world location (0,0,3) so the camera and lighting
# rig stay identical. Each view rotates the object so that one of its six
# canonical sides ends up facing the camera (which sits at the origin and looks
# along +Z). After per-view depth recovery, applying the inverse rotation puts
# every partial point cloud back into Suzanne's canonical frame for fusion.
VIEW_PRESETS: dict[str, dict] = {
    "front":  dict(location=(0, 0, 3), rotation_euler=(math.pi / 2, 0, 0)),
    "back":   dict(location=(0, 0, 3), rotation_euler=(math.pi / 2, math.pi, 0)),
    "left":   dict(location=(0, 0, 3), rotation_euler=(math.pi / 2, -math.pi / 2, 0)),
    "right":  dict(location=(0, 0, 3), rotation_euler=(math.pi / 2,  math.pi / 2, 0)),
    "up":     dict(location=(0, 0, 3), rotation_euler=(math.pi, 0, 0)),
    "down":   dict(location=(0, 0, 3), rotation_euler=(0, 0, 0)),
}


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(collection):
            collection.remove(item)


def configure_render(samples: int, resolution: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.view_settings.view_transform = "Raw"


def add_object(kind: str, location, rotation_euler) -> "bpy.types.Object":
    if kind == "suzanne":
        bpy.ops.mesh.primitive_monkey_add(size=2, location=location)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=location)
        bpy.ops.object.shade_smooth()
    elif kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1.6, location=location)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.3, location=location)
    else:
        raise ValueError(f"unknown object kind: {kind}")
    obj = bpy.context.active_object
    obj.rotation_euler = rotation_euler
    return obj


def apply_noise_material(obj, scale: float = 5.0, detail: float = 2.0) -> None:
    """Procedural noise → ColorRamp → Principled BSDF base color.

    Noise gives intensity variation that breaks the depth-ambiguity caused by
    untextured Lambertian surfaces.
    """
    mat = bpy.data.materials.new(name="HSNoiseMaterial")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    noise = nodes.new("ShaderNodeTexNoise")
    ramp = nodes.new("ShaderNodeValToRGB")
    out = nodes.new("ShaderNodeOutputMaterial")

    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    noise.inputs["Roughness"].default_value = 0.5
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)

    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    obj.data.materials.clear()
    obj.data.materials.append(mat)


def apply_lambertian_material(obj, color=(0.8, 0.2, 0.2)) -> None:
    mat = bpy.data.materials.new(name="HSLambertian")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    bsdf = nodes.new("ShaderNodeBsdfDiffuse")
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf.inputs["Color"].default_value = (*color, 1.0)
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def add_camera(focal_mm: float = 50.0, sensor_width_mm: float = 100.0):
    bpy.ops.object.camera_add(location=(0, 0, 0), rotation=(math.pi, 0, 0))
    cam = bpy.context.object
    cam.data.lens = focal_mm
    cam.data.sensor_width = sensor_width_mm
    bpy.context.scene.camera = cam
    return cam


def add_point_light(energy: float = 200.0):
    bpy.ops.object.light_add(type="POINT", radius=1.0, location=(0, 0, 0))
    light = bpy.context.object
    light.data.energy = energy
    light.data.color = (1.0, 1.0, 1.0)
    return light


def circular_positions(num_pairs: int, radius: float, z: float = 0.0):
    """Yield (camera_xyz, light_xyz) pairs evenly spaced on a circle."""
    n_total = 2 * num_pairs
    for i in range(n_total):
        theta = i * 2.0 * math.pi / n_total
        cx, cy = radius * math.cos(theta), radius * math.sin(theta)
        yield (cx, cy, z), (-cx, -cy, z)


def render_image_stack(camera, light, num_pairs: int, radius: float, output_dir: Path) -> tuple[np.ndarray, np.ndarray]:
    image_dir = output_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)

    cam_positions = []
    light_positions = []
    for i, (cam_xyz, light_xyz) in enumerate(circular_positions(num_pairs, radius)):
        camera.location = cam_xyz
        light.location = light_xyz
        cam_positions.append(cam_xyz)
        light_positions.append(light_xyz)

        path = image_dir / f"img_{i:02d}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)

    return np.array(cam_positions, dtype=np.float32), np.array(light_positions, dtype=np.float32)


def render_base_view(camera, light, output_dir: Path) -> Path:
    """Single render used as the base RGB for background masking."""
    saved_cam = tuple(camera.location)
    saved_light = tuple(light.location)
    camera.location = (0, 0, 0.3)
    light.location = (0, 0, -0.3)
    path = output_dir / "base_rgb.png"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    camera.location = saved_cam
    light.location = saved_light
    return path


def write_metadata(
    output_dir: Path,
    cam_positions: np.ndarray,
    light_positions: np.ndarray,
    num_pairs: int,
    radius: float,
    focal_mm: float,
    sensor_width_mm: float,
    resolution: int,
    object_kind: str,
    object_pose: dict,
) -> None:
    meta = {
        "num_pairs": num_pairs,
        "radius": radius,
        "focal_mm": focal_mm,
        "sensor_width_mm": sensor_width_mm,
        "width": resolution,
        "height": resolution,
        "object_kind": object_kind,
        "object_pose": object_pose,
        "camera_positions": cam_positions.tolist(),
        "light_positions": light_positions.tolist(),
    }
    (output_dir / "scene.json").write_text(json.dumps(meta, indent=2))


def parse_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--object", default="suzanne", choices=["suzanne", "sphere", "cube", "torus"])
    p.add_argument("--pose", default="front", choices=list(VIEW_PRESETS.keys()))
    p.add_argument("--material", default="noise", choices=["noise", "lambertian"])
    p.add_argument("--pairs", type=int, default=9)
    p.add_argument("--radius", type=float, default=0.75)
    p.add_argument("--resolution", type=int, default=1024)
    p.add_argument("--samples", type=int, default=200)
    p.add_argument("--focal-mm", type=float, default=50.0)
    p.add_argument("--sensor-width-mm", type=float, default=100.0)
    p.add_argument("--light-energy", type=float, default=200.0)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    if bpy is None:
        sys.stderr.write("This script must be run inside Blender.\n")
        sys.exit(1)
    args = parse_args(list(argv) if argv is not None else sys.argv)
    args.output.mkdir(parents=True, exist_ok=True)

    pose = VIEW_PRESETS[args.pose]
    clean_scene()
    configure_render(samples=args.samples, resolution=args.resolution)
    obj = add_object(args.object, location=pose["location"], rotation_euler=pose["rotation_euler"])
    if args.material == "noise":
        apply_noise_material(obj)
    else:
        apply_lambertian_material(obj)
    camera = add_camera(focal_mm=args.focal_mm, sensor_width_mm=args.sensor_width_mm)
    light = add_point_light(energy=args.light_energy)

    render_base_view(camera, light, args.output)
    cam_pos, light_pos = render_image_stack(camera, light, args.pairs, args.radius, args.output)

    write_metadata(
        args.output, cam_pos, light_pos,
        num_pairs=args.pairs, radius=args.radius,
        focal_mm=args.focal_mm, sensor_width_mm=args.sensor_width_mm,
        resolution=args.resolution,
        object_kind=args.object, object_pose=pose,
    )
    print(f"Rendered {2 * args.pairs} images to {args.output}")


if __name__ == "__main__":
    main()
