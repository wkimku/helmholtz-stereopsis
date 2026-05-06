"""Frankot-Chellappa integration of a normal field into a height map.

The HS algorithm produces clean per-pixel surface normals but noisy per-pixel
depths because the cost ratio is sensitive to small input perturbations. The
classic remedy from Frankot & Chellappa (1988) is to enforce integrability:
treat the normal field as the gradient of an unknown height map and recover
the height by solving for the closest integrable field in the Fourier domain.

For a unit normal n = (nx, ny, nz) at world position (X, Y, z(X, Y)) the
surface gradient is

    p = ∂z/∂X = -nx / nz
    q = ∂z/∂Y = -ny / nz

Frankot-Chellappa solves for the height map Z whose FFT satisfies

    Ẑ(fx, fy) = (-j·fx·P̂ - j·fy·Q̂) / (fx² + fy²)

with Ẑ(0, 0) = 0 (the DC component is unconstrained by gradients alone). The
output is real-valued up to numerical noise; we take the real part and align
its mean to the raw depth so the absolute scale matches.
"""

from __future__ import annotations

import numpy as np


def integrate_normals_fc(
    normals: np.ndarray,
    mask: np.ndarray,
    world_extent_x: float = 2.0,
    world_extent_y: float = 2.0,
    align_to: np.ndarray | None = None,
) -> np.ndarray:
    """Recover a smooth height map from a normal field via Frankot-Chellappa.

    Parameters
    ----------
    normals
        (H, W, 3) unit normal vectors. Expected oriented so that nz > 0 over
        the foreground (the same convention `orient_normals` produces by
        default).
    mask
        (H, W) bool, True over the surface to integrate. Background pixels are
        zeroed to keep the FFT well-behaved.
    world_extent_x, world_extent_y
        Half-extent of the world XY grid (the algorithm uses a uniform grid
        of `(W, H)` samples spanning `[-extent, +extent]`). Required so the
        recovered height comes out in world depth units.
    align_to
        Optional (H, W) raw depth map. The output is shifted by a constant so
        its mean over `mask` matches the mean of `align_to` over `mask` —
        useful because Frankot-Chellappa leaves the DC term arbitrary.

    Returns
    -------
    height : (H, W) float32, smooth height map in world depth units.
    """
    H, W = normals.shape[:2]
    if H < 2 or W < 2:
        return np.zeros((H, W), dtype=np.float32)

    nx = normals[..., 0]
    ny = normals[..., 1]
    nz = normals[..., 2]
    nz_safe = np.where(np.abs(nz) > 1e-6, nz, np.sign(nz) * 1e-6 + 1e-12)

    # Gradients of z in WORLD units (dz/dX, dz/dY).
    p_world = -nx / nz_safe
    q_world = -ny / nz_safe

    # Convert to per-pixel-step gradients so the inverse FFT recovers z directly
    # in world depth units regardless of grid resolution.
    dx = 2.0 * world_extent_x / (W - 1)
    dy = 2.0 * world_extent_y / (H - 1)
    p = np.where(mask, p_world * dx, 0.0).astype(np.float64)
    q = np.where(mask, q_world * dy, 0.0).astype(np.float64)

    Fp = np.fft.fft2(p)
    Fq = np.fft.fft2(q)

    fx = (2.0 * np.pi * np.fft.fftfreq(W)).reshape(1, W)
    fy = (2.0 * np.pi * np.fft.fftfreq(H)).reshape(H, 1)
    denom = fx * fx + fy * fy
    denom_safe = np.where(denom == 0.0, 1.0, denom)
    Fz = (-1j * fx * Fp - 1j * fy * Fq) / denom_safe
    Fz[0, 0] = 0.0  # DC term is unconstrained.

    z = np.real(np.fft.ifft2(Fz)).astype(np.float32)

    if align_to is not None and mask.any():
        z = z + (float(align_to[mask].mean()) - float(z[mask].mean()))

    # Background remains 0 so masking on the consumer side stays cheap.
    z = np.where(mask, z, 0.0).astype(np.float32)
    return z
