"""Convert a precomputed scene directory into the format the web app expects.

Source layout (after `pipeline.precompute`):
    <scene>/scene.json
    <scene>/base_rgb.png
    <scene>/images/img_*.png
    <scene>/results/depth.npy, normal.npy, cost.npy
    <scene>/results/depth_vis.png, normal_vis.png, mask.png
    <scene>/results/cost_volume_ds.npy, cost_volume_meta.json

Web layout (under web/public/data/<scene_name>/):
    images/img_*.png             (copied)
    base_rgb.png                 (copied)
    depth_vis.png                (copied)
    normal_vis.png               (copied)
    mask.png                     (copied)
    depth.bin                    (float32 little-endian, shape H*W)
    normal.bin                   (float32 little-endian, shape H*W*3)
    cost_volume.bin              (float32 little-endian, shape h*w*nz)
    meta.json                    (intrinsics, geometry, shapes, num_pairs)

Usage:
    python -m pipeline.web_export --scene data/suzanne_test --out web/public/data/suzanne
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np


def _copy_if_exists(src: Path, dst: Path) -> bool:
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def export_scene(scene_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    scene_meta = json.loads((scene_dir / "scene.json").read_text())
    results = scene_dir / "results"

    # 1. Copy images directly (browser reads PNG natively).
    out_images = out_dir / "images"
    out_images.mkdir(parents=True, exist_ok=True)
    for src in sorted((scene_dir / "images").glob("img_*.png")):
        shutil.copy2(src, out_images / src.name)
    _copy_if_exists(scene_dir / "base_rgb.png", out_dir / "base_rgb.png")
    _copy_if_exists(results / "depth_vis.png", out_dir / "depth_vis.png")
    _copy_if_exists(results / "normal_vis.png", out_dir / "normal_vis.png")
    _copy_if_exists(results / "mask.png", out_dir / "mask.png")

    # 2. Convert numpy arrays to raw float32 little-endian binaries.
    depth = np.load(results / "depth.npy").astype(np.float32, copy=False)
    normal = np.load(results / "normal.npy").astype(np.float32, copy=False)
    cost = np.load(results / "cost.npy").astype(np.float32, copy=False)
    depth.tofile(out_dir / "depth.bin")
    normal.tofile(out_dir / "normal.bin")
    cost.tofile(out_dir / "cost.bin")

    fc_path = results / "depth_fc.npy"
    has_fc = fc_path.exists()
    if has_fc:
        depth_fc = np.load(fc_path).astype(np.float32, copy=False)
        depth_fc.tofile(out_dir / "depth_fc.bin")
        _copy_if_exists(results / "depth_fc_vis.png", out_dir / "depth_fc_vis.png")

    cost_vol_meta = None
    cost_volume_path = results / "cost_volume_ds.npy"
    if cost_volume_path.exists():
        cv = np.load(cost_volume_path).astype(np.float32, copy=False)
        cv.tofile(out_dir / "cost_volume.bin")
        cv_meta = json.loads((results / "cost_volume_meta.json").read_text())
        cost_vol_meta = {
            "shape": list(cv.shape),
            "z_min": cv_meta["z_min"],
            "z_max": cv_meta["z_max"],
            "x_extent": cv_meta["x_extent"],
        }

    # 3. Write a single meta.json with everything the web app needs to know.
    H, W = int(depth.shape[0]), int(depth.shape[1])
    meta = {
        "name": out_dir.name,
        "width": W,
        "height": H,
        "num_pairs": scene_meta["num_pairs"],
        "radius": scene_meta["radius"],
        "intrinsics": {
            "fx": scene_meta["focal_mm"] * W / scene_meta["sensor_width_mm"],
            "fy": scene_meta["focal_mm"] * H / scene_meta["sensor_width_mm"],
            "cx": W / 2,
            "cy": H / 2,
        },
        "camera_positions": scene_meta["camera_positions"],
        "light_positions": scene_meta["light_positions"],
        "object_pose": scene_meta.get("object_pose", {}),
        "depth_shape": [H, W],
        "normal_shape": [H, W, 3],
        "cost_shape": [H, W],
        "has_depth_fc": bool(has_fc),
        "cost_volume": cost_vol_meta,
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"Exported scene to {out_dir}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--scene", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    export_scene(args.scene, args.out)


if __name__ == "__main__":
    main()
