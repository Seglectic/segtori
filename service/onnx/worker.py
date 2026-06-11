# ╭──────────────────────────────╮
# │  ONNX OCR Worker             │
# │  Keeps RapidOCR warm and     │
# │  serves stdin JSON requests. │
# ╰──────────────────────────────╯

import argparse
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path
from time import perf_counter

import onnxruntime
from rapidocr import RapidOCR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, nargs="?")
    parser.add_argument("--provider", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--serve", action="store_true")
    return parser.parse_args()


def select_cuda(provider: str, available_providers: list[str]) -> bool:
    cuda_available = "CUDAExecutionProvider" in available_providers

    if sys.platform.startswith("linux") and not Path("/dev/nvidiactl").exists():
        cuda_available = False

    if provider == "cuda" and not cuda_available:
        raise RuntimeError("CUDAExecutionProvider was requested but is unavailable")

    return provider != "cpu" and cuda_available


def model_providers(engine: RapidOCR) -> dict[str, list[str]]:
    return {
        name: component.session.session.get_providers()
        for name, component in {
            "detection": engine.text_det,
            "classification": engine.text_cls,
            "recognition": engine.text_rec,
        }.items()
    }


def build_engine(provider: str) -> tuple[RapidOCR, dict[str, object]]:
    onnxruntime.preload_dlls(directory="")
    available_providers = onnxruntime.get_available_providers()
    use_cuda = select_cuda(provider, available_providers)
    started_at = perf_counter()
    # RapidOCR prints provider fallback notices to stdout, which is reserved
    # for the worker's line-oriented JSON protocol.
    with redirect_stdout(sys.stderr):
        engine = RapidOCR(
            params={
                "EngineConfig.onnxruntime.use_cuda": use_cuda,
                "Global.log_level": "error",
            }
        )
    providers_by_model = model_providers(engine)
    cuda_active = all(
        providers and providers[0] == "CUDAExecutionProvider"
        for providers in providers_by_model.values()
    )

    if provider == "cuda" and not cuda_active:
        raise RuntimeError("CUDAExecutionProvider failed to attach to every OCR model")

    return engine, {
        "provider": "cuda" if cuda_active else "cpu",
        "availableProviders": available_providers,
        "modelProviders": providers_by_model,
        "initializationMs": round((perf_counter() - started_at) * 1000),
    }


def recognize(engine: RapidOCR, image: Path, provider_metrics: dict[str, object]) -> dict[str, object]:
    started_at = perf_counter()
    result = engine(image)
    total_ms = round((perf_counter() - started_at) * 1000)
    lines = [
        {"text": text, "score": score}
        for text, score in zip(result.txts or (), result.scores or ())
    ]
    elapsed_list = result.elapse_list or [0, 0, 0]

    return {
        "text": " ".join(line["text"] for line in lines),
        "lines": lines,
        "metrics": {
            **provider_metrics,
            "detectionMs": round(elapsed_list[0] * 1000),
            "classificationMs": round(elapsed_list[1] * 1000),
            "recognitionMs": round(elapsed_list[2] * 1000),
            "inferenceMs": round((result.elapse or 0) * 1000),
            "totalDurationMs": total_ms,
            "lineCount": len(lines),
        },
    }


def write_json(payload: dict[str, object]) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def run_once(args: argparse.Namespace) -> None:
    if not args.image:
        raise RuntimeError("An image path is required")

    engine, provider_metrics = build_engine(args.provider)
    write_json(recognize(engine, args.image, provider_metrics))


def serve(args: argparse.Namespace) -> None:
    engine, provider_metrics = build_engine(args.provider)
    write_json({"type": "ready", "metrics": provider_metrics})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except Exception as error:
            print(f"Invalid worker request: {error}", file=sys.stderr)
            continue

        if request.get("type") == "shutdown":
            break

        request_id = request.get("id")
        image = request.get("image")

        try:
            if not request_id or not image:
                raise RuntimeError("Worker request must include id and image")
            payload = recognize(engine, Path(image), provider_metrics)
            payload["id"] = request_id
            payload["ok"] = True
            write_json(payload)
        except Exception as error:
            write_json(
                {
                    "id": request_id,
                    "ok": False,
                    "error": str(error),
                }
            )


def main() -> None:
    args = parse_args()
    if args.serve:
        serve(args)
    else:
        run_once(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
