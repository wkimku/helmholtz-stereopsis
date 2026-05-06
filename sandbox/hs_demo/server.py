"""Local web server for running the Helmholtz demo pipeline from the browser."""

from __future__ import annotations

import argparse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import subprocess
import sys
import threading
import time
from typing import Any
import uuid


REPO_ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = REPO_ROOT / "web"
DEFAULT_BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
JOBS: dict[str, dict[str, Any]] = {}
JOB_LOCK = threading.Lock()


class DemoHandler(SimpleHTTPRequestHandler):
    server_version = "HelmholtzDemo/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def end_headers(self) -> None:
        # Permit cross-origin calls from the static demo (served from a
        # different origin like https://wkim.github.io). The server only
        # binds to localhost so wide-open CORS is acceptable here.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._send_json({"ok": True})
            return
        if self.path.startswith("/api/run/"):
            job_id = self.path.rsplit("/", 1)[-1]
            job = get_job(job_id)
            if job is None:
                self._send_json({"ok": False, "error": "unknown job"}, status=HTTPStatus.NOT_FOUND)
            else:
                self._send_json(job)
            return
        if self.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/run":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            payload = self._read_json()
            job = start_pipeline_job(payload)
            self._send_json(job, status=HTTPStatus.ACCEPTED)
        except Exception as exc:  # pragma: no cover - defensive server boundary
            self._send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(length)
        return json.loads(data.decode("utf-8"))

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class PipelineCommandError(RuntimeError):
    def __init__(self, command: list[str], output: str) -> None:
        super().__init__("pipeline command failed")
        self.command = command
        self.output = output


def start_pipeline_job(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = uuid.uuid4().hex[:12]
    job = {
        "ok": True,
        "jobId": job_id,
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "message": "queued",
        "result": None,
        "error": None,
    }
    with JOB_LOCK:
        JOBS[job_id] = job
    thread = threading.Thread(target=run_pipeline_job, args=(job_id, payload), daemon=True)
    thread.start()
    return job


def get_job(job_id: str) -> dict[str, Any] | None:
    with JOB_LOCK:
        job = JOBS.get(job_id)
        return dict(job) if job is not None else None


def update_job(job_id: str, **values: Any) -> None:
    with JOB_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(values)


def run_pipeline_job(job_id: str, payload: dict[str, Any]) -> None:
    try:
        result = run_pipeline(payload, job_id=job_id)
        update_job(
            job_id,
            status="done",
            stage="done",
            progress=100,
            message="done",
            result=result,
            error=None,
        )
    except PipelineCommandError as exc:
        update_job(
            job_id,
            ok=False,
            status="error",
            stage="error",
            message="command failed",
            error={"command": exc.command, "output": exc.output[-6000:]},
        )
    except Exception as exc:  # pragma: no cover - defensive thread boundary
        update_job(job_id, ok=False, status="error", stage="error", message=str(exc), error=str(exc))


def run_pipeline(payload: dict[str, Any], job_id: str | None = None) -> dict[str, Any]:
    settings = normalize_settings(payload)
    run_dir = REPO_ROOT / "runs" / settings["run_name"]
    web_json = WEB_ROOT / "data" / "latest_run.json"

    blender_cmd = [
        settings["blender"],
        "--background",
        "--factory-startup",
        "--python",
        str(REPO_ROOT / "scripts" / "blender_cli.py"),
        "--",
        "render",
        "--run",
        str(run_dir),
        "--view",
        "front",
        "--resolution",
        str(settings["resolution"]),
        "--samples",
        str(settings["samples"]),
        "--pairs",
        str(settings["pairs"]),
        "--radius",
        str(settings["radius"]),
        "--object",
        settings["object"],
        "--object-distance",
        str(settings["object_distance"]),
        "--material",
        settings["material"],
        "--image-noise",
        str(settings["image_noise"]),
    ]
    solve_cmd = [
        sys.executable,
        "-m",
        "hs_demo.cli",
        "solve",
        "--run",
        str(run_dir),
        "--view",
        "front",
        "--depth-steps",
        str(settings["depth_steps"]),
        "--mask",
    ]
    merge_cmd = [
        sys.executable,
        "-m",
        "hs_demo.cli",
        "merge",
        "--run",
        str(run_dir),
        "--views",
        "front",
        "--out",
        str(run_dir / "front.ply"),
        "--web-json",
        str(web_json),
    ]

    logs = [
        run_logged_command(
            blender_cmd,
            job_id=job_id,
            stage="render",
            progress_start=0,
            progress_end=35,
            render_total=settings["pairs"] * 2 + 1,
        ),
        run_logged_command(
            solve_cmd,
            job_id=job_id,
            stage="solve",
            progress_start=35,
            progress_end=85,
            depth_total=settings["depth_steps"],
        ),
        run_logged_command(
            merge_cmd,
            job_id=job_id,
            stage="merge",
            progress_start=85,
            progress_end=100,
        ),
    ]

    web_payload = json.loads(web_json.read_text(encoding="utf-8"))
    return {
        "ok": True,
        "runDir": str(run_dir),
        "webJson": str(web_json),
        "settings": settings,
        "result": web_payload,
        "logs": logs,
    }


def run_logged_command(
    cmd: list[str],
    job_id: str | None,
    stage: str,
    progress_start: int,
    progress_end: int,
    render_total: int | None = None,
    depth_total: int | None = None,
) -> dict[str, Any]:
    if job_id is not None:
        update_job(job_id, status="running", stage=stage, progress=progress_start, message=stage)

    process = subprocess.Popen(
        cmd,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    output_lines: list[str] = []
    render_done = 0
    depth_re = re.compile(r"Depth\s+(\d+)\s*/\s*(\d+)")
    assert process.stdout is not None
    for line in process.stdout:
        output_lines.append(line)
        if job_id is None:
            continue
        if stage == "render" and "Saved:" in line and render_total:
            render_done += 1
            fraction = min(render_done / render_total, 1.0)
            update_job(
                job_id,
                progress=round(progress_start + fraction * (progress_end - progress_start)),
                message=f"rendering {render_done}/{render_total} images",
            )
        elif stage == "solve":
            match = depth_re.search(line)
            if match:
                done = int(match.group(1))
                total = int(match.group(2)) if match.group(2) else depth_total or done
                fraction = min(done / max(total, 1), 1.0)
                update_job(
                    job_id,
                    progress=round(progress_start + fraction * (progress_end - progress_start)),
                    message=f"solving depth {done}/{total}",
                )
        elif stage == "merge" and "Merged views" in line:
            update_job(job_id, progress=98, message="exporting web bundle")

    return_code = process.wait(timeout=10)
    output = "".join(output_lines)
    if return_code != 0:
        raise PipelineCommandError(cmd, output)
    if job_id is not None:
        update_job(job_id, progress=progress_end, message=f"{stage} complete")
    return {"command": cmd, "output": output[-12000:]}


def normalize_settings(payload: dict[str, Any]) -> dict[str, Any]:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    return {
        "run_name": safe_run_name(str(payload.get("runName") or f"web_{timestamp}")),
        "blender": str(payload.get("blender") or DEFAULT_BLENDER),
        "resolution": clamp_int(payload.get("resolution"), 64, 512, 192),
        "samples": clamp_int(payload.get("samples"), 1, 256, 32),
        "pairs": clamp_int(payload.get("pairs"), 3, 18, 6),
        "depth_steps": clamp_int(payload.get("depthSteps"), 16, 256, 96),
        "radius": clamp_float(payload.get("radius"), 0.1, 2.0, 0.75),
        "object_distance": clamp_float(payload.get("objectDistance"), 1.5, 6.0, 3.0),
        "image_noise": clamp_float(payload.get("imageNoise"), 0.0, 30.0, 0.0),
        "object": choice(payload.get("object"), {"suzanne", "sphere", "cube"}, "suzanne"),
        "material": choice(payload.get("material"), {"noise", "matte", "checker"}, "noise"),
    }


def safe_run_name(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in value).strip("_")
    return cleaned[:80] or time.strftime("web_%Y%m%d_%H%M%S")


def clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


def clamp_float(value: Any, low: float, high: float, default: float) -> float:
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return default


def choice(value: Any, allowed: set[str], default: str) -> str:
    value = str(value)
    return value if value in allowed else default


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the local Helmholtz demo UI")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), DemoHandler)
    print(f"Serving Helmholtz demo at http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
