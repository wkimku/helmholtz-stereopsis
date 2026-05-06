"""Multi-view masking, clustering, and merging for HS depth/normal outputs.

Per-view recovery happens in world coordinates while the object sits at
location T_v rotated by R_v from a canonical orientation. To fuse views, undo
each pose by transforming world points back to the canonical frame:

    P_canonical = R_v^{-1} (P_world - T_v)
    n_canonical = R_v^{-1} n_world

After this transform every partial reconstruction agrees on the canonical
orientation and they can be concatenated into a single point cloud.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation as R


@dataclass
class ViewData:
    depth: np.ndarray         # (H, W)
    normal: np.ndarray        # (H, W, 3)
    rgb: np.ndarray           # (H, W, 3) in [0, 1]
    background: np.ndarray    # (H, W) bool, True = background


def background_mask_from_rgb(rgb_img: np.ndarray, threshold: int = 15) -> np.ndarray:
    return np.all(rgb_img < threshold, axis=-1)


def mask_view(depth: np.ndarray, normal: np.ndarray, bg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    keep = ~bg
    return np.where(keep, depth, 0.0), np.where(keep[..., None], normal, 0.0)


def load_view_results(view_dir: Path, depth_filename: str = "depth.npy") -> ViewData:
    """Load precompute results + base RGB and apply background masking.

    `depth_filename` lets callers swap between the F-C smooth depth (the
    default `depth.npy` written by `merge_views.precompute_view`) and the raw
    per-pixel depth (`depth_raw.npy`).
    """
    rgb_uint = np.array(Image.open(view_dir / "base_rgb.png"))[..., :3]
    bg = background_mask_from_rgb(rgb_uint)
    depth = np.load(view_dir / "results" / depth_filename)
    normal = np.load(view_dir / "results" / "normal.npy")
    depth, normal = mask_view(depth, normal, bg)
    return ViewData(depth=depth, normal=normal, rgb=rgb_uint.astype(np.float32) / 255.0, background=bg)


def world_to_canonical_transform(pose: dict) -> tuple[np.ndarray, np.ndarray]:
    """Returns (R_inv, t) such that P_canonical = R_inv @ (P_world - t).

    t is the object's render-time location, R is the object's render-time
    rotation. Inverting both gives the rotation+translation that takes a world
    point back into Suzanne's canonical (unrotated) frame centered at origin.
    """
    rot = R.from_euler("xyz", pose["rotation_euler"], degrees=False).as_matrix()
    t = np.array(pose["location"], dtype=np.float64)
    R_inv = rot.T
    return R_inv.astype(np.float32), t.astype(np.float32)


def view_to_canonical_pointcloud(
    view: ViewData,
    pose: dict,
    x_grid: np.ndarray,
    y_grid: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Lift the depth map to 3D in world coords, then map to the canonical frame."""
    X, Y = np.meshgrid(x_grid, y_grid, indexing="xy")
    Z = view.depth
    pts_world = np.stack([X, Y, Z], axis=-1).reshape(-1, 3).astype(np.float32)
    nml_world = view.normal.reshape(-1, 3).astype(np.float32)
    col = view.rgb.reshape(-1, 3).astype(np.float32)
    valid = (Z.reshape(-1) > 0)
    pts_world, nml_world, col = pts_world[valid], nml_world[valid], col[valid]

    R_inv, t = world_to_canonical_transform(pose)
    pts_canon = (pts_world - t) @ R_inv.T   # equivalent to (R_inv @ (P - t).T).T
    nml_canon = nml_world @ R_inv.T
    return pts_canon, nml_canon, col


def cluster_largest_indices(points: np.ndarray, eps: float = 0.03, min_points: int = 10) -> np.ndarray:
    import open3d as o3d
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    labels = np.array(pcd.cluster_dbscan(eps=eps, min_points=min_points, print_progress=False))
    if (labels >= 0).any():
        largest = np.argmax(np.bincount(labels[labels >= 0]))
        return np.where(labels == largest)[0]
    return np.arange(points.shape[0])


@dataclass
class MergedCloud:
    points: np.ndarray              # (N, 3) float32, canonical frame
    normals: np.ndarray             # (N, 3) float32
    colors: np.ndarray              # (N, 3) float32 in [0, 1]
    view_indices: np.ndarray        # (N,) int8, which source view each point came from


def merge_views(
    view_dirs: list[tuple[Path, dict]],
    x_grid: np.ndarray,
    y_grid: np.ndarray,
    cluster_each: bool = True,
    cluster_each_eps: float = 0.03,
    cluster_each_min_points: int = 10,
    cluster_merged: bool = True,
    cluster_merged_eps: float = 0.04,
    cluster_merged_min_points: int = 25,
    depth_filename: str = "depth.npy",
) -> MergedCloud:
    all_points, all_normals, all_colors, all_view_idx = [], [], [], []
    for view_idx, (view_dir, pose) in enumerate(view_dirs):
        view = load_view_results(view_dir, depth_filename=depth_filename)
        pts, nml, col = view_to_canonical_pointcloud(view, pose, x_grid, y_grid)
        if cluster_each and pts.shape[0] > 0:
            keep = cluster_largest_indices(pts, eps=cluster_each_eps, min_points=cluster_each_min_points)
            pts, nml, col = pts[keep], nml[keep], col[keep]
        all_points.append(pts)
        all_normals.append(nml)
        all_colors.append(col)
        all_view_idx.append(np.full(pts.shape[0], view_idx, dtype=np.int8))

    points = np.concatenate(all_points, axis=0) if all_points else np.zeros((0, 3), dtype=np.float32)
    normals = np.concatenate(all_normals, axis=0) if all_normals else np.zeros((0, 3), dtype=np.float32)
    colors = np.concatenate(all_colors, axis=0) if all_colors else np.zeros((0, 3), dtype=np.float32)
    view_indices = np.concatenate(all_view_idx, axis=0) if all_view_idx else np.zeros((0,), dtype=np.int8)

    if cluster_merged and points.shape[0] > 0:
        keep = cluster_largest_indices(points, eps=cluster_merged_eps, min_points=cluster_merged_min_points)
        points, normals, colors, view_indices = points[keep], normals[keep], colors[keep], view_indices[keep]

    return MergedCloud(points=points, normals=normals, colors=colors, view_indices=view_indices)
