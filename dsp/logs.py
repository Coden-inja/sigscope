"""Structured, stage-filtered logging for the SIG-SCOPE pipeline.

Two orthogonal filters, because debugging needs both axes:

  level   : TRACE / DEBUG / INFO / WARN / ERROR
  stage   : ingest / estimate / demod / fec / interleave / bitsync / gen

Semantics
---------
  * NO FLAGS AT ALL -> every stage logs at INFO. This is the default, so
    you never get an empty or cluttered-by-accident log; you always get
    the whole pipeline's normal narration.
  * LOG_STAGES=demod              -> ONLY the demod step logs, INFO+,
                                    every other step is silent.
  * LOG_STAGES=demod:trace        -> only demod, at maximum verbosity.
  * LOG_STAGES=demod:trace,estimate:debug
                                  -> per-step verbosity; demod loud,
                                    estimate medium, rest silent.
  * LOG_LEVEL=warn                -> raise the floor for all steps
                                    (suppress INFO/DEBUG everywhere).

So you can always isolate exactly one step, or one step at one verbosity,
without wading through the other ten stages.

    LOG_STAGES=demod LOG_LEVEL=TRACE python run.py
    LOG_LEVEL=INFO python run.py            # everything, summary only
    LOG_JSONL=runs/latest.jsonl python run.py

Stage timings are accumulated and returned by `snapshot()`, which feeds
both the dashboard's per-stage latency panel and the JSONL telemetry
stream. Every record carries a run_id so a file analysis can be
reconstructed end to end from the log alone.
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from contextlib import contextmanager

# ---------------------------------------------------------------- levels

TRACE, DEBUG, INFO, WARN, ERROR = 10, 20, 30, 40, 50
_NAMES = {TRACE: "TRACE", DEBUG: "DEBUG", INFO: "INFO",
          WARN: "WARN", ERROR: "ERROR"}
_BY_NAME = {"TRACE": TRACE, "DEBUG": DEBUG, "INFO": INFO,
            "WARN": WARN, "ERROR": ERROR, "WARNING": WARN}

STAGES = ("ingest", "estimate", "demod", "fec", "interleave",
          "bitsync", "gen", "viz", "pipeline")

# ---------------------------------------------------------------- config

def _parse_stages(spec) -> dict:
    # "demod:trace,estimate" -> {demod: TRACE, estimate: DEBUG}
    out = {}
    for part in (spec.split(",") if isinstance(spec, str) else spec):
        part = str(part).strip().lower()
        if not part:
            continue
        if ":" in part:
            name, _, lvl = part.partition(":")
            out[name.strip()] = _BY_NAME.get(lvl.strip().upper(), INFO)
        else:
            out[part] = None          # stage enabled at global level
    return out


# default INFO: with no flags you see every stage's normal narration
_min_level = _BY_NAME.get(os.environ.get("LOG_LEVEL", "INFO").upper(), INFO)
_stage_levels = _parse_stages(os.environ.get("LOG_STAGES", ""))
_jsonl_path = os.environ.get("LOG_JSONL") or None
_run_id = os.environ.get("LOG_RUN_ID") or uuid.uuid4().hex[:12]
_quiet = os.environ.get("LOG_QUIET", "") not in ("", "0", "false")

_timings: dict = {}
_counts: dict = {}


def configure(level=None, stages=None, jsonl=None, run_id=None) -> None:
    global _min_level, _stage_levels, _jsonl_path, _run_id
    if level is not None:
        _min_level = _BY_NAME.get(str(level).upper(), _min_level)
    if stages is not None:
        _stage_levels = _parse_stages(stages)
    if jsonl is not None:
        _jsonl_path = jsonl
    if run_id is not None:
        _run_id = run_id


def _enabled(stage: str, level: int) -> bool:
    # stage not mentioned -> silent, unless nothing is mentioned at all
    if _stage_levels and stage not in _stage_levels:
        return False
    floor = _stage_levels.get(stage) or _min_level
    if _stage_levels.get(stage) is None:
        floor = _min_level
    return level >= floor


def _emit(stage: str, level: int, msg: str, **fields) -> None:
    if not _enabled(stage, level):
        return

    key = f"{stage}:{_NAMES[level]}"
    _counts[key] = _counts.get(key, 0) + 1

    rec = {
        "ts": round(time.time(), 6),
        "run_id": _run_id,
        "stage": stage,
        "level": _NAMES[level],
        "msg": msg,
    }
    if fields:
        rec["data"] = fields

    if _jsonl_path:
        try:
            os.makedirs(os.path.dirname(_jsonl_path) or ".", exist_ok=True)
            with open(_jsonl_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, default=str) + "\n")
        except Exception:
            pass

    if _quiet:
        return

    tag = f"{stage:<10} {_NAMES[level]:<5}"
    extra = ""
    if fields:
        extra = "  " + " ".join(
            f"{k}={_fmt(v)}" for k, v in fields.items()
            if not k.startswith("_"))
    print(f"[{tag}] {msg}{extra}", file=sys.stderr)


def _fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:.6g}"
    if isinstance(v, (list, tuple)):
        if len(v) > 6:
            return f"[{len(v)} items]"
        return str(list(v))
    if isinstance(v, dict):
        return "{" + ",".join(list(v)[:4]) + "}"
    return str(v)


# ------------------------------------------------------------- shortcuts

def trace(stage, msg, **f): _emit(stage, TRACE, msg, **f)
def debug(stage, msg, **f): _emit(stage, DEBUG, msg, **f)
def info(stage, msg, **f):  _emit(stage, INFO, msg, **f)
def warn(stage, msg, **f):  _emit(stage, WARN, msg, **f)
def error(stage, msg, **f): _emit(stage, ERROR, msg, **f)


# ---------------------------------------------------------- stage timing

@contextmanager
def timed(stage: str, **fields):
    """Time a pipeline stage and log its duration + outcome."""
    t0 = time.perf_counter()
    _emit(stage, DEBUG, f"{stage} start", **fields)
    try:
        yield
    except Exception as e:
        dt = (time.perf_counter() - t0) * 1e3
        _timings[stage] = {"ms": round(dt, 2), "ok": False,
                           "error": str(e)[:200]}
        _emit(stage, ERROR, f"{stage} FAILED", duration_ms=round(dt, 2),
              error=str(e)[:200])
        raise
    else:
        dt = (time.perf_counter() - t0) * 1e3
        prev = _timings.get(stage, {})
        prev.update({"ms": round(dt, 2), "ok": True})
        _timings[stage] = prev
        _emit(stage, INFO, f"{stage} done", duration_ms=round(dt, 2))


def checkpoint(stage: str, msg: str, **fields) -> None:
    """Mark a pipeline checkpoint with its quality metrics."""
    _emit(stage, INFO, msg, **fields)


# ------------------------------------------------------------ telemetry

def snapshot() -> dict:
    """Per-stage timings + log counts. Feed the dashboard."""
    return {
        "run_id": _run_id,
        "stages": _timings,
        "log_counts": dict(sorted(_counts.items())),
        "total_ms": round(sum(v.get("ms", 0)
                              for v in _timings.values()), 2),
    }


def reset() -> None:
    _timings.clear()
    _counts.clear()


def describe() -> str:
    """Human-readable active filter config (show in the dashboard)."""
    if not _stage_levels:
        scope = "ALL stages"
    else:
        parts = [f"{s}@{_NAMES[v]}" if v else s
                 for s, v in sorted(_stage_levels.items())]
        scope = ", ".join(parts) + " (others silent)"
    return (f"level>={_NAMES[_min_level]} | {scope} | "
            f"run_id={_run_id} | jsonl={_jsonl_path or 'off'}")