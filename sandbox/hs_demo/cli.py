"""Command-line entry points for the Helmholtz stereopsis demo."""

from __future__ import annotations

import argparse
from pathlib import Path

from .blender_capture import render_view
from .config import CaptureConfig, DEFAULT_VIEWS, SolverConfig
from .helmholtz import apply_background_mask, solve_capture_dir
from .pointcloud import export_web_pointcloud, merge_views, write_point_cloud


def _solver_from_args(args: argparse.Namespace) -> SolverConfig:
    return SolverConfig(
        xy_min=args.xy_min,
        xy_max=args.xy_max,
        z_min=args.z_min,
        z_max=args.z_max,
        depth_steps=args.depth_steps,
        smoothing_window=args.smoothing_window,
        background_threshold=args.background_threshold,
    )


def cmd_render(args: argparse.Namespace) -> None:
    config = CaptureConfig(
        resolution=args.resolution,
        samples=args.samples,
        num_pairs=args.pairs,
        ring_radius=args.radius,
        light_energy=args.light_energy,
        object_kind=args.object,
        object_distance=args.object_distance,
        material_kind=args.material,
        image_noise_std=args.image_noise,
    )
    view_dir = render_view(args.run, DEFAULT_VIEWS[args.view], config)
    print(f"Rendered {args.view} to {view_dir}")


def cmd_solve(args: argparse.Namespace) -> None:
    solver = _solver_from_args(args)

    def progress(done: int, total: int) -> None:
        print(f"Depth {done}/{total}")

    out = solve_capture_dir(Path(args.run) / args.view, solver=solver, progress=progress)
    if args.mask:
        apply_background_mask(Path(args.run) / args.view, threshold=solver.background_threshold)
    print(f"Solved {args.view} to {out}")


def cmd_mask(args: argparse.Namespace) -> None:
    out = apply_background_mask(Path(args.run) / args.view, threshold=args.threshold)
    print(f"Wrote masked maps to {out}")


def cmd_merge(args: argparse.Namespace) -> None:
    solver = _solver_from_args(args)
    pcd = merge_views(args.run, args.views, solver=solver, cluster_each=not args.no_cluster)
    write_point_cloud(args.out, pcd)
    if args.web_json:
        export_web_pointcloud(
            pcd,
            args.web_json,
            max_points=args.max_web_points,
            run_dir=args.run,
            view_names=args.views,
        )
    print(f"Merged views {', '.join(args.views)} to {args.out}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Helmholtz stereopsis demo pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    render = sub.add_parser("render", help="render one reciprocal capture stack in Blender")
    render.add_argument("--run", default="runs/demo")
    render.add_argument("--view", choices=sorted(DEFAULT_VIEWS), default="front")
    render.add_argument("--resolution", type=int, default=256)
    render.add_argument("--samples", type=int, default=64)
    render.add_argument("--pairs", type=int, default=9)
    render.add_argument("--radius", type=float, default=0.75)
    render.add_argument("--light-energy", type=float, default=200.0)
    render.add_argument("--object", choices=["suzanne", "sphere", "cube"], default="suzanne")
    render.add_argument("--object-distance", type=float, default=3.0)
    render.add_argument("--material", choices=["noise", "matte", "checker"], default="noise")
    render.add_argument("--image-noise", type=float, default=0.0)
    render.set_defaults(func=cmd_render)

    solve = sub.add_parser("solve", help="solve depth and normals for one rendered view")
    solve.add_argument("--run", default="runs/demo")
    solve.add_argument("--view", choices=sorted(DEFAULT_VIEWS), default="front")
    solve.add_argument("--xy-min", type=float, default=-2.0)
    solve.add_argument("--xy-max", type=float, default=2.0)
    solve.add_argument("--z-min", type=float, default=2.0)
    solve.add_argument("--z-max", type=float, default=4.0)
    solve.add_argument("--depth-steps", type=int, default=128)
    solve.add_argument("--smoothing-window", type=int, default=6)
    solve.add_argument("--background-threshold", type=int, default=15)
    solve.add_argument("--mask", action="store_true")
    solve.set_defaults(func=cmd_solve)

    mask = sub.add_parser("mask", help="apply the rendered RGB mask to one solved view")
    mask.add_argument("--run", default="runs/demo")
    mask.add_argument("--view", choices=sorted(DEFAULT_VIEWS), default="front")
    mask.add_argument("--threshold", type=int, default=15)
    mask.set_defaults(func=cmd_mask)

    merge = sub.add_parser("merge", help="merge solved views into one point cloud")
    merge.add_argument("--run", default="runs/demo")
    merge.add_argument("--views", nargs="+", choices=sorted(DEFAULT_VIEWS), default=["front"])
    merge.add_argument("--out", default="runs/demo/reconstruction.ply")
    merge.add_argument("--web-json", default="")
    merge.add_argument("--max-web-points", type=int, default=50000)
    merge.add_argument("--no-cluster", action="store_true")
    merge.add_argument("--xy-min", type=float, default=-2.0)
    merge.add_argument("--xy-max", type=float, default=2.0)
    merge.add_argument("--z-min", type=float, default=2.0)
    merge.add_argument("--z-max", type=float, default=4.0)
    merge.add_argument("--depth-steps", type=int, default=128)
    merge.add_argument("--smoothing-window", type=int, default=6)
    merge.add_argument("--background-threshold", type=int, default=15)
    merge.set_defaults(func=cmd_merge)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
