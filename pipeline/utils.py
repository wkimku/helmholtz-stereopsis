"""Geometry helpers for camera/light layouts and pinhole intrinsics."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class CameraIntrinsics:
    fx: float
    fy: float
    cx: float
    cy: float
    width: int
    height: int

    @classmethod
    def from_blender(cls, focal_mm: float, sensor_width_mm: float, width: int, height: int) -> "CameraIntrinsics":
        fx = focal_mm * width / sensor_width_mm
        fy = focal_mm * height / sensor_width_mm
        return cls(fx=fx, fy=fy, cx=width / 2, cy=height / 2, width=width, height=height)

    def as_dict(self) -> dict:
        return {
            "fx": self.fx, "fy": self.fy, "cx": self.cx, "cy": self.cy,
            "width": self.width, "height": self.height,
        }


def circular_camera_light_positions(
    num_pairs: int,
    radius: float = 0.75,
    z: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Place 2N camera/light positions evenly on a circle in the xy-plane.

    The light at index i sits antipodal to the camera at index i, so swapping
    camera/light between indices k and k+N forms reciprocal pair k.
    """
    n_total = 2 * num_pairs
    angles = np.linspace(0.0, 2.0 * np.pi, n_total, endpoint=False)
    cos = np.cos(angles)
    sin = np.sin(angles)
    z_col = np.full(n_total, z, dtype=np.float64)
    camera_pos = np.stack([radius * cos, radius * sin, z_col], axis=-1)
    light_pos = np.stack([-radius * cos, -radius * sin, z_col], axis=-1)
    return camera_pos.astype(np.float32), light_pos.astype(np.float32)


def reciprocal_pair_indices(num_pairs: int) -> list[tuple[int, int]]:
    """For each pair k in [0, N), return the two image indices (k, k + N)."""
    return [(k, k + num_pairs) for k in range(num_pairs)]
