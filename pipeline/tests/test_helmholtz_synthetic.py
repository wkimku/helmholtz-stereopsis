"""Smoke test: run the depth-search on a synthetic Lambertian sphere.

The test checks that the recovered depth and normal closely match the analytic
ground truth produced by `synthetic.render_lambertian_sphere`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pipeline.helmholtz import depth_search, orient_normals
from pipeline.synthetic import render_lambertian_sphere
from pipeline.utils import CameraIntrinsics, circular_camera_light_positions


def main() -> int:
    H = W = 128
    num_pairs = 9
    intr = CameraIntrinsics.from_blender(focal_mm=50.0, sensor_width_mm=100.0, width=W, height=H)
    cam, light = circular_camera_light_positions(num_pairs=num_pairs, radius=0.75)

    print(f"Rendering synthetic sphere {W}x{H}, {2*num_pairs} images...")
    gt = render_lambertian_sphere(cam, light, intr,
                                  sphere_center=np.array([0.0, 0.0, 3.0], dtype=np.float32),
                                  sphere_radius=1.0, albedo=1.0)

    print("Running depth search...")
    x_grid = np.linspace(-2.0, 2.0, W, dtype=np.float32)
    y_grid = np.linspace(-2.0, 2.0, H, dtype=np.float32)
    z_grid = np.linspace(2.0, 4.0, 64, dtype=np.float32)

    result = depth_search(
        img_stack=gt.img_stack,
        camera_pos=cam, light_pos=light, intr=intr,
        x_grid=x_grid, y_grid=y_grid, z_candidates=z_grid,
        smoothing_size=3, return_cost_volume=False,
    )

    valid = gt.mask
    n_valid = int(valid.sum())
    if n_valid == 0:
        print("FAIL: no foreground pixels in ground truth")
        return 1
    depth_err = np.abs(result.depth[valid] - gt.depth[valid])
    # HS recovers normals up to a sign per pixel; compare with sign-invariant angle.
    normal_dot = np.abs(np.einsum("...i,...i->...", result.normal[valid], gt.normal[valid]))
    angle_err_deg = np.degrees(np.arccos(np.clip(normal_dot, 0.0, 1.0)))

    median_depth_err = float(np.median(depth_err))
    median_angle_err = float(np.median(angle_err_deg))
    print(f"valid pixels: {n_valid}")
    print(f"depth abs error  median={median_depth_err:.4f}  p90={np.percentile(depth_err,90):.4f}")
    print(f"normal angle err median={median_angle_err:.2f} deg  p90={np.percentile(angle_err_deg,90):.2f} deg")

    z_step = float(z_grid[1] - z_grid[0])
    ok_depth = median_depth_err < 4.0 * z_step
    ok_normal = median_angle_err < 15.0
    if ok_depth and ok_normal:
        print(f"PASS (z_step={z_step:.4f})")
        return 0
    print(f"FAIL (z_step={z_step:.4f}): depth_ok={ok_depth} normal_ok={ok_normal}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
