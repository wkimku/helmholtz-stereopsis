"""Open3D conversion, merging, and web export helpers."""

from __future__ import annotations

import base64
from io import BytesIO
import json
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation as R

from .config import DEFAULT_VIEWS, SolverConfig, ViewSpec


def _require_open3d():
    try:
        import open3d as o3d  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local Open3D install
        raise RuntimeError("Open3D is required for point-cloud reconstruction.") from exc
    return o3d


def point_cloud_from_maps(
    depth: np.ndarray,
    normal: np.ndarray,
    rgb: np.ndarray | None = None,
    solver: SolverConfig | None = None,
) -> object:
    o3d = _require_open3d()
    if solver is None:
        solver = SolverConfig()
    height, width = depth.shape
    xs = np.linspace(solver.xy_min, solver.xy_max, width)
    ys = np.linspace(solver.xy_min, solver.xy_max, height)
    x_grid, y_grid = np.meshgrid(xs, ys, indexing="xy")

    valid = depth.reshape(-1) > 0
    points = np.stack([x_grid, y_grid, depth], axis=-1).reshape(-1, 3)[valid]
    normals = normal.reshape(-1, 3)[valid]
    if rgb is None:
        colors = np.full((points.shape[0], 3), 0.78, dtype=np.float64)
    else:
        colors = rgb.reshape(-1, 3)[valid].astype(np.float64) / 255.0

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    pcd.normals = o3d.utility.Vector3dVector(normals)
    pcd.colors = o3d.utility.Vector3dVector(colors)
    return pcd


def largest_cluster(pcd: object, eps: float = 0.03, min_points: int = 10) -> object:
    labels = np.asarray(pcd.cluster_dbscan(eps=eps, min_points=min_points, print_progress=True))
    foreground = labels >= 0
    if not np.any(foreground):
        return pcd
    largest = np.argmax(np.bincount(labels[foreground]))
    return pcd.select_by_index(np.where(labels == largest)[0])


def transform_view_cloud(pcd: object, view: ViewSpec) -> object:
    o3d = _require_open3d()
    rotation = R.from_euler(
        view.merge_rotation_order,
        view.merge_rotation_euler,
        degrees=False,
    ).inv().as_matrix()
    translation = np.asarray(view.merge_translation)

    points = np.asarray(pcd.points)
    normals = np.asarray(pcd.normals)
    pcd.points = o3d.utility.Vector3dVector((rotation @ points.T).T + translation)
    pcd.normals = o3d.utility.Vector3dVector((rotation @ normals.T).T)
    return pcd


def load_solution_view(
    view_dir: str | Path,
    solver: SolverConfig | None = None,
    prefer_clean: bool = True,
    cluster: bool = True,
) -> object:
    view_dir = Path(view_dir)
    solution_dir = view_dir / "solution"
    depth_name = "depth_clean.npy" if prefer_clean and (solution_dir / "depth_clean.npy").exists() else "depth_map.npy"
    normal_name = "normal_clean.npy" if prefer_clean and (solution_dir / "normal_clean.npy").exists() else "normal_map.npy"
    rgb_path = view_dir / "raw" / "mask_rgb.png"
    rgb = np.asarray(Image.open(rgb_path))[:, :, :3] if rgb_path.exists() else None
    pcd = point_cloud_from_maps(
        depth=np.load(solution_dir / depth_name),
        normal=np.load(solution_dir / normal_name),
        rgb=rgb,
        solver=solver,
    )
    return largest_cluster(pcd) if cluster else pcd


def merge_views(
    run_dir: str | Path,
    view_names: Iterable[str],
    solver: SolverConfig | None = None,
    cluster_each: bool = True,
) -> object:
    o3d = _require_open3d()
    merged = o3d.geometry.PointCloud()
    for view_name in view_names:
        view = DEFAULT_VIEWS[view_name]
        pcd = load_solution_view(Path(run_dir) / view_name, solver=solver, cluster=cluster_each)
        merged += transform_view_cloud(pcd, view)
    return merged


def write_point_cloud(path: str | Path, pcd: object) -> Path:
    o3d = _require_open3d()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    o3d.io.write_point_cloud(str(path), pcd)
    return path


def export_web_pointcloud(
    pcd: object,
    path: str | Path,
    max_points: int = 50000,
    seed: int = 7,
    run_dir: str | Path | None = None,
    view_names: Iterable[str] | None = None,
) -> Path:
    points = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors)
    normals = np.asarray(pcd.normals)
    source_point_count = int(len(points))
    if len(points) > max_points:
        rng = np.random.default_rng(seed)
        keep = rng.choice(len(points), size=max_points, replace=False)
        points = points[keep]
        colors = colors[keep]
        normals = normals[keep]

    payload = {
        "schema": "hs-demo-web-v1",
        "points": np.round(points, 5).tolist(),
        "colors": np.round(colors, 5).tolist(),
        "normals": np.round(normals, 5).tolist(),
        "pointCloud": {
            "pointCount": int(len(points)),
            "sourcePointCount": source_point_count,
            "maxPoints": max_points,
        },
    }
    if run_dir is not None and view_names is not None:
        payload["run"] = _web_run_manifest(run_dir, view_names)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _web_run_manifest(run_dir: str | Path, view_names: Iterable[str]) -> dict[str, object]:
    run_dir = Path(run_dir)
    views = {}
    for view_name in view_names:
        view_dir = run_dir / view_name
        if not view_dir.exists():
            continue
        views[view_name] = _web_view_manifest(view_dir)
    return {
        "path": str(run_dir),
        "views": list(views.keys()),
        "viewData": views,
    }


def _web_view_manifest(view_dir: Path) -> dict[str, object]:
    solution_dir = view_dir / "solution"
    capture_meta = _load_json_if_exists(view_dir / "capture_meta.json")
    solver_config = _load_json_if_exists(solution_dir / "solver_config.json")

    depth_path = _first_existing(solution_dir / "depth_clean.png", solution_dir / "depth_map.png")
    normal_path = _first_existing(solution_dir / "normal_clean.png", solution_dir / "normal_map.png")
    depth_npy = _first_existing(solution_dir / "depth_clean.npy", solution_dir / "depth_map.npy")
    confidence_npy = solution_dir / "confidence.npy"

    stats: dict[str, object] = {}
    if depth_npy is not None:
        depth = np.load(depth_npy)
        valid = depth > 0
        stats["validPixels"] = int(valid.sum())
        if np.any(valid):
            stats["depthMin"] = float(depth[valid].min())
            stats["depthMax"] = float(depth[valid].max())

    previews: dict[str, str] = {}
    if depth_path is not None:
        previews["depth"] = _file_data_url(depth_path)
    if normal_path is not None:
        previews["normal"] = _file_data_url(normal_path)
    if confidence_npy.exists():
        confidence = np.load(confidence_npy)
        finite = np.isfinite(confidence)
        if np.any(finite):
            stats["confidenceMean"] = float(confidence[finite].mean())
            stats["confidenceMax"] = float(confidence[finite].max())
        previews["confidence"] = _array_png_data_url(confidence)

    return {
        "name": view_dir.name,
        "capture": capture_meta,
        "solver": solver_config,
        "stats": stats,
        "previews": previews,
    }


def _load_json_if_exists(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _first_existing(*paths: Path) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def _file_data_url(path: Path) -> str:
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{data}"


def _array_png_data_url(array: np.ndarray) -> str:
    finite = np.isfinite(array)
    if not np.any(finite):
        image = np.zeros(array.shape, dtype=np.uint8)
    else:
        values = array[finite]
        lo = float(np.percentile(values, 2))
        hi = float(np.percentile(values, 98))
        scale = max(hi - lo, 1e-6)
        image = np.clip((array - lo) / scale, 0.0, 1.0)
        image[~finite] = 0.0
        image = (image * 255).astype(np.uint8)
    buffer = BytesIO()
    Image.fromarray(image).save(buffer, format="PNG")
    data = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{data}"
