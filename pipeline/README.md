# Pipeline

Python data pipeline for the Helmholtz Stereopsis demo.

## Modules

| File | Purpose |
|------|---------|
| `utils.py` | Camera intrinsics, circular camera/light geometry |
| `helmholtz.py` | Core depth-search algorithm and per-pixel cost curves |
| `synthetic.py` | Lambertian sphere renderer (no Blender) for tests and fallback data |
| `render.py` | Blender script: clean scene, place object, sweep camera/light, save images + `scene.json` |
| `reconstruct.py` | Multi-view masking, clustering, and merging into a single point cloud |
| `precompute.py` | Orchestrator: run depth search on a rendered scene → write `results/` |

## Typical workflow

```bash
# 1. Render reciprocal pairs in Blender (one pose at a time).
/Applications/Blender.app/Contents/MacOS/Blender --background --python pipeline/render.py -- \
    --output data/suzanne_front --object suzanne --pose front --pairs 9 --resolution 512

# 2. Compute depth and normal maps from the captured stack.
python -m pipeline.precompute --scene data/suzanne_front --nz 256

# 3. (Optional) Repeat steps 1–2 for additional poses (back, left, right, up, down)
#    then merge them with reconstruct.merge_views.
```

## Running without Blender

`synthetic.render_lambertian_sphere` produces a ground-truth-aligned image stack
that flows through the same depth-search code. Useful as a smoke test:

```python
from pipeline.utils import CameraIntrinsics, circular_camera_light_positions
from pipeline.synthetic import render_lambertian_sphere
from pipeline.helmholtz import depth_search

intr = CameraIntrinsics.from_blender(50.0, 100.0, 256, 256)
cam, light = circular_camera_light_positions(num_pairs=9, radius=0.75)
gt = render_lambertian_sphere(cam, light, intr)
# ... feed gt.img_stack into depth_search and compare with gt.depth, gt.normal
```
