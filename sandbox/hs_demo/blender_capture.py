"""Blender rendering for reciprocal camera/light image stacks."""

from __future__ import annotations

from dataclasses import asdict
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .config import CaptureConfig, ViewSpec


def _require_bpy() -> Any:
    try:
        import bpy  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local Blender install
        raise RuntimeError(
            "Blender Python module is not available. Install bpy or run this module "
            "inside Blender's Python runtime."
        ) from exc
    return bpy


def clean_scene() -> None:
    bpy = _require_bpy()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def add_noise_material(obj: Any) -> None:
    bpy = _require_bpy()
    material = bpy.data.materials.new(name="ReciprocalNoiseMaterial")
    material.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(material)

    nodes = material.node_tree.nodes
    nodes.clear()
    shader = nodes.new(type="ShaderNodeBsdfPrincipled")
    shader.location = (0, 0)
    noise = nodes.new(type="ShaderNodeTexNoise")
    noise.location = (-420, 0)
    noise.inputs["Scale"].default_value = 5.0
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.55
    ramp = nodes.new(type="ShaderNodeValToRGB")
    ramp.location = (-210, 0)
    ramp.color_ramp.elements[0].color = (0.05, 0.05, 0.05, 1.0)
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (250, 0)

    material.node_tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    material.node_tree.links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])


def add_matte_material(obj: Any, color: tuple[float, float, float, float] = (0.72, 0.72, 0.68, 1.0)) -> None:
    bpy = _require_bpy()
    material = bpy.data.materials.new(name="LambertianMatteMaterial")
    material.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(material)
    nodes = material.node_tree.nodes
    nodes.clear()
    shader = nodes.new(type="ShaderNodeBsdfDiffuse")
    shader.inputs["Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.9
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (250, 0)
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])


def add_checker_material(obj: Any) -> None:
    bpy = _require_bpy()
    material = bpy.data.materials.new(name="CheckerReflectanceMaterial")
    material.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(material)
    nodes = material.node_tree.nodes
    nodes.clear()
    shader = nodes.new(type="ShaderNodeBsdfDiffuse")
    checker = nodes.new(type="ShaderNodeTexChecker")
    checker.location = (-240, 0)
    checker.inputs["Scale"].default_value = 12.0
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (250, 0)
    material.node_tree.links.new(checker.outputs["Color"], shader.inputs["Color"])
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])


def add_capture_material(obj: Any, kind: str) -> None:
    if kind == "noise":
        add_noise_material(obj)
    elif kind == "matte":
        add_matte_material(obj)
    elif kind == "checker":
        add_checker_material(obj)
    else:
        raise ValueError(f"Unsupported material_kind: {kind}")


def create_subject(config: CaptureConfig, view: ViewSpec) -> Any:
    bpy = _require_bpy()
    location = (view.object_location[0], view.object_location[1], config.object_distance)
    if config.object_kind == "suzanne":
        bpy.ops.mesh.primitive_monkey_add(
            size=config.object_size,
            enter_editmode=False,
            align="WORLD",
            location=location,
            rotation=view.object_rotation_euler,
        )
    elif config.object_kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=64,
            ring_count=32,
            radius=config.object_size / 2,
            location=location,
            rotation=view.object_rotation_euler,
        )
    elif config.object_kind == "cube":
        bpy.ops.mesh.primitive_cube_add(
            size=config.object_size,
            enter_editmode=False,
            align="WORLD",
            location=location,
            rotation=view.object_rotation_euler,
        )
    else:
        raise ValueError(f"Unsupported object_kind: {config.object_kind}")

    obj = bpy.context.object
    obj.name = f"hs_subject_{view.name}"
    add_capture_material(obj, config.material_kind)
    return obj


def setup_scene(config: CaptureConfig, view: ViewSpec) -> tuple[Any, Any, Any]:
    bpy = _require_bpy()
    clean_scene()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = config.samples
    scene.cycles.use_adaptive_sampling = True
    scene.render.resolution_x = config.resolution
    scene.render.resolution_y = config.resolution
    scene.view_settings.view_transform = config.view_transform

    subject = create_subject(config, view)

    bpy.ops.object.camera_add(
        enter_editmode=False,
        align="WORLD",
        location=(0.0, 0.0, 0.0),
        rotation=(np.pi, 0.0, 0.0),
    )
    camera = bpy.context.object
    camera.data.lens = config.lens_mm
    camera.data.sensor_width = config.sensor_width_mm
    scene.camera = camera

    bpy.ops.object.light_add(type="POINT", align="WORLD", location=(0.0, 0.0, 0.0))
    light = bpy.context.object
    light.data.energy = config.light_energy
    light.data.color = (1.0, 1.0, 1.0)
    return subject, camera, light


def render_png(path: Path) -> None:
    bpy = _require_bpy()
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_view(run_dir: str | Path, view: ViewSpec, config: CaptureConfig) -> Path:
    """Render reciprocal image pairs and metadata for one view."""
    bpy = _require_bpy()
    view_dir = Path(run_dir) / view.name
    raw_dir = view_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    _, camera, light = setup_scene(config, view)
    intrinsics = config.intrinsics
    total_images = config.num_pairs * 2
    img_stack = np.zeros((config.resolution, config.resolution, total_images), dtype=np.float32)
    camera_positions = np.zeros((total_images, 3), dtype=np.float32)
    light_positions = np.zeros((total_images, 3), dtype=np.float32)

    render_png(raw_dir / "mask_rgb.png")

    for idx, angle in enumerate(np.linspace(0.0, 2.0 * np.pi, total_images, endpoint=False)):
        cam_xy = config.ring_radius * np.array([np.cos(angle), np.sin(angle)])
        light_xy = -cam_xy
        camera.location = (float(cam_xy[0]), float(cam_xy[1]), 0.0)
        light.location = (float(light_xy[0]), float(light_xy[1]), 0.0)

        image_path = raw_dir / f"img_{idx:03d}.png"
        render_png(image_path)
        gray = np.asarray(Image.open(image_path))[:, :, 0].astype(np.float32)
        if config.image_noise_std > 0:
            rng = np.random.default_rng(idx)
            gray = np.clip(gray + rng.normal(0.0, config.image_noise_std, gray.shape), 0.0, 255.0)
        img_stack[:, :, idx] = gray
        camera_positions[idx] = np.asarray(camera.location, dtype=np.float32)
        light_positions[idx] = np.asarray(light.location, dtype=np.float32)

    np.save(view_dir / "img_stack.npy", img_stack)
    np.save(view_dir / "camera_positions.npy", camera_positions)
    np.save(view_dir / "light_positions.npy", light_positions)
    metadata = {
        "view": asdict(view),
        "capture": asdict(config),
        "intrinsics": asdict(intrinsics),
        "blender_version": getattr(bpy.app, "version_string", "unknown"),
    }
    (view_dir / "capture_meta.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return view_dir
