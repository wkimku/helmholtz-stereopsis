# Local pipeline server

Powers the §10 "Try-it-yourself sandbox" section of the static demo. Runs a
small HTTP server on `http://127.0.0.1:8765` that the static page calls into
to render reciprocal pairs in Blender and solve depth + normal on demand.

## Prerequisites

* macOS with Blender 4.x at `/Applications/Blender.app`, or point the server at
  your install with `--blender /path/to/blender` (or the `HS_BLENDER`
  environment variable). The Blender path is fixed when the server starts — it
  is never taken from a browser request.
* Python 3.10+ with `numpy`, `scipy`, `Pillow`, `open3d`. If you've already
  installed the main pipeline (`pipeline/requirements.txt` at the repo root),
  you have everything you need.

## Run

From the repo root:

```bash
cd sandbox
python3 -m hs_demo.server
```

You should see:

```
Serving Helmholtz demo at http://127.0.0.1:8765
```

Open the static demo (locally with `cd web && npm run dev`, or the deployed
GitHub Pages URL) and scroll to §10. The status banner should switch from
amber ("Local server not detected") to green within a few seconds.

Click **Run pipeline** with the parameters you want. The server will:

1. Spawn Blender in `--background` mode with `scripts/blender_cli.py render` to
   render the reciprocal pair stack.
2. Run `python -m hs_demo.cli solve` to estimate per-pixel depth and normal.
3. Run `python -m hs_demo.cli merge` to fuse and export a downsampled point
   cloud + previews to `web/data/latest_run.json`.

The static page polls progress and renders the depth map, normal map, and
point cloud inline when the run finishes.

## Parameter notes

| Parameter      | Range     | Effect                                         |
|----------------|-----------|------------------------------------------------|
| Object         | suzanne / cube / sphere | Geometry. Cube/sphere highlight algorithm behavior on flat / smooth surfaces. |
| Reflectance    | noise / matte / checker | Material. Noise breaks the symmetry that makes Lambertian fail; matte and checker show the ambiguity behavior more clearly. |
| Reciprocal pairs | 3 – 18 | Number of reciprocal captures. Higher = more constraints, less noise, slower render. |
| Depth-search steps | 16 – 256 | Resolution of the per-pixel depth grid. |
| Resolution     | 64 – 512  | Image resolution. Quadratic effect on render and solve time. |
| Render samples | 1 – 256   | Cycles samples per pixel. Higher = cleaner Monte Carlo noise. |
| Pair radius    | 0.1 – 2.0 | How far the camera/light sit from the optical axis. |
| Object distance | 1.5 – 6.0 | World-space depth of the subject. |
| Image noise (σ) | 0 – 30   | Optional Gaussian noise added to each captured image to test robustness. |

## Troubleshooting

* **Status banner stays amber**: confirm the server is running and listening on
  `127.0.0.1:8765`. The page polls `/api/health` every five seconds.
* **Run errors out at the render stage**: the most common cause is the wrong
  Blender path. Restart the server with `--blender /path/to/blender` (or set
  `HS_BLENDER`) if your install is somewhere other than the default.
* **Run errors out at the solve stage**: usually a missing Python dependency.
  Reinstall with `pip install -r ../pipeline/requirements.txt`.
* **CORS error in the browser console**: only happens if you point the static
  page at a non-default port; the server already sets a permissive CORS
  policy because it only listens on localhost.
