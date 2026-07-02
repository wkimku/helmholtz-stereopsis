"""Core Helmholtz Stereopsis algorithm.

Reciprocity constraint (Zickler et al., ECCV 2002):
For a reciprocal image pair where camera and light positions are swapped between
two locations O_A and O_B, the surface normal n at scene point P satisfies

    [ I_A * (O_A - P) / |O_A - P|^3  -  I_B * (O_B - P) / |O_B - P|^3 ] · n  =  0

where I_A is the pixel intensity in the image taken with the camera at O_A
(lit from O_B) and I_B is the intensity in the swapped capture (camera at O_B,
lit from O_A). Each intensity couples with the direction toward its *own*
camera: writing the two rendering equations and eliminating the (reciprocal)
BRDF leaves I_A multiplied by the light cosine/falloff factor of the *other*
capture — and the other capture's light sits exactly where this capture's
camera is. Stacking N such row constraints into a matrix W(P), the true
surface point P* makes W rank-2; the normal is then the right null-vector of W.

We score depth candidates by how close W is to rank-2, using
    cost(P) = sigma_2(W) / sigma_1(W)
where the sigmas are sorted ascending. A larger cost means W is closer to being
rank-deficient, i.e. P is more likely the true surface point.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy.ndimage import uniform_filter

from .utils import CameraIntrinsics


@dataclass
class DepthSearchResult:
    depth: np.ndarray            # (H, W) float
    normal: np.ndarray           # (H, W, 3) float, unit length
    cost: np.ndarray             # (H, W) float, best (largest) cost per pixel
    depth_idx: np.ndarray        # (H, W) int, index into z_candidates
    cost_volume: Optional[np.ndarray] = None       # (H, W, nz)
    sigma_volume: Optional[np.ndarray] = None      # (H, W, nz, 3) singular values, ascending


def project_to_pixel(points_cam: np.ndarray, intr: CameraIntrinsics) -> tuple[np.ndarray, np.ndarray]:
    """Pinhole projection. points_cam[..., :3] -> (u, v) pixel coords."""
    z = points_cam[..., 2:3]
    xy = points_cam[..., :2] / z
    u = xy[..., 0] * intr.fx + intr.cx
    v = xy[..., 1] * intr.fy + intr.cy
    return u, v


def _sample_image_nearest(img: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Nearest-neighbor sample with edge clamping."""
    H, W = img.shape[:2]
    u_i = np.clip(np.round(u).astype(np.int64), 0, W - 1)
    v_i = np.clip(np.round(v).astype(np.int64), 0, H - 1)
    return img[v_i, u_i]


def build_w_matrix(
    surface_points: np.ndarray,    # (..., 3)
    img_stack: np.ndarray,          # (H, W, 2N) intensities
    camera_pos: np.ndarray,         # (2N, 3)
    light_pos: np.ndarray,          # (2N, 3)
    intr: CameraIntrinsics,
    num_pairs: int,
    eps: float = 1e-6,
) -> np.ndarray:
    """Build W(P) of shape (..., N, 3) for each candidate surface point.

    For pair k the two captures swap the camera and light between two
    positions. Writing the rendering equation for both captures and canceling
    the (reciprocal) BRDF gives the constraint

        n · ( I_r · nu_r / |nu_r|^3 - I_l · nu_l / |nu_l|^3 ) = 0

    where I_r, I_l are the pixel intensities of the two captures at the
    projection of P, and nu_r, nu_l point from P toward each capture's *own
    camera* position. The coupling is intensity-with-own-camera because
    eliminating the BRDF leaves each intensity multiplied by the light
    cosine/falloff of the *other* capture — whose light sits exactly where
    this capture's camera is.
    """
    out_shape = surface_points.shape[:-1] + (num_pairs, 3)
    W = np.zeros(out_shape, dtype=np.float32)

    for k in range(num_pairs):
        idx_r, idx_l = k, k + num_pairs

        # Project the candidate surface point into each image to read intensity.
        cam_to_p_r = surface_points - camera_pos[idx_r]
        cam_to_p_l = surface_points - camera_pos[idx_l]
        u_r, v_r = project_to_pixel(cam_to_p_r, intr)
        u_l, v_l = project_to_pixel(cam_to_p_l, intr)
        I_r = _sample_image_nearest(img_stack[..., idx_r], u_r, v_r)
        I_l = _sample_image_nearest(img_stack[..., idx_l], u_l, v_l)

        # Vector from P toward each capture's own camera. We read the position
        # from the *other* capture's light entry — in a reciprocal pair the
        # light of capture l sits exactly where the camera of capture r is.
        to_cam_r = light_pos[idx_l] - surface_points      # == camera_pos[idx_r] - P
        to_cam_l = light_pos[idx_r] - surface_points      # == camera_pos[idx_l] - P
        d_r = np.linalg.norm(to_cam_r, axis=-1, keepdims=True)
        d_l = np.linalg.norm(to_cam_l, axis=-1, keepdims=True)

        W[..., k, :] = (
            I_r[..., None] * to_cam_r / (d_r ** 3 + eps)
            - I_l[..., None] * to_cam_l / (d_l ** 3 + eps)
        )

    return W


def cost_and_normal_from_w(W: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per-point rank-2 closeness score and null-vector estimate.

    Returns
    -------
    cost : (...,)  sigma_2 / sigma_1, ascending — large means closer to rank-2
    normal : (..., 3) eigenvector of W^T W with smallest eigenvalue
    eigvals : (..., 3) ascending eigenvalues (== singular values squared)
    """
    WtW = np.einsum('...ri,...rj->...ij', W, W)
    eigvals, eigvecs = np.linalg.eigh(WtW)  # ascending

    normal = eigvecs[..., :, 0]
    s0 = np.sqrt(np.maximum(eigvals[..., 0], 0.0))
    s1 = np.sqrt(np.maximum(eigvals[..., 1], 0.0))
    cost = s1 / (s0 + 1e-6)
    return cost, normal, eigvals


def depth_search(
    img_stack: np.ndarray,
    camera_pos: np.ndarray,
    light_pos: np.ndarray,
    intr: CameraIntrinsics,
    x_grid: np.ndarray,            # (W,) world x for each column
    y_grid: np.ndarray,            # (H,) world y for each row
    z_candidates: np.ndarray,      # (nz,) world z values to search
    smoothing_size: int = 6,
    return_cost_volume: bool = False,
    return_sigma_volume: bool = False,
    progress_fn=None,              # optional callable(j, nz)
) -> DepthSearchResult:
    """Sweep z-planes; per pixel keep the best (largest) cost and its normal."""
    num_pairs = img_stack.shape[2] // 2
    H, W = len(y_grid), len(x_grid)
    nz = len(z_candidates)

    X, Y = np.meshgrid(x_grid, y_grid, indexing='xy')

    best_cost = np.full((H, W), -np.inf, dtype=np.float32)
    best_idx = np.zeros((H, W), dtype=np.int32)
    best_normal = np.zeros((H, W, 3), dtype=np.float32)
    cost_volume = np.zeros((H, W, nz), dtype=np.float32) if return_cost_volume else None
    sigma_volume = np.zeros((H, W, nz, 3), dtype=np.float32) if return_sigma_volume else None

    for j, z in enumerate(z_candidates):
        if progress_fn is not None:
            progress_fn(j, nz)

        surface_pts = np.stack([X, Y, np.full_like(X, z)], axis=-1).astype(np.float32)
        W_mat = build_w_matrix(surface_pts, img_stack, camera_pos, light_pos, intr, num_pairs)
        cost, normal, eigvals = cost_and_normal_from_w(W_mat)

        if smoothing_size and smoothing_size > 1:
            cost = uniform_filter(cost, size=smoothing_size)

        if return_cost_volume:
            cost_volume[:, :, j] = cost
        if return_sigma_volume:
            # eigvals are eigenvalues of W^T W, ascending — singular values are
            # the square roots. Clip tiny negatives that come from FP rounding.
            # Apply the same spatial smoothing as the cost so a sigma-ratio
            # peak recomputed from this volume lands on (nearly) the same depth
            # as the shipped cost/depth maps.
            sigmas = np.sqrt(np.maximum(eigvals, 0.0))
            if smoothing_size and smoothing_size > 1:
                for c in range(3):
                    sigmas[..., c] = uniform_filter(sigmas[..., c], size=smoothing_size)
            sigma_volume[:, :, j, :] = sigmas

        better = cost > best_cost
        best_cost = np.where(better, cost, best_cost)
        best_idx = np.where(better, j, best_idx)
        better_mask3 = better[..., None]
        best_normal = np.where(better_mask3, normal, best_normal)

    depth_map = z_candidates[best_idx].astype(np.float32)

    return DepthSearchResult(
        depth=depth_map,
        normal=best_normal,
        cost=best_cost,
        depth_idx=best_idx,
        cost_volume=cost_volume,
        sigma_volume=sigma_volume,
    )


def cost_curve_at_pixel(
    pixel_xy: tuple[float, float],
    img_stack: np.ndarray,
    camera_pos: np.ndarray,
    light_pos: np.ndarray,
    intr: CameraIntrinsics,
    z_candidates: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Cost(z) curve and per-z normal for a single (world-x, world-y) point.

    Useful for the interactive demo that plots sigma_2/sigma_1 vs depth so
    students can visually identify true depth and false peaks (depth ambiguity).
    """
    num_pairs = img_stack.shape[2] // 2
    x, y = pixel_xy
    pts = np.stack([np.full_like(z_candidates, x, dtype=np.float32),
                    np.full_like(z_candidates, y, dtype=np.float32),
                    z_candidates.astype(np.float32)], axis=-1)
    W_mat = build_w_matrix(pts, img_stack, camera_pos, light_pos, intr, num_pairs)
    cost, normal, _ = cost_and_normal_from_w(W_mat)
    return cost, normal


def orient_normals(
    normals: np.ndarray,
    view_dir: np.ndarray = np.array([0.0, 0.0, 1.0], dtype=np.float32),
) -> np.ndarray:
    """Flip normals so they face the given view direction."""
    dot = normals @ view_dir
    flip = dot < 0
    out = normals.copy()
    out[flip] = -out[flip]
    return out


def confidence_mask(
    cost: np.ndarray,
    valid_mask: np.ndarray,
    drop_percentile: float = 0.0,
) -> np.ndarray:
    """Drop the bottom-N percent of valid pixels by cost (rank-2 closeness).

    A larger sigma_2/sigma_1 ratio means W is closer to rank-2, so depth/normal
    estimates are more reliable. Pixels below the cost threshold are removed
    from `valid_mask`. Pass `drop_percentile=0` to keep all valid pixels.
    """
    if drop_percentile <= 0.0 or not valid_mask.any():
        return valid_mask.copy()
    threshold = float(np.percentile(cost[valid_mask], drop_percentile))
    return valid_mask & (cost > threshold)
