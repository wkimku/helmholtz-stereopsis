"""Run the depth search on each per-pose render, fuse the partial point clouds,
and export a single merged dataset for the web demo.

Usage:
    python -m pipeline.merge_views \\
        --views data/front data/back data/left data/right data/up data/down \\
        --out web/public/data/suzanne_full \\
        --x-extent 2.0 --z-min 2.0 --z-max 4.0 --nz 128
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

from .helmholtz import confidence_mask, depth_search, orient_normals
from .integrate import integrate_normals_fc
from .reconstruct import (
    background_mask_from_rgb,
    merge_views,
    view_to_canonical_pointcloud,
    ViewData,
)
from .utils import CameraIntrinsics


def precompute_view(
    scene_dir: Path,
    x_extent: float,
    z_min: float,
    z_max: float,
    nz: int,
    smoothing: int,
    cost_drop_percentile: float = 15.0,
    use_fc_depth: bool = True,
) -> dict:
    """Run depth_search and write results into <scene_dir>/results."""
    meta = json.loads((scene_dir / "scene.json").read_text())
    intr = CameraIntrinsics.from_blender(
        focal_mm=meta["focal_mm"], sensor_width_mm=meta["sensor_width_mm"],
        width=meta["width"], height=meta["height"],
    )
    cam = np.array(meta["camera_positions"], dtype=np.float32)
    light = np.array(meta["light_positions"], dtype=np.float32)
    n = meta["num_pairs"]

    img_paths = sorted((scene_dir / "images").glob("img_*.png"))
    if len(img_paths) != 2 * n:
        raise ValueError(
            f"{scene_dir}: expected {2 * n} images (2 * num_pairs={n}) but found "
            f"{len(img_paths)}; a partial/stale render would corrupt the result."
        )
    H, W = intr.height, intr.width
    img_stack = np.zeros((H, W, 2 * n), dtype=np.float32)
    for i, p in enumerate(img_paths):
        arr = np.array(Image.open(p))
        img_stack[..., i] = (arr[..., 0] if arr.ndim == 3 else arr).astype(np.float32)

    x_grid = np.linspace(-x_extent, x_extent, W, dtype=np.float32)
    y_grid = np.linspace(-x_extent, x_extent, H, dtype=np.float32)
    z_candidates = np.linspace(z_min, z_max, nz, dtype=np.float32)

    print(f"[{scene_dir.name}] depth search nz={nz} ...", flush=True)
    result = depth_search(
        img_stack=img_stack, camera_pos=cam, light_pos=light, intr=intr,
        x_grid=x_grid, y_grid=y_grid, z_candidates=z_candidates,
        smoothing_size=smoothing, return_cost_volume=False,
    )
    bg = background_mask_from_rgb(np.array(Image.open(scene_dir / "base_rgb.png"))[..., :3])
    mask = confidence_mask(result.cost, ~bg, drop_percentile=cost_drop_percentile)
    depth_raw = np.where(mask, result.depth, 0.0).astype(np.float32)
    # Outward orientation: surfaces seen by the camera at the origin should have
    # normals pointing back toward the camera (negative z), so after the merge
    # transform the canonical normals consistently face outward.
    normal_clean = orient_normals(
        np.where(mask[..., None], result.normal, 0.0),
        view_dir=np.array([0.0, 0.0, -1.0], dtype=np.float32),
    ).astype(np.float32)

    out = scene_dir / "results"
    out.mkdir(parents=True, exist_ok=True)

    # Frankot-Chellappa smooth depth from the (cleaner) normals — fixes the
    # per-pixel speckle that otherwise survives into the merged cloud.
    if use_fc_depth:
        # F-C wants a normal field with a stable nz sign. We integrated the
        # outward-oriented normals here; flip them temporarily so nz > 0
        # (matches the height-map gradient convention p = -nx/nz, q = -ny/nz).
        normals_for_fc = normal_clean.copy()
        flip = normals_for_fc[..., 2] < 0
        normals_for_fc[flip] = -normals_for_fc[flip]
        depth_fc = integrate_normals_fc(
            normals_for_fc, mask,
            world_extent_x=x_extent, world_extent_y=x_extent,
            align_to=depth_raw,
        )
        np.save(out / "depth_fc.npy", depth_fc)
        depth_to_save = depth_fc
    else:
        depth_to_save = depth_raw

    np.save(out / "depth.npy", depth_to_save)
    np.save(out / "depth_raw.npy", depth_raw)
    np.save(out / "normal.npy", normal_clean)
    return meta


def export_merged(
    out_dir: Path,
    points: np.ndarray,
    normals: np.ndarray,
    colors: np.ndarray,
    view_indices: np.ndarray,
    pose_names: list[str],
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    points.astype(np.float32).tofile(out_dir / "points.bin")
    normals.astype(np.float32).tofile(out_dir / "normals.bin")
    colors.astype(np.float32).tofile(out_dir / "colors.bin")
    view_indices.astype(np.int8).tofile(out_dir / "view_indices.bin")
    (out_dir / "meta.json").write_text(json.dumps({
        "count": int(points.shape[0]),
        "pose_names": pose_names,
        "format": {
            "points": "float32 little-endian, shape (count, 3)",
            "normals": "float32 little-endian, shape (count, 3)",
            "colors": "float32 little-endian, shape (count, 3) in [0,1]",
            "view_indices": "int8 little-endian, shape (count,) — index into pose_names",
        },
    }, indent=2))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--views", nargs="+", required=True, type=Path,
                   help="Per-pose render directories produced by pipeline.render")
    p.add_argument("--out", required=True, type=Path,
                   help="Output directory for the web-friendly merged cloud")
    p.add_argument("--x-extent", type=float, default=2.0)
    p.add_argument("--z-min", type=float, default=2.0)
    p.add_argument("--z-max", type=float, default=4.0)
    p.add_argument("--nz", type=int, default=128)
    p.add_argument("--smoothing", type=int, default=6)
    p.add_argument("--no-precompute", action="store_true",
                   help="Skip depth_search (assumes results/ already populated)")
    p.add_argument("--cluster-each-eps", type=float, default=0.04)
    p.add_argument("--cluster-each-min-points", type=int, default=15)
    p.add_argument("--cluster-merged-eps", type=float, default=0.05)
    p.add_argument("--cluster-merged-min-points", type=int, default=30)
    p.add_argument("--cost-drop-percentile", type=float, default=15.0,
                   help="Drop the bottom-N percent of each view's pixels by cost confidence.")
    p.add_argument("--no-fc", action="store_true",
                   help="Skip Frankot-Chellappa depth smoothing (use raw per-pixel depths).")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    pose_meta_per_view: list[dict] = []
    for view_dir in args.views:
        if args.no_precompute:
            pose_meta_per_view.append(json.loads((view_dir / "scene.json").read_text()))
        else:
            meta = precompute_view(
                view_dir, args.x_extent, args.z_min, args.z_max, args.nz, args.smoothing,
                cost_drop_percentile=args.cost_drop_percentile,
                use_fc_depth=not args.no_fc,
            )
            pose_meta_per_view.append(meta)

    # Build (view_dir, pose_dict) tuples for merge_views.
    pairs: list[tuple[Path, dict]] = []
    for view_dir, meta in zip(args.views, pose_meta_per_view):
        pose = meta.get("object_pose", {})
        pairs.append((view_dir, pose))

    # Use the first view's resolution to define the grid; assumes all match.
    first = json.loads((args.views[0] / "scene.json").read_text())
    H, W = first["height"], first["width"]
    x_grid = np.linspace(-args.x_extent, args.x_extent, W, dtype=np.float32)
    y_grid = np.linspace(-args.x_extent, args.x_extent, H, dtype=np.float32)

    print("merging (smooth, F-C) ...", flush=True)
    merged_smooth = merge_views(
        pairs, x_grid, y_grid,
        cluster_each=True,
        cluster_each_eps=args.cluster_each_eps,
        cluster_each_min_points=args.cluster_each_min_points,
        cluster_merged=True,
        cluster_merged_eps=args.cluster_merged_eps,
        cluster_merged_min_points=args.cluster_merged_min_points,
        depth_filename="depth.npy",
    )
    print(f"  smooth merged cloud: {merged_smooth.points.shape[0]} points", flush=True)

    pose_names = [view_dir.name for view_dir in args.views]
    export_merged(args.out, merged_smooth.points, merged_smooth.normals,
                  merged_smooth.colors, merged_smooth.view_indices, pose_names)
    print(f"wrote {args.out} (smooth)", flush=True)

    # Second pass with raw per-pixel depth — same parameters, separate output
    # so the web demo can toggle between raw and smooth point clouds.
    raw_depth_path = args.views[0] / "results" / "depth_raw.npy"
    if raw_depth_path.exists():
        print("merging (raw) ...", flush=True)
        merged_raw = merge_views(
            pairs, x_grid, y_grid,
            cluster_each=True,
            cluster_each_eps=args.cluster_each_eps,
            cluster_each_min_points=args.cluster_each_min_points,
            cluster_merged=True,
            cluster_merged_eps=args.cluster_merged_eps,
            cluster_merged_min_points=args.cluster_merged_min_points,
            depth_filename="depth_raw.npy",
        )
        print(f"  raw merged cloud: {merged_raw.points.shape[0]} points", flush=True)
        # Always save the raw set as a complete bundle so the viewer can swap
        # between two independent reconstructions cleanly.
        merged_raw.points.astype(np.float32).tofile(args.out / "points_raw.bin")
        merged_raw.normals.astype(np.float32).tofile(args.out / "normals_raw.bin")
        merged_raw.view_indices.astype(np.int8).tofile(args.out / "view_indices_raw.bin")
    else:
        print(f"  (no {raw_depth_path.name} found — skipping raw merge.)", flush=True)


if __name__ == "__main__":
    main()
