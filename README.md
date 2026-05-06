# Helmholtz Stereopsis — Interactive Demo

An interactive walkthrough of the Helmholtz Stereopsis algorithm (Zickler et al., ECCV 2002), built for students entering the field. The demo runs as a static site and lets you click pixels, change reciprocal-pair counts, toggle which capture sessions contribute to a fused point cloud, and orbit the recovered 3D model directly in the browser.

Built by the [Light Transport Lab](https://www.cs.cmu.edu/~motoole2/), Carnegie Mellon University.

```
.
├── pipeline/      Python: Blender rendering, depth search, F-C integration, multi-view fusion
├── sandbox/       Python: local HTTP server that powers §10 — calls Blender + the pipeline
├── web/           Vite + React + Three.js frontend (deployed to GitHub Pages)
├── data/          (gitignored) Per-scene rendered images + algorithm outputs
├── LICENSE
└── README.md
```

## Quick start

### Prerequisites

* macOS with Blender 4.x at `/Applications/Blender.app` (or adjust the path)
* Python 3.10+ with `pip install -r pipeline/requirements.txt`
* Node 20+ for the web frontend

### Demo workflow (the version shipped with this repo)

The site supports **three switchable scenes** — Suzanne, Cube, and Sphere — controlled by the picker in the sidebar. Each scene contributes three datasets, named by a common prefix:

| Web folder                              | What it is                                | Used by section |
|-----------------------------------------|-------------------------------------------|-----------------|
| `web/public/data/<scene>/`              | One high-quality render (N=18 pairs) with cost volume | §3 §5 §6        |
| `web/public/data/<scene>_pairs/`        | Same render, depth/normal at N=3, 6, 9, 18 | §7              |
| `web/public/data/<scene>_full/`         | Six axis-aligned renders fused into one cloud | §8 §9           |

`web/public/data/scenes.json` lists the available scenes for the picker. Add an entry to ship a new scene to the site.

Reproduce one scene like so (substitute `OBJ` for `suzanne` / `cube` / `sphere`):

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
OBJ=suzanne   # or cube, sphere

# 1. Six axis-aligned renders for the multi-view merge (N=9 each).
for POSE in front back left right up down; do
    $BL --background --python pipeline/render.py -- \
        --output data/${OBJ}_${POSE} --object $OBJ --pose $POSE \
        --pairs 9 --resolution 512 --samples 64
done

# 2. One hero render with N=18 pairs for the per-pixel cost-curve demo.
$BL --background --python pipeline/render.py -- \
    --output data/${OBJ}_hero --object $OBJ --pose front \
    --pairs 18 --resolution 512 --samples 64

# 3. Depth search + cost volume + visualizations + web export for the hero view.
python -m pipeline.precompute --scene data/${OBJ}_hero --nz 128
python -m pipeline.web_export --scene data/${OBJ}_hero --out web/public/data/${OBJ}

# 4. Render N=3, 6, 9, 18 variants of the same hero scene for §7.
python -m pipeline.pairs_comparison --scene data/${OBJ}_hero \
    --pair-counts 3 6 9 18 --out-base web/public/data/${OBJ}_pairs --nz 128

# 5. Run the depth search on each axis-aligned view, transform back into the
#    canonical frame, and concatenate into one point cloud for §8/§9.
python -m pipeline.merge_views \
    --views data/${OBJ}_front data/${OBJ}_back data/${OBJ}_left \
            data/${OBJ}_right data/${OBJ}_up data/${OBJ}_down \
    --out web/public/data/${OBJ}_full --nz 128 \
    --cluster-each-eps 0.05 --cluster-each-min-points 15 \
    --cluster-merged-eps 0.06 --cluster-merged-min-points 25
```

The shipped datasets follow this naming convention. (Suzanne was the first scene wired up and uses unprefixed `data/front`, `data/back`, …, `data/front_hero`; both naming styles work with the scripts.)

A confidence filter is applied by default in step 3 and step 5 — pixels with the bottom 15% of `σ₂/σ₁` cost are dropped. Tune with `--cost-drop-percentile`.

### Run the site

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:5173>.

### Build and deploy

The repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds the site with the correct `VITE_BASE_PATH` for GitHub Pages and deploys on every push to `main`. `web/public/data/` is shipped as part of the static site, so commit the data folders (or replace them with your own renders) before pushing.

## Local sandbox (powers §10)

The §10 *Try-it-yourself* section talks to a small Python server at
`http://127.0.0.1:8765`. The server lives in `sandbox/` and exists so the
deployed static page (which can't run Blender on its own) can act as the UI
for a local pipeline run when the user has Blender installed.

```bash
cd sandbox
python3 -m hs_demo.server
```

Once it's running the §10 status banner switches to green and the controls
become interactive. See `sandbox/README.md` for parameter notes and
troubleshooting.

## Validating without Blender

`pipeline.synthetic` renders a Lambertian sphere analytically and runs through the same depth-search code — handy as a smoke test:

```bash
python -m pipeline.tests.test_helmholtz_synthetic
```

You can also sanity-check a merged dataset by rendering a quick matplotlib preview:

```bash
python -m pipeline.tools.preview_merged --data web/public/data/suzanne_full
```

## What the web demo covers

| § | Page                  | What it shows |
|---|-----------------------|---------------|
| 1  | Introduction          | Why HS — comparison to stereo and photometric stereo |
| 2  | Reciprocity           | Animated swap of camera/light, BRDF symmetry |
| 3  | Pair capture          | 3D scene of camera/light positions + image pair viewer |
| 4  | The W matrix          | Turning reciprocity into a rank-2 constraint |
| 5  | Cost vs depth         | **Click any pixel**, see σ₂/σ₁ as a function of candidate depth |
| 6  | Depth and normal      | Recovered maps for one viewpoint |
| 7  | # of pairs effect     | Toggle N = 3, 6, 9, 18 and watch noise drop |
| 8  | Multi-view merging    | Toggle individual capture sessions to see the surface fill in |
| 9  | Limitations           | Depth ambiguity, occlusion, discretization |
| 10 | Try-it-yourself sandbox | Hits a local pipeline server (see `sandbox/`) so anyone with Blender installed can re-run with custom parameters from the web UI |

## Credits and license

Demo by the [Light Transport Lab](https://www.cs.cmu.edu/~motoole2/) at Carnegie Mellon University.
Code is MIT-licensed. The algorithm and circular capture geometry are based on:

* T. Zickler, P.N. Belhumeur, and D.J. Kriegman. *Helmholtz Stereopsis: Exploiting Reciprocity for Surface Reconstruction.* ECCV 2002.
* T. Zickler. *Reciprocal image features for uncalibrated Helmholtz stereopsis.* CVPR 2006.
* R.T. Frankot and R. Chellappa. *A method for enforcing integrability in shape from shading algorithms.* IEEE TPAMI 1988. (used to integrate normals into smooth depth.)
