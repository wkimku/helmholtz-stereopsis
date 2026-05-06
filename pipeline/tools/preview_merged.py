"""Render a quick PNG preview of a merged point cloud for sanity checking.

Usage:
    python -m pipeline.tools.preview_merged --data web/public/data/suzanne_full
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, type=Path)
    p.add_argument("--out", type=Path, default=None)
    p.add_argument("--azim", type=float, default=30.0)
    p.add_argument("--elev", type=float, default=15.0)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    meta = json.loads((args.data / "meta.json").read_text())
    n = meta["count"]
    points = np.fromfile(args.data / "points.bin", dtype=np.float32).reshape(-1, 3)
    normals = np.fromfile(args.data / "normals.bin", dtype=np.float32).reshape(-1, 3)
    view_idx = np.fromfile(args.data / "view_indices.bin", dtype=np.int8)
    print(f"Loaded {n} points, normals shape {normals.shape}, view_indices shape {view_idx.shape}")
    print(f"Pose names: {meta['pose_names']}")

    print("\nPer-view point counts:")
    for i, name in enumerate(meta["pose_names"]):
        c = int((view_idx == i).sum())
        print(f"  {name}: {c}")

    print("\nBounding box (canonical frame):")
    print(f"  x: [{points[:, 0].min():.3f}, {points[:, 0].max():.3f}]")
    print(f"  y: [{points[:, 1].min():.3f}, {points[:, 1].max():.3f}]")
    print(f"  z: [{points[:, 2].min():.3f}, {points[:, 2].max():.3f}]")
    print(f"  centroid: ({points.mean(axis=0)})")

    out_path = args.out or args.data / "preview.png"
    try:
        import matplotlib
        matplotlib.use("Agg")
        from matplotlib import pyplot as plt
        from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    except ImportError:
        print("matplotlib not available, skipping PNG preview")
        return

    palette = np.array([
        [0.94, 0.40, 0.36],
        [0.34, 0.62, 0.92],
        [0.46, 0.78, 0.40],
        [0.97, 0.78, 0.20],
        [0.66, 0.50, 0.92],
        [0.30, 0.78, 0.78],
    ])
    colors = palette[view_idx % len(palette)]

    fig = plt.figure(figsize=(8, 8))
    ax = fig.add_subplot(111, projection="3d")
    ax.scatter(points[:, 0], points[:, 1], points[:, 2], c=colors, s=1, depthshade=False)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(elev=args.elev, azim=args.azim)
    ax.set_title(f"Merged cloud — {n:,} points across {len(meta['pose_names'])} views")
    plt.tight_layout()
    plt.savefig(out_path, dpi=140)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
