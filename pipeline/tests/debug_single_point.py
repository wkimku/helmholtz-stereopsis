"""Verify the Helmholtz constraint holds for a known surface point.

If W is built correctly and the synthetic renderer is consistent, then at the
true surface point on the sphere, W @ n_true should be ~0 component-wise, the
smallest singular value should be near zero, and the recovered null-vector
should match the true normal up to sign.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pipeline.helmholtz import build_w_matrix, cost_and_normal_from_w
from pipeline.synthetic import render_lambertian_sphere
from pipeline.utils import CameraIntrinsics, circular_camera_light_positions


def main() -> int:
    H = W = 64
    num_pairs = 9
    intr = CameraIntrinsics.from_blender(50.0, 100.0, W, H)
    cam, light = circular_camera_light_positions(num_pairs=num_pairs, radius=0.75)
    sphere_c = np.array([0.0, 0.0, 3.0], dtype=np.float32)
    r = 1.0

    gt = render_lambertian_sphere(cam, light, intr, sphere_c, r)

    # Pick an OFF-AXIS pixel so we don't hit the rotational-symmetry degeneracy.
    # The on-axis pixel of a sphere is symmetric in our circular camera/light
    # layout, which makes W rank-2 at every depth (depth ambiguity).
    px = (sphere_c[0] + 0.4, sphere_c[1] + 0.3)
    P_xy = np.array([px[0], px[1]], dtype=np.float32)
    rho2 = float(np.sum((P_xy - sphere_c[:2]) ** 2))
    if rho2 >= r * r:
        print("chosen (x,y) is off the sphere; reduce offsets")
        return 1
    z_true = float(sphere_c[2] - np.sqrt(r * r - rho2))
    P_true = np.array([P_xy[0], P_xy[1], z_true], dtype=np.float32)
    n_true = (P_true - sphere_c) / r
    print(f"True P: {P_true}, n: {n_true}")

    depths = np.linspace(2.0, 4.0, 21, dtype=np.float32)
    print("\ndepth   cost      normal_dot")
    for z in depths:
        P = np.array([P_xy[0], P_xy[1], z], dtype=np.float32)
        W_mat = build_w_matrix(P[None], gt.img_stack, cam, light, intr, num_pairs)
        cost, normal, eigvals = cost_and_normal_from_w(W_mat)
        n_est = normal[0]
        d = abs(float(n_est @ n_true))
        print(f"{z:.3f}  {float(cost[0]):10.4f}   |{d:.4f}|   eigvals={eigvals[0]}")

    # Direct check at true depth:
    W_at_true = build_w_matrix(P_true[None], gt.img_stack, cam, light, intr, num_pairs)
    print(f"\nAt true P, W shape={W_at_true.shape}")
    Wn = W_at_true[0] @ n_true
    print(f"W @ n_true = {Wn}, |W @ n_true| = {np.linalg.norm(Wn):.6f}")
    print(f"||W|| Frobenius = {np.linalg.norm(W_at_true[0]):.6f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
