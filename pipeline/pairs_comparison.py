"""Run depth_search on the same render with several pair counts (3, 6, 9, 18).

The N=18 hero render contains 36 images covering the circle in 10° steps.
For a smaller subset N, we keep every (18/N)-th pair, preserving the antipodal
swap that makes each pair reciprocal.

Usage:
    python -m pipeline.pairs_comparison --scene data/front_hero \\
        --pair-counts 3 6 9 18 \\
        --out-base web/public/data/pairs
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

from .helmholtz import depth_search, orient_normals
from .precompute import (
    background_mask_from_path,
    visualize_depth,
    visualize_normal,
)
# pairs_comparison reuses precompute helpers; keeping the import for the new
# colormap-aware visualize_depth.
from .utils import CameraIntrinsics


def subset_indices(n_full: int, n_sub: int) -> np.ndarray:
    """Indices into a 2*n_full image stack that pick out 2*n_sub uniformly-spaced reciprocal pairs."""
    if n_full % n_sub != 0:
        raise ValueError(f"n_full={n_full} must be divisible by n_sub={n_sub}")
    stride = n_full // n_sub
    first = list(range(0, n_full, stride))                       # image-r indices
    second = list(range(n_full, 2 * n_full, stride))             # image-l indices
    return np.array(first + second, dtype=np.int64)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--scene", required=True, type=Path)
    p.add_argument("--pair-counts", nargs="+", type=int, default=[3, 6, 9, 18])
    p.add_argument("--out-base", required=True, type=Path,
                   help="Each N goes into <out-base>/N{N}/")
    p.add_argument("--x-extent", type=float, default=2.0)
    p.add_argument("--z-min", type=float, default=2.0)
    p.add_argument("--z-max", type=float, default=4.0)
    p.add_argument("--nz", type=int, default=128)
    p.add_argument("--smoothing", type=int, default=6)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    scene_meta = json.loads((args.scene / "scene.json").read_text())
    n_full = scene_meta["num_pairs"]
    H, W = scene_meta["height"], scene_meta["width"]
    intr = CameraIntrinsics.from_blender(
        focal_mm=scene_meta["focal_mm"], sensor_width_mm=scene_meta["sensor_width_mm"],
        width=W, height=H,
    )
    cam = np.array(scene_meta["camera_positions"], dtype=np.float32)
    light = np.array(scene_meta["light_positions"], dtype=np.float32)

    img_paths = sorted((args.scene / "images").glob("img_*.png"))
    img_stack = np.zeros((H, W, 2 * n_full), dtype=np.float32)
    for i, p in enumerate(img_paths):
        arr = np.array(Image.open(p))
        img_stack[..., i] = (arr[..., 0] if arr.ndim == 3 else arr).astype(np.float32)

    bg = background_mask_from_path(args.scene / "base_rgb.png")
    mask = ~bg

    x_grid = np.linspace(-args.x_extent, args.x_extent, W, dtype=np.float32)
    y_grid = np.linspace(-args.x_extent, args.x_extent, H, dtype=np.float32)
    z_candidates = np.linspace(args.z_min, args.z_max, args.nz, dtype=np.float32)

    args.out_base.mkdir(parents=True, exist_ok=True)
    summary = []

    for n_sub in args.pair_counts:
        idx = subset_indices(n_full, n_sub)
        sub_stack = img_stack[..., idx]
        sub_cam = cam[idx]
        sub_light = light[idx]

        print(f"[N={n_sub}] depth search ...", flush=True)
        result = depth_search(
            img_stack=sub_stack, camera_pos=sub_cam, light_pos=sub_light, intr=intr,
            x_grid=x_grid, y_grid=y_grid, z_candidates=z_candidates,
            smoothing_size=args.smoothing, return_cost_volume=False,
        )
        depth_clean = np.where(mask, result.depth, 0.0).astype(np.float32)
        normal_clean = orient_normals(np.where(mask[..., None], result.normal, 0.0)).astype(np.float32)

        out = args.out_base / f"N{n_sub}"
        out.mkdir(parents=True, exist_ok=True)
        depth_clean.tofile(out / "depth.bin")
        normal_clean.tofile(out / "normal.bin")
        Image.fromarray(visualize_depth(depth_clean, mask)).save(out / "depth_vis.png")
        Image.fromarray(visualize_normal(normal_clean)).save(out / "normal_vis.png")
        summary.append({"N": n_sub, "shape": [H, W]})

    (args.out_base / "meta.json").write_text(json.dumps({
        "scene": str(args.scene.name),
        "variants": summary,
        "format": {
            "depth": "float32 little-endian, shape (H, W)",
            "normal": "float32 little-endian, shape (H, W, 3)",
        },
    }, indent=2))
    print(f"wrote {args.out_base}", flush=True)


if __name__ == "__main__":
    main()
