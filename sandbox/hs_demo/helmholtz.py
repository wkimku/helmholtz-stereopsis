"""Depth and normal estimation for Helmholtz stereopsis captures."""

from __future__ import annotations

from dataclasses import asdict
import json
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter

from .config import CameraIntrinsics, SolverConfig

ProgressFn = Callable[[int, int], None]


def depth_to_uint8(depth: np.ndarray, valid_mask: np.ndarray | None = None) -> np.ndarray:
    if valid_mask is None:
        valid_mask = np.isfinite(depth)
    values = depth[valid_mask]
    if values.size == 0:
        return np.zeros(depth.shape, dtype=np.uint8)
    lo = float(values.min())
    hi = float(values.max())
    scale = max(hi - lo, 1e-6)
    image = np.clip((depth - lo) / scale, 0.0, 1.0)
    image[~valid_mask] = 0.0
    return (image * 255).astype(np.uint8)


def normal_to_uint8(normal: np.ndarray, valid_mask: np.ndarray | None = None) -> np.ndarray:
    image = np.clip((normal * 0.5 + 0.5) * 255.0, 0.0, 255.0).astype(np.uint8)
    if valid_mask is not None:
        image[~valid_mask] = 0
    return image


def _project_indices(
    surface_points: np.ndarray,
    camera_position: np.ndarray,
    intrinsics: CameraIntrinsics,
) -> tuple[np.ndarray, np.ndarray]:
    camera_rays = surface_points - camera_position
    normalized = camera_rays / camera_rays[..., 2, np.newaxis]
    u = np.rint(normalized[..., 0] * intrinsics.fx + intrinsics.cx).astype(np.int32)
    v = np.rint(normalized[..., 1] * intrinsics.fy + intrinsics.cy).astype(np.int32)
    u = np.clip(u, 0, intrinsics.width - 1)
    v = np.clip(v, 0, intrinsics.height - 1)
    return u, v


def estimate_depth_normals(
    img_stack: np.ndarray,
    camera_positions: np.ndarray,
    light_positions: np.ndarray,
    intrinsics: CameraIntrinsics,
    solver: SolverConfig,
    progress: ProgressFn | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Estimate per-pixel depth, normal, and confidence from reciprocal pairs."""
    height, width, total_images = img_stack.shape
    if total_images % 2 != 0:
        raise ValueError("img_stack must contain 2 * num_pairs images")
    num_pairs = total_images // 2
    if len(camera_positions) != total_images or len(light_positions) != total_images:
        raise ValueError("camera_positions and light_positions must match img_stack depth")
    if intrinsics.width != width or intrinsics.height != height:
        raise ValueError("intrinsics resolution does not match img_stack")

    xs = np.linspace(solver.xy_min, solver.xy_max, width, dtype=np.float32)
    ys = np.linspace(solver.xy_min, solver.xy_max, height, dtype=np.float32)
    zs = np.linspace(solver.z_min, solver.z_max, solver.depth_steps, dtype=np.float32)
    x_grid, y_grid = np.meshgrid(xs, ys, indexing="xy")

    best_cost = np.full((height, width), -np.inf, dtype=np.float32)
    best_depth_idx = np.zeros((height, width), dtype=np.int32)
    best_normal = np.zeros((height, width, 3), dtype=np.float32)

    for depth_idx, depth in enumerate(zs):
        surface = np.stack([x_grid, y_grid, np.full_like(x_grid, depth)], axis=-1)
        pair_matrix = np.zeros((height, width, num_pairs, 3), dtype=np.float32)

        for pair_idx in range(num_pairs):
            left_light = light_positions[pair_idx]
            right_light = light_positions[pair_idx + num_pairs]
            left_camera = camera_positions[pair_idx + num_pairs]
            right_camera = camera_positions[pair_idx]

            left_vector = surface - left_light
            right_vector = surface - right_light
            u_left, v_left = _project_indices(surface, left_camera, intrinsics)
            u_right, v_right = _project_indices(surface, right_camera, intrinsics)

            left_value = img_stack[v_left, u_left, pair_idx + num_pairs]
            right_value = img_stack[v_right, u_right, pair_idx]
            left_norm = np.linalg.norm(left_vector, axis=-1, keepdims=True)
            right_norm = np.linalg.norm(right_vector, axis=-1, keepdims=True)
            pair_matrix[..., pair_idx, :] = (
                left_value[..., np.newaxis] * left_vector / (left_norm**3 + solver.epsilon)
                - right_value[..., np.newaxis] * right_vector / (right_norm**3 + solver.epsilon)
            )

        wtw = np.einsum("...ri,...rj->...ij", pair_matrix, pair_matrix)
        eigvals, eigvecs = np.linalg.eigh(wtw)
        eigvals = np.clip(eigvals, 0.0, None)
        normal = eigvecs[..., :, 0]
        cost = np.sqrt(eigvals[..., 1]) / (np.sqrt(eigvals[..., 0]) + solver.epsilon)
        if solver.smoothing_window > 1:
            cost = uniform_filter(cost, size=solver.smoothing_window)

        update = cost > best_cost
        best_cost[update] = cost[update]
        best_depth_idx[update] = depth_idx
        best_normal[update] = normal[update]
        if progress is not None:
            progress(depth_idx + 1, len(zs))

    depth_map = zs[best_depth_idx]
    camera_direction = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    flip_mask = np.sum(best_normal * camera_direction, axis=2) < 0
    best_normal[flip_mask] *= -1.0
    return depth_map, best_normal, best_cost


def load_capture(view_dir: str | Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, CameraIntrinsics]:
    view_dir = Path(view_dir)
    meta = json.loads((view_dir / "capture_meta.json").read_text(encoding="utf-8"))
    intr = meta["intrinsics"]
    intrinsics = CameraIntrinsics(
        width=int(intr["width"]),
        height=int(intr["height"]),
        fx=float(intr["fx"]),
        fy=float(intr["fy"]),
        cx=float(intr["cx"]),
        cy=float(intr["cy"]),
    )
    return (
        np.load(view_dir / "img_stack.npy"),
        np.load(view_dir / "camera_positions.npy"),
        np.load(view_dir / "light_positions.npy"),
        intrinsics,
    )


def solve_capture_dir(
    view_dir: str | Path,
    solver: SolverConfig,
    progress: ProgressFn | None = None,
) -> Path:
    view_dir = Path(view_dir)
    output_dir = view_dir / "solution"
    output_dir.mkdir(parents=True, exist_ok=True)
    img_stack, camera_positions, light_positions, intrinsics = load_capture(view_dir)
    depth_map, normal_map, confidence = estimate_depth_normals(
        img_stack=img_stack,
        camera_positions=camera_positions,
        light_positions=light_positions,
        intrinsics=intrinsics,
        solver=solver,
        progress=progress,
    )
    np.save(output_dir / "depth_map.npy", depth_map)
    np.save(output_dir / "normal_map.npy", normal_map)
    np.save(output_dir / "confidence.npy", confidence)
    Image.fromarray(depth_to_uint8(depth_map)).save(output_dir / "depth_map.png")
    Image.fromarray(normal_to_uint8(normal_map)).save(output_dir / "normal_map.png")
    (output_dir / "solver_config.json").write_text(json.dumps(asdict(solver), indent=2), encoding="utf-8")
    return output_dir


def apply_background_mask(view_dir: str | Path, threshold: int = 15) -> Path:
    view_dir = Path(view_dir)
    output_dir = view_dir / "solution"
    rgb_path = view_dir / "raw" / "mask_rgb.png"
    rgb = np.asarray(Image.open(rgb_path))[:, :, :3]
    background = np.all(rgb < threshold, axis=2)

    depth = np.load(output_dir / "depth_map.npy")
    normal = np.load(output_dir / "normal_map.npy")
    valid = ~background
    depth_clean = np.where(valid, depth, 0.0)
    normal_clean = np.where(valid[..., np.newaxis], normal, 0.0)

    np.save(output_dir / "depth_clean.npy", depth_clean)
    np.save(output_dir / "normal_clean.npy", normal_clean)
    Image.fromarray(depth_to_uint8(depth_clean, valid_mask=valid)).save(output_dir / "depth_clean.png")
    Image.fromarray(normal_to_uint8(normal_clean, valid_mask=valid)).save(output_dir / "normal_clean.png")
    return output_dir

