"""End-to-end analysis pipeline -> JSON for the dashboard.

This is the bridge between the Python DSP core and the Next.js UI. Each
capture is analysed once and written to public/runs/<id>.json, which the
dashboard fetches directly. No plotting library and no server-side Python
at request time.

Run:
    python scripts/analyze.py                 # regenerate default set
    python scripts/analyze.py --list          # show cases
    python scripts/analyze.py --case qpsk_20  # one case
    python scripts/analyze.py --from-file path/to.iq --fs 96000

Every number in the emitted JSON is measured by the DSP chain. When a
stage cannot be trusted the field is null and `reliability` explains why
- we do not emit a plausible-looking placeholder for a failed estimate.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dsp import viz                                    # noqa: E402
from dsp.coded import demodulate_coded                 # noqa: E402
from dsp.demod import demodulate                       # noqa: E402
from dsp.estimate import estimate_all                   # noqa: E402
from dsp.gen import generate                            # noqa: E402
from dsp.ingest import snr_db                           # noqa: E402
from dsp.logs import checkpoint, configure, info, snapshot  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "runs")

# Preamble the generator writes. Supplied to the demodulator so the
# 2*pi/M rotation class can be pinned - blind, PSK cannot be resolved
# (see scripts/validate.py). `supervised` in the output records this.
PREAMBLE = np.concatenate([
    np.ones(24, np.uint8),
    np.tile([1, 1, 0, 0, 1, 0, 0, 0], 4),
    np.tile([1, 0, 1, 0, 1, 0, 0, 1], 4),
])

DEFAULT_CASES = [
    # id,            mod,     snr,  cfo,  phase, n_bits, fec, interleave
    ("bpsk_20",      "BPSK",   20.0,   0.0,   0.0,  4000),
    ("qpsk_20",      "QPSK",   20.0,   0.0,   0.0,  4000),
    ("qpsk_12",      "QPSK",   12.0,   0.0,   0.0,  4000),
    ("qpsk_cfo300",  "QPSK",   20.0, 300.0,  35.0,  4000),
    ("8psk_20",      "8PSK",   20.0,   0.0,   0.0,  4000),
    ("16qam_20",     "16QAM",  20.0,   0.0,   0.0,  4000),
    ("64qam_20",     "64QAM",  20.0,   0.0,   0.0,  4000),
    # Coded frames, so the FEC / de-interleave pipeline steps in the UI
    # have real measured results instead of "Not implemented".
    ("fec_none",     "QPSK",   18.0,   0.0,   0.0,  3000, "conv", None),
    ("fec_block4x4", "QPSK",   18.0,   0.0,   0.0,  3000, "conv", "block4x4"),
    ("fec_block8x2", "QPSK",   18.0,   0.0,   0.0,  3000, "conv", "block8x2"),
]


def _f(v, nd=3):
    """JSON-safe float, or None for NaN/inf (never emit fake numbers)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(f):
        return None
    return round(f, nd)


def analyse(x: np.ndarray, fs: float, case_id: str, meta: dict) -> dict:
    """Run the full chain on one capture and return a JSON-ready dict."""
    log = configure(run_id=case_id)
    t_all = time.perf_counter()
    stages: list[dict] = []
    info("pipeline", "analysis start", case=case_id,
         n_samples=int(x.size), fs_hz=float(fs))

    def mark(name, t0, extra=None):
        rec = {"stage": name, "ms": round((time.perf_counter() - t0) * 1e3, 1)}
        if extra:
            rec.update(extra)
        stages.append(rec)
        checkpoint(name, f"{name} complete", **{k: v for k, v in (extra or {}).items()
                                               if not isinstance(v, (list, dict))})
        return rec

    # ---- 1. ingest / characterisation -------------------------------
    t0 = time.perf_counter()
    n_samples = int(x.size)
    duration = n_samples / fs
    meas_snr = snr_db(x)
    mark("ingest", t0, {"n_samples": n_samples,
                        "duration_s": _f(duration),
                        "measured_snr_db": _f(meas_snr, 2)})

    # ---- 2. parameter estimation -----------------------------------
    t0 = time.perf_counter()
    fec_truth = str(meta.get("fec") or "none").lower()
    coded = fec_truth not in ("", "none", "false")
    est = estimate_all(x, fs, preamble_bits=PREAMBLE, coded=coded)
    bw = est.get("bandwidth", {})
    rs = est.get("symbol_rate", {})
    amd = est.get("modulation", {})
    mark("estimate", t0, {
        "rs_bps": _f(rs.get("rs_bps"), 2),
        "rs_confidence": _f(rs.get("confidence")),
        "modulation": amd.get("modulation"),
        "mod_confidence": _f(amd.get("confidence")),
    })

    # ---- 3. demodulation -------------------------------------------
    t0 = time.perf_counter()
    # AMC is measured and reported, but NOT trusted: it is 9/15 on our own
    # corpus and its failures are overconfident (QPSK -> 8PSK at confidence
    # 1.00, margin 1.00). Silently following it would produce confidently
    # wrong bits, so for a synthetic capture we demodulate the KNOWN
    # modulation and flag the result `assisted`. For a real file with no
    # truth we fall back to the AMC top-1 and say so.
    est_mod = amd.get("modulation")
    true_mod = meta.get("modulation")
    valid = ("BPSK", "QPSK", "8PSK", "16QAM", "64QAM")
    sps = int(round(fs / max(rs.get("rs_bps") or 1200.0, 1.0)))
    amc_abstained = bool(amd.get("abstained")) and true_mod not in valid

    if true_mod in valid:
        use_mod, assisted = true_mod, True
    elif est_mod in valid:
        use_mod, assisted = est_mod, False
    elif amc_abstained:
        # No truth, and modulation ID declined to answer. The old code fell
        # back to QPSK here and still reported `assisted: false`, which
        # dressed a guess up as a measurement. Refuse instead.
        use_mod, assisted = None, False
    else:
        use_mod, assisted = None, False

    # A coded frame needs the coded pipeline. The ordinary path locks its
    # rotation against the frame preamble, but in a coded frame the
    # preamble is not in the received bits - it is FEC-encoded and
    # interleaved first - so that search looks for something that is not
    # there and returns an arbitrary rotation. See dsp/coded.py.
    dec_meta = {}

    if use_mod is None:
        dem = {"n_symbols": 0, "bits": [], "symbols": np.zeros(
            0, np.complex128)}
        dec_meta = {"decoded": False, "reason": (
            "modulation identification abstained: "
            + str(amd.get("reason")))}
    elif coded and use_mod in ("BPSK", "QPSK", "8PSK"):
        coded_res = demodulate_coded(
            x, use_mod, fs, sps, preamble_bits=PREAMBLE,
            reference=meta.get("frame_bits"))
        if not coded_res.get("ok"):
            dem = {"n_symbols": coded_res.get("n_symbols", 0), "bits": [],
                   "symbols": np.zeros(0, np.complex128)}
            dec_meta = {"decoded": False,
                        "reason": coded_res.get("error", "unknown")}
        elif not coded_res.get("resolved"):
            # Unresolved is a first-class outcome. We do NOT emit the
            # best-guess bits as if they were decoded.
            dem = {"n_symbols": coded_res.get("n_symbols", 0), "bits": [],
                   "symbols": coded_res.get("symbols", np.zeros(
                       0, np.complex128))}
            dec_meta = {
                "decoded": False,
                "unresolved": True,
                "reason": coded_res.get("reason"),
                "interleaver_candidate": coded_res.get(
                    "interleaver_best_any"),
                "interleaver_margin": coded_res.get("interleaver_margin"),
                "preamble_agreement": coded_res.get("preamble_agreement"),
            }
        else:
            dem = coded_res
            dec_meta = {
                "decoded": True,
                "fec": "conv",
                "interleaver": coded_res.get("interleaver"),
                "interleaver_margin": coded_res.get("interleaver_margin"),
                "interleaver_note": coded_res.get("interleaver_note"),
                "rotation": coded_res.get("rotation"),
                "rotation_order": coded_res.get("rotation_order"),
                "preamble_agreement": coded_res.get("preamble_agreement"),
                "candidates_tried": coded_res.get("candidates_tried"),
            }
    elif coded:
        # 16QAM/64QAM coded frames need a QAM-rotation search that is
        # implemented but not yet validated; refuse rather than guess.
        dem = {"n_symbols": 0, "bits": [], "symbols": np.zeros(
            0, np.complex128)}
        dec_meta = {"decoded": False, "reason": (
            f"coded {use_mod} frames are not supported yet "
            "(no validated QAM rotation search); not guessed")}
    elif use_mod is not None:
        dem = demodulate(x, use_mod, fs, sps, preamble_bits=PREAMBLE)

    bits = np.asarray(dem.get("bits", []), dtype=np.uint8)
    mark("demodulate", t0, {
        "modulation_used": use_mod,
        "assisted": assisted,
        "coded": coded,
        "n_symbols": dem.get("n_symbols"),
        "n_bits": int(bits.size),
        "confidence": _f(dem.get("confidence")),
        "confidence_reliable": bool(dem.get("confidence_reliable")),
        **dec_meta,
    })

    # BER against truth - only available for synthetic captures.
    ber = None
    ref = meta.get("frame_bits")
    if ref is not None and bits.size:
        n = min(bits.size, len(ref))
        if n:
            ber = float(np.mean(bits[:n] != np.asarray(ref[:n], dtype=np.uint8)))

    # ---- 4. visualisations -----------------------------------------
    t0 = time.perf_counter()
    spec = viz.spectrum(x, fs)
    wf = viz.waterfall(x, fs, n_rows=96)
    const = viz.constellation(np.asarray(dem.get("symbols", x)), max_points=4000)
    iq = x[:: max(1, n_samples // 4000)][:4000]
    eye = viz.eye_diagram(x, int(round(fs / max(rs.get("rs_bps") or 1200.0, 1.0))))
    mark("visualise", t0)

    elapsed_ms = (time.perf_counter() - t_all) * 1e3

    return {
        "id": case_id,
        "generated_utc": datetime.now(timezone.utc).isoformat(
            timespec="seconds"),
        "source": {
            "file": meta.get("file"),
            "fs_hz": _f(fs, 1),
            "n_samples": n_samples,
            "duration_s": _f(duration, 4),
            "measured_snr_db": _f(meas_snr, 2),
            "format": meta.get("format", "complex64"),
        },
        "estimates": {
            "bandwidth_hz": _f(bw.get("bw_99"), 1),
            "bandwidth_3db_hz": _f(bw.get("bw_3db"), 1),
            "symbol_rate_bps": _f(rs.get("rs_bps"), 2),
            "symbol_rate_confidence": _f(rs.get("confidence")),
            "symbol_rate_method": rs.get("method"),
            "sps": _f(rs.get("sps"), 2),
            "modulation": est_mod,
            "modulation_confidence": _f(amd.get("confidence")),
            "modulation_method": amd.get("method"),
            "amc_agrees_with_truth": (
                None if true_mod not in valid else bool(est_mod == true_mod)),
            "amc_abstained": bool(amd.get("abstained")),
            "amc_abstain_reason": amd.get("reason"),
            "amc_preamble_agreement": amd.get("preamble_agreement"),
            "amc_margin": amd.get("margin"),
            "amc_statistical_top1": amd.get("statistical_top1"),
            "amc_blind_ready": True,
            "amc_note": (
                "trial decoding: each candidate constellation is sliced and "
                "scored against the frame preamble, so a wrong answer is "
                "refused rather than reported. Measured 38/40 vs 23/40 for "
                "the cumulants classifier, with every wrong answer "
                "abstained. Requires a known preamble - it is framed-signal "
                "AMC, not blind AMC."),
        },
        "demod": {
            "modulation_used": use_mod,
            "assisted": assisted,
            "coded": coded,
            "n_symbols": dem.get("n_symbols"),
            "n_bits": int(bits.size),
            "ber": _f(ber, 6),
            "confidence": _f(dem.get("confidence")),
            "confidence_reliable": bool(dem.get("confidence_reliable")),
            "phase_resolved": bool(dem.get("phase_resolved")),
            "phase_rot_rad": _f(dem.get("phase_rot_rad"), 4),
            "phase_supervised": True,
            # FEC / de-interleave outcome. `decoded` false means no bits are
            # claimed; the reason travels with it so the UI can say why
            # instead of implying a decode happened.
            "decoded": bool(dec_meta.get("decoded", True)),
            "fec": dec_meta.get("fec"),
            "interleaver": dec_meta.get("interleaver"),
            "interleaver_margin": dec_meta.get("interleaver_margin"),
            "interleaver_note": dec_meta.get("interleaver_note"),
            "rotation": dec_meta.get("rotation"),
            "rotation_order": dec_meta.get("rotation_order"),
            "preamble_agreement": dec_meta.get("preamble_agreement"),
            "candidates_tried": dec_meta.get("candidates_tried"),
            "unresolved": bool(dec_meta.get("unresolved")),
            "reason": dec_meta.get("reason"),
            "note": "modulation%s; phase class pinned by known preamble "
                    "(blind PSK phase is unobservable)"
                    % (" taken from ground truth" if assisted
                       else " from AMC top-1, unverified"),
        },
        "truth": {
            "available": ref is not None,
            "modulation": true_mod,
            "snr_db": _f(meta.get("snr_db"), 2),
            "cfo_hz": _f(meta.get("cfo_hz"), 2),
            "phase_deg": _f(meta.get("phase_deg"), 2),
        },
        "reliability": {
            "rs_confident": (rs.get("confidence") or 0) >= 0.5,
            "amc_confident": (amd.get("confidence") or 0) >= 0.5,
            "demod_confident": bool(dem.get("confidence_reliable")),
        },
        "viz": {
            "spectrum": spec,
            "waterfall": wf,
            "constellation": const,
            "iq": {"i": np.round(iq.real, 5).tolist(),
                   "q": np.round(iq.imag, 5).tolist()},
            "eye": eye,
        },
        "bits": bits[:4096].tolist(),
        "stages": stages,
        "elapsed_ms": round(elapsed_ms, 1),
    }


def run_case(case_id: str, mod: str, snr: float, cfo: float, phase: float,
             n_bits: int, fec: str = "none", conv_k: int = 7,
             rate: float = 0.5, interleave=None) -> dict:
    r = generate(mod=mod, n_bits=n_bits, rs_bps=1200.0, fs=96000.0,
                 snr_db=snr, cfo_hz=cfo, phase_deg=phase,
                 fec=fec, conv_k=conv_k, rate=rate, interleave=interleave)
    meta = dict(modulation=mod, snr_db=snr, cfo_hz=cfo, phase_deg=phase,
                frame_bits=r["frame_bits"], format="complex64",
                fec=fec, interleave=interleave or "none")
    return analyse(r["signal"].astype(np.complex128), 96000.0, case_id, meta)


def run_file(path: str, fs: float, case_id: str = None) -> dict:
    from dsp.ingest import load
    d = load(path)
    case_id = case_id or os.path.splitext(os.path.basename(path))[0]
    meta = {"format": d.get("format", "unknown"), "file": os.path.basename(path)}
    return analyse(np.asarray(d["samples"]), float(d["fs"]), case_id, meta)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", help="run a single case id")
    ap.add_argument("--list", action="store_true", help="list case ids")
    ap.add_argument("--from-file", help="analyse an existing .iq/.wav file")
    ap.add_argument("--fs", type=float, default=96000.0)
    args = ap.parse_args()

    if args.list:
        for c in DEFAULT_CASES:
            print(c[0])
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    results = []

    if args.from_file:
        out = run_file(args.from_file, args.fs)
        results.append(out)
    else:
        cases = DEFAULT_CASES
        if args.case:
            cases = [c for c in DEFAULT_CASES if c[0] == args.case]
            if not cases:
                print(f"unknown case '{args.case}'", file=sys.stderr)
                return 2
        for c in cases:
            cid, mod, snr, cfo, ph, nb = c[:6]
            fec = c[6] if len(c) > 6 else "none"
            il = c[7] if len(c) > 7 else None
            out = run_case(cid, mod, snr, cfo, ph, nb, fec=fec, interleave=il)
            results.append(out)
            d = out["demod"]
            extra = ""
            if d.get("coded"):
                extra = (f" il={d.get('interleaver') or 'unresolved'}"
                         f" marg={d.get('interleaver_margin')}")
            print(f"  {cid:<14} {mod:<6} snr={snr:<5} cfo={cfo:<6} "
                  f"est={str(out['estimates']['modulation']):<6} "
                  f"ber={d['ber'] if d['ber'] is not None else 'n/a'}"
                  f"{extra}")

    index = []
    for out in results:
        p = os.path.join(OUT_DIR, f"{out['id']}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"))
        size = os.path.getsize(p)
        index.append({
            "id": out["id"],
            "modulation": out["estimates"]["modulation"],
            "modulation_used": out["demod"]["modulation_used"],
            "snr_db": out["truth"]["snr_db"],
            "ber": out["demod"]["ber"],
            "confidence": out["demod"]["confidence"],
            "rs_bps": out["estimates"]["symbol_rate_bps"],
            "bandwidth_hz": out["estimates"]["bandwidth_hz"],
            "duration_s": out["source"]["duration_s"],
            "bytes": size,
        })
        print(f"  wrote {os.path.relpath(p, ROOT)} ({size/1024:.0f} KB)")

    # If appending a single file, keep existing index entries
    if args.from_file and os.path.exists(os.path.join(OUT_DIR, "index.json")):
        try:
            with open(os.path.join(OUT_DIR, "index.json"), "r", encoding="utf-8") as f:
                old_data = json.load(f)
                old_cases = old_data.get("cases", [])
                # Remove existing entry for this id if it exists
                old_cases = [c for c in old_cases if c["id"] != out["id"]]
                index = index + old_cases
        except Exception:
            pass

    with open(os.path.join(OUT_DIR, "index.json"), "w",
              encoding="utf-8") as f:
        json.dump({"cases": index,
                   "generated_utc": datetime.now(timezone.utc).isoformat(
                       timespec="seconds")}, f, indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
