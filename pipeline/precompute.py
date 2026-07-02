"""Run the depth/normal compute pass on a rendered scene directory.

Reads the outputs of `pipeline.render` (or any folder with the same layout),
runs the Helmholtz depth search, and writes:

    <scene_dir>/results/depth.npy             (H, W) float32
    <scene_dir>/results/normal.npy            (H, W, 3) float32
    <scene_dir>/results/cost.npy              (H, W) float32
    <scene_dir>/results/depth_idx.npy         (H, W) int32
    <scene_dir>/results/depth_vis.png         8-bit visualization
    <scene_dir>/results/normal_vis.png        8-bit RGB visualization
    <scene_dir>/results/mask.png              background mask
    <scene_dir>/results/cost_volume_ds.npy    optional, downsampled

Usage:
    python -m pipeline.precompute --scene data/suzanne
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .helmholtz import confidence_mask, depth_search, orient_normals
from .integrate import integrate_normals_fc
from .utils import CameraIntrinsics


@dataclass
class Scene:
    intr: CameraIntrinsics
    num_pairs: int
    radius: float
    camera_pos: np.ndarray
    light_pos: np.ndarray
    image_paths: list[Path]
    base_rgb_path: Path
    object_pose: dict


def load_scene(scene_dir: Path) -> Scene:
    meta = json.loads((scene_dir / "scene.json").read_text())
    intr = CameraIntrinsics.from_blender(
        focal_mm=meta["focal_mm"],
        sensor_width_mm=meta["sensor_width_mm"],
        width=meta["width"],
        height=meta["height"],
    )
    image_paths = sorted((scene_dir / "images").glob("img_*.png"))
    camera_pos = np.array(meta["camera_positions"], dtype=np.float32)
    light_pos = np.array(meta["light_positions"], dtype=np.float32)
    return Scene(
        intr=intr,
        num_pairs=meta["num_pairs"],
        radius=meta["radius"],
        camera_pos=camera_pos,
        light_pos=light_pos,
        image_paths=image_paths,
        base_rgb_path=scene_dir / "base_rgb.png",
        object_pose=meta.get("object_pose", {}),
    )


def load_image_stack(scene: Scene) -> np.ndarray:
    """Load all 2N captured images into a (H, W, 2N) float32 stack of R-channel intensities."""
    expected = 2 * scene.num_pairs
    got = len(scene.image_paths)
    if got != expected:
        raise ValueError(
            f"expected {expected} images (2 * num_pairs={scene.num_pairs}) in "
            f"{scene.image_paths[0].parent if scene.image_paths else '<images dir>'} "
            f"but found {got}. A partial/stale render will silently corrupt the "
            f"W-matrix rows — re-render the scene or clear old img_*.png files."
        )
    stack = np.zeros((scene.intr.height, scene.intr.width, expected), dtype=np.float32)
    for i, p in enumerate(scene.image_paths):
        img = np.array(Image.open(p))
        if img.ndim == 3:
            img = img[..., 0]
        stack[:, :, i] = img.astype(np.float32)
    return stack


def background_mask_from_path(path: Path, threshold: int = 15) -> np.ndarray:
    rgb = np.array(Image.open(path))[..., :3]
    return np.all(rgb < threshold, axis=-1)


def visualize_depth(depth: np.ndarray, mask: np.ndarray | None = None) -> np.ndarray:
    """Render a depth map as a perceptually uniform viridis-colored RGB image.

    Pixels outside `mask` are rendered black. Falls back to grayscale if
    matplotlib is not installed.
    """
    if mask is None:
        mask = np.ones_like(depth, dtype=bool)
    H, W = depth.shape
    if not mask.any():
        return np.zeros((H, W, 3), dtype=np.uint8)
    vals = depth[mask]
    lo, hi = float(vals.min()), float(vals.max())
    if hi - lo < 1e-6:
        return np.zeros((H, W, 3), dtype=np.uint8)
    normalized = np.zeros_like(depth, dtype=np.float32)
    normalized[mask] = (depth[mask] - lo) / (hi - lo)

    try:
        from matplotlib import colormaps  # type: ignore
        cmap = colormaps["viridis"]
        rgb = cmap(normalized)[..., :3]
    except Exception:
        # Grayscale fallback.
        rgb = np.repeat(normalized[..., None], 3, axis=-1)

    rgb[~mask] = 0.0
    return (rgb * 255).clip(0, 255).astype(np.uint8)


def visualize_normal(normal: np.ndarray) -> np.ndarray:
    vis = (normal * 0.5 + 0.5) * 255.0
    return vis.clip(0, 255).astype(np.uint8)


def downsample_cost_volume(cv: np.ndarray, target_hw: int = 256, target_z: int = 128) -> np.ndarray:
    """Average-pool the cost volume to target spatial and depth resolution."""
    H, W, Z = cv.shape
    sy = max(1, H // target_hw)
    sx = max(1, W // target_hw)
    sz = max(1, Z // target_z)
    Ht = (H // sy) * sy
    Wt = (W // sx) * sx
    Zt = (Z // sz) * sz
    cv = cv[:Ht, :Wt, :Zt]
    out = cv.reshape(Ht // sy, sy, Wt // sx, sx, Zt // sz, sz).mean(axis=(1, 3, 5))
    return out.astype(np.float32)


def downsample_sigma_volume(sv: np.ndarray, target_hw: int = 256, target_z: int = 128) -> np.ndarray:
    """Average-pool a (H, W, nz, 3) sigma volume to lower resolution."""
    H, W, Z, C = sv.shape
    sy = max(1, H // target_hw)
    sx = max(1, W // target_hw)
    sz = max(1, Z // target_z)
    Ht = (H // sy) * sy
    Wt = (W // sx) * sx
    Zt = (Z // sz) * sz
    sv = sv[:Ht, :Wt, :Zt, :]
    out = sv.reshape(Ht // sy, sy, Wt // sx, sx, Zt // sz, sz, C).mean(axis=(1, 3, 5))
    return out.astype(np.float32)


def run_precompute(
    scene_dir: Path,
    x_extent: float = 2.0,
    z_min: float = 2.0,
    z_max: float = 4.0,
    nz: int = 256,
    smoothing: int = 6,
    save_cost_volume: bool = True,
    cost_volume_target: int = 128,
    cost_volume_z_target: int = 64,
    cost_drop_percentile: float = 15.0,
) -> None:
    scene = load_scene(scene_dir)
    print(f"Loading {len(scene.image_paths)} images from {scene_dir}")
    img_stack = load_image_stack(scene)
    bg = background_mask_from_path(scene.base_rgb_path)

    H, W = scene.intr.height, scene.intr.width
    x_grid = np.linspace(-x_extent, x_extent, W, dtype=np.float32)
    y_grid = np.linspace(-x_extent, x_extent, H, dtype=np.float32)
    z_candidates = np.linspace(z_min, z_max, nz, dtype=np.float32)

    print(f"Searching depth on {W}x{H}, nz={nz}, smoothing={smoothing}")
    result = depth_search(
        img_stack=img_stack,
        camera_pos=scene.camera_pos,
        light_pos=scene.light_pos,
        intr=scene.intr,
        x_grid=x_grid,
        y_grid=y_grid,
        z_candidates=z_candidates,
        smoothing_size=smoothing,
        return_cost_volume=save_cost_volume,
        return_sigma_volume=save_cost_volume,
        progress_fn=lambda j, n: print(f"  depth {j+1}/{n}", end="\r"),
    )
    print()

    # Save raw outputs (background masked only) so the web demo can apply the
    # confidence filter live with a slider. The static visualizations use the
    # default `cost_drop_percentile` so the published PNGs already look clean.
    bg_mask = ~bg
    depth_raw = np.where(bg_mask, result.depth, 0.0).astype(np.float32)
    normal_raw = orient_normals(
        np.where(bg_mask[..., None], result.normal, 0.0),
        view_dir=np.array([0.0, 0.0, 1.0], dtype=np.float32),
    ).astype(np.float32)
    confidence = confidence_mask(result.cost, bg_mask, drop_percentile=cost_drop_percentile)
    depth_for_vis = np.where(confidence, depth_raw, 0.0)
    normal_for_vis = np.where(confidence[..., None], normal_raw, 0.0)

    out = scene_dir / "results"
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "depth.npy", depth_raw)
    np.save(out / "normal.npy", normal_raw)
    np.save(out / "cost.npy", result.cost.astype(np.float32))
    np.save(out / "depth_idx.npy", result.depth_idx)

    # Frankot-Chellappa smooth depth, integrated from the (cleaner) normal map
    # under the confidence mask. Aligned to the raw depth's mean so the two
    # depth maps live in the same z range.
    depth_fc = integrate_normals_fc(
        normal_raw, confidence,
        world_extent_x=x_extent, world_extent_y=x_extent,
        align_to=depth_raw,
    )
    np.save(out / "depth_fc.npy", depth_fc)

    Image.fromarray(visualize_depth(depth_for_vis, confidence)).save(out / "depth_vis.png")
    Image.fromarray(visualize_normal(normal_for_vis)).save(out / "normal_vis.png")
    Image.fromarray(visualize_depth(depth_fc, confidence)).save(out / "depth_fc_vis.png")
    Image.fromarray((bg_mask * 255).astype(np.uint8)).save(out / "mask.png")

    if result.cost_volume is not None:
        cv_ds = downsample_cost_volume(result.cost_volume, cost_volume_target, cost_volume_z_target)
        np.save(out / "cost_volume_ds.npy", cv_ds)
        (out / "cost_volume_meta.json").write_text(json.dumps({
            "shape": list(cv_ds.shape),
            "z_min": float(z_min), "z_max": float(z_max), "nz_full": int(nz),
            "x_extent": float(x_extent),
        }, indent=2))

    if result.sigma_volume is not None:
        sv_ds = downsample_sigma_volume(result.sigma_volume, cost_volume_target, cost_volume_z_target)
        np.save(out / "sigma_volume_ds.npy", sv_ds)

    print(f"Wrote results to {out}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--scene", required=True, type=Path)
    p.add_argument("--x-extent", type=float, default=2.0)
    p.add_argument("--z-min", type=float, default=2.0)
    p.add_argument("--z-max", type=float, default=4.0)
    p.add_argument("--nz", type=int, default=256)
    p.add_argument("--smoothing", type=int, default=6)
    p.add_argument("--no-cost-volume", action="store_true")
    p.add_argument("--cost-drop-percentile", type=float, default=15.0,
                   help="Drop the bottom-N percent of valid pixels by cost (rank-2 closeness). "
                        "Pass 0 to keep all foreground pixels.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    run_precompute(
        args.scene,
        x_extent=args.x_extent,
        z_min=args.z_min, z_max=args.z_max, nz=args.nz,
        smoothing=args.smoothing,
        save_cost_volume=not args.no_cost_volume,
        cost_drop_percentile=args.cost_drop_percentile,
    )


if __name__ == "__main__":
    main()
