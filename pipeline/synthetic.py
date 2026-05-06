"""Analytic Lambertian sphere renderer used for tests and Blender-free demos.

Renders a perfect Lambertian sphere by closed-form ray-sphere intersection so
the Helmholtz reciprocity constraint holds exactly, giving a clean ground truth
for validating the depth-search code without involving a renderer.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .utils import CameraIntrinsics


@dataclass
class SyntheticGroundTruth:
    img_stack: np.ndarray   # (H, W, 2N) intensities, float32
    depth: np.ndarray       # (H, W) world Z at hit, 0 where background
    normal: np.ndarray      # (H, W, 3) unit, (0,0,0) where background
    mask: np.ndarray        # (H, W) bool


def _ray_directions(intr: CameraIntrinsics) -> np.ndarray:
    """Per-pixel unit ray directions in the camera frame (+Z forward)."""
    u = (np.arange(intr.width, dtype=np.float32) - intr.cx) / intr.fx
    v = (np.arange(intr.height, dtype=np.float32) - intr.cy) / intr.fy
    U, V = np.meshgrid(u, v, indexing="xy")
    rays = np.stack([U, V, np.ones_like(U)], axis=-1)
    rays /= np.linalg.norm(rays, axis=-1, keepdims=True)
    return rays


def _textured_albedo(P: np.ndarray, base: float = 0.5, scale: float = 6.0) -> np.ndarray:
    """Position-dependent albedo so the rendered image has intensity variation.

    A perfectly uniform sphere is the worst case for Helmholtz Stereopsis: its
    rotational symmetry causes W to be rank-2 at many depths, which collapses
    the cost function to a flat ridge. Adding spatial variation breaks the
    symmetry while keeping the BRDF reciprocal (Lambertian with varying albedo
    still satisfies Helmholtz reciprocity).
    """
    s = (
        np.sin(scale * P[..., 0])
        * np.cos(scale * P[..., 1])
        * np.sin(scale * 0.7 * P[..., 2])
    )
    return base + 0.45 * s


def render_lambertian_sphere(
    camera_pos: np.ndarray,
    light_pos: np.ndarray,
    intr: CameraIntrinsics,
    sphere_center: np.ndarray = np.array([0.0, 0.0, 3.0], dtype=np.float32),
    sphere_radius: float = 1.0,
    albedo: float | None = None,
    textured: bool = True,
) -> SyntheticGroundTruth:
    """Render a Lambertian sphere from each camera/light position.

    Camera at iteration i is at `camera_pos[i]`, light at `light_pos[i]`. The
    image stack has the same channel ordering, ready for `helmholtz.depth_search`.
    """
    n = camera_pos.shape[0]
    H, W = intr.height, intr.width
    rays = _ray_directions(intr)

    img_stack = np.zeros((H, W, n), dtype=np.float32)

    # Ground-truth depth and normal correspond to camera at the origin (the
    # reference base view in our circular setup, matching how depth/normal
    # are reported in world Z).
    base_depth = np.zeros((H, W), dtype=np.float32)
    base_normal = np.zeros((H, W, 3), dtype=np.float32)
    base_mask = np.zeros((H, W), dtype=bool)

    for i in range(n):
        cam = camera_pos[i].astype(np.float32)
        light = light_pos[i].astype(np.float32)

        oc = cam - sphere_center.astype(np.float32)
        b = 2.0 * (rays @ oc)
        c = float(np.dot(oc, oc) - sphere_radius ** 2)
        disc = b * b - 4.0 * c
        hit = disc > 0
        sqrt_disc = np.sqrt(np.where(hit, disc, 0.0))
        t = (-b - sqrt_disc) * 0.5
        hit &= t > 0

        P = cam[None, None, :] + t[..., None] * rays
        N = (P - sphere_center[None, None, :]) / sphere_radius
        L_vec = light[None, None, :] - P
        L_dist = np.linalg.norm(L_vec, axis=-1)
        L = L_vec / np.maximum(L_dist[..., None], 1e-9)
        cos_theta = np.clip(np.einsum("...i,...i->...", N, L), 0.0, None)
        if textured:
            a = _textured_albedo(P)
        else:
            a = float(albedo if albedo is not None else 1.0)
        intensity = a * cos_theta / np.maximum(L_dist ** 2, 1e-9)

        img_stack[..., i] = np.where(hit, intensity, 0.0)

        if i == 0:
            # Use the first viewpoint's geometry as ground truth depth/normal
            # under the assumption that all viewpoints see the same sphere.
            # We re-run intersection from a hypothetical reference camera at
            # the world origin to keep depth measured in world coordinates.
            pass

    # Compute ground truth from a fixed reference camera at world origin.
    cam_ref = np.zeros(3, dtype=np.float32)
    oc = cam_ref - sphere_center.astype(np.float32)
    b = 2.0 * (rays @ oc)
    c = float(np.dot(oc, oc) - sphere_radius ** 2)
    disc = b * b - 4.0 * c
    hit = disc > 0
    sqrt_disc = np.sqrt(np.where(hit, disc, 0.0))
    t = (-b - sqrt_disc) * 0.5
    hit &= t > 0
    P = cam_ref[None, None, :] + t[..., None] * rays
    N = (P - sphere_center[None, None, :]) / sphere_radius
    base_depth = np.where(hit, P[..., 2], 0.0).astype(np.float32)
    base_normal = np.where(hit[..., None], N, 0.0).astype(np.float32)
    base_mask = hit

    return SyntheticGroundTruth(
        img_stack=img_stack,
        depth=base_depth,
        normal=base_normal,
        mask=base_mask,
    )
