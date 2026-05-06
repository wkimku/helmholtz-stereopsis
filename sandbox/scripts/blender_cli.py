"""Run the hs_demo CLI from Blender background mode.

Example:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/blender_cli.py -- render --run runs/quick --view front
"""

from __future__ import annotations

from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

if "--" in sys.argv:
    sys.argv = [sys.argv[0], *sys.argv[sys.argv.index("--") + 1 :]]

from hs_demo.cli import main  # noqa: E402


if __name__ == "__main__":
    main()

