"""Export the canonical mesh of each demo object to a small GLB file the web
demo can load via Three.js. Cube and sphere are built from primitives on the
JS side; only Suzanne actually needs an asset, since Three.js does not have a
built-in monkey mesh.

Run inside Blender:

    blender --background --python pipeline/export_meshes.py -- \
        --output web/public/meshes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import bpy  # type: ignore
except ImportError:  # pragma: no cover
    bpy = None


def parse_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True, type=Path,
                   help="Output directory (the web's /meshes/ folder).")
    return p.parse_args(argv)


def export_suzanne(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_monkey_add(size=2)
    suzanne_path = out_dir / "suzanne.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(suzanne_path),
        export_format="GLB",
        # Keep the file tiny; we don't need materials, animations, or extras.
        use_selection=False,
        export_apply=True,
        export_animations=False,
        export_materials="NONE",
    )
    print(f"wrote {suzanne_path}")


def main(argv: list[str] | None = None) -> None:
    if bpy is None:
        sys.stderr.write("This script must be run inside Blender.\n")
        sys.exit(1)
    args = parse_args(list(argv) if argv is not None else sys.argv)
    export_suzanne(args.output)


if __name__ == "__main__":
    main()
