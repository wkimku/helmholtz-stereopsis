# Web frontend

The React + Vite + Three.js front-end for the demo. See [`../README.md`](../README.md) for the project overview, data pipeline, and §10 sandbox setup.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produces dist/
```

## Layout

| Path                | Contents                                                      |
|---------------------|---------------------------------------------------------------|
| `src/sections/`     | One file per section of the page; ordered by file prefix.     |
| `src/components/`   | Reusable interactives (point-cloud viewers, sliders, plots).  |
| `src/data/`         | Loaders for the precomputed scenes and the local sandbox API. |
| `src/hooks/`        | React hooks for scene state.                                  |
| `public/data/`      | Precomputed datasets shipped with the static build.           |
| `public/meshes/`    | GLB assets (e.g. Suzanne for the §3 viewer).                  |

## Deploy

`.github/workflows/deploy.yml` (at the repo root) builds with the correct `VITE_BASE_PATH` and publishes `dist/` to GitHub Pages on each push to `main`.
