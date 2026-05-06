"""Configuration objects for the Helmholtz stereopsis pipeline."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
import math
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CameraIntrinsics:
    width: int
    height: int
    fx: float
    fy: float
    cx: float
    cy: float

    @classmethod
    def from_lens(
        cls,
        width: int,
        height: int,
        lens_mm: float,
        sensor_width_mm: float,
    ) -> "CameraIntrinsics":
        fx = lens_mm * width / sensor_width_mm
        fy = lens_mm * height / sensor_width_mm
        return cls(width=width, height=height, fx=fx, fy=fy, cx=width / 2, cy=height / 2)


@dataclass(frozen=True)
class CaptureConfig:
    resolution: int = 256
    samples: int = 64
    lens_mm: float = 50.0
    sensor_width_mm: float = 100.0
    num_pairs: int = 9
    ring_radius: float = 0.75
    light_energy: float = 200.0
    object_size: float = 2.0
    object_kind: str = "suzanne"
    object_distance: float = 3.0
    material_kind: str = "noise"
    image_noise_std: float = 0.0
    view_transform: str = "Raw"

    @property
    def intrinsics(self) -> CameraIntrinsics:
        return CameraIntrinsics.from_lens(
            width=self.resolution,
            height=self.resolution,
            lens_mm=self.lens_mm,
            sensor_width_mm=self.sensor_width_mm,
        )


@dataclass(frozen=True)
class SolverConfig:
    xy_min: float = -2.0
    xy_max: float = 2.0
    z_min: float = 2.0
    z_max: float = 4.0
    depth_steps: int = 128
    smoothing_window: int = 6
    epsilon: float = 1e-6
    background_threshold: int = 15


@dataclass(frozen=True)
class ViewSpec:
    name: str
    object_location: tuple[float, float, float]
    object_rotation_euler: tuple[float, float, float]
    merge_rotation_euler: tuple[float, float, float] = (0.0, 0.0, 0.0)
    merge_rotation_order: str = "xyz"
    merge_translation: tuple[float, float, float] = (0.0, 0.0, 0.0)


@dataclass(frozen=True)
class RunConfig:
    capture: CaptureConfig = field(default_factory=CaptureConfig)
    solver: SolverConfig = field(default_factory=SolverConfig)
    views: tuple[str, ...] = ("front",)


DEFAULT_VIEWS: dict[str, ViewSpec] = {
    "front": ViewSpec(
        name="front",
        object_location=(0.0, 0.0, 3.0),
        object_rotation_euler=(math.pi / 2, 0.0, 0.0),
    ),
    "back": ViewSpec(
        name="back",
        object_location=(0.0, 0.0, 3.0),
        object_rotation_euler=(math.pi / 2, math.pi, 0.0),
        merge_rotation_euler=(0.0, -math.pi, 0.0),
        merge_translation=(0.0, 0.0, 6.0),
    ),
    "right": ViewSpec(
        name="right",
        object_location=(0.0, 0.0, 3.0),
        object_rotation_euler=(math.pi / 2, math.pi / 2, 0.0),
        merge_rotation_euler=(0.0, math.pi / 2, 0.0),
        merge_translation=(3.0, 0.0, 3.0),
    ),
    "left": ViewSpec(
        name="left",
        object_location=(0.0, 0.0, 3.0),
        object_rotation_euler=(math.pi / 2, -math.pi / 2, 0.0),
        merge_rotation_euler=(0.0, -math.pi / 2, 0.0),
        merge_translation=(-3.0, 0.0, 3.0),
    ),
    "up": ViewSpec(
        name="up",
        object_location=(0.0, 0.0, 3.0),
        object_rotation_euler=(math.pi, 0.0, 0.0),
        merge_rotation_order="xyz",
        merge_rotation_euler=(-math.pi / 2, math.pi, math.pi),
        merge_translation=(0.0, -3.0, 3.0),
    ),
    "down": ViewSpec(
        name="down",
        object_location=(0.0, 0.0, 3.0),
        object_rotation_euler=(0.0, 0.0, 0.0),
        merge_rotation_order="xyz",
        merge_rotation_euler=(math.pi / 2, math.pi, math.pi),
        merge_translation=(0.0, 3.0, 3.0),
    ),
}


def save_config(path: str | Path, config: RunConfig) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(config), indent=2), encoding="utf-8")


def load_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))
