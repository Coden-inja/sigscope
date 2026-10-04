"""Build the SIG-SCOPE test corpus.

Not a "big dataset" - a small, exactly-labelled one. Every case emits a
capture plus a .truth.json holding the true Rs, sps, CFO, SNR, FEC and
interleaver. That pairing is what makes the demo verifiable: the
dashboard shows estimated-vs-true and the numbers either match or they
don't.

    python scripts/build_cases.py --out data/cases --quick

Runtime is a few minutes; output is a few MB.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dsp.gen import save_case


def build(outdir: str, quick: bool = False) -> dict:
    os.makedirs(outdir, exist_ok=True)
    manifest = []

    # ---- 1. modulation x SNR sweep: proves blind classification ----
    mods = ["BPSK", "QPSK", "8PSK", "16QAM", "64QAM", "2FSK", "4FSK"]
    snrs = [20.0] if quick else [25.0, 15.0, 10.0, 5.0]

    for mod in mods:
        for snr in snrs:
            name = f"mod_{mod.lower()}_snr{int(snr)}"
            t0 = time.time()
            r = save_case(
                outdir, name,
                mod=mod, n_bits=6000, rs_bps=1200.0, fs=96000.0,
                snr_db=snr, seed=abs(hash(name)) % (2 ** 31),
            )
            t = r["truth_obj"]
            manifest.append({
                "name": name, "group": "modulation",
                "iq": os.path.basename(r["iq"]),
                "wav": os.path.basename(r["wav"]),
                "truth": os.path.basename(r["truth"]),
                "expect": {"modulation": mod, "rs_bps": t["rs_bps"]},
            })
            print(f"  {name:34s} {time.time()-t0:5.1f}s")

    # ---- 2. symbol-rate sweep: proves Rs estimation ----
    for rs in ([1200.0] if quick else [300.0, 600.0, 1200.0, 2400.0, 4800.0]):
        name = f"rate_{int(rs)}bps_qpsk"
        t0 = time.time()
        r = save_case(outdir, name, mod="QPSK", n_bits=6000,
                      rs_bps=rs, fs=96000.0, snr_db=20.0, seed=11)
        manifest.append({
            "name": name, "group": "symbol-rate",
            "iq": os.path.basename(r["iq"]),
            "wav": os.path.basename(r["wav"]),
            "truth": os.path.basename(r["truth"]),
            "expect": {"modulation": "QPSK", "rs_bps": rs},
        })
        print(f"  {name:34s} {time.time()-t0:5.1f}s")

    # ---- 3. CFO sweep: proves carrier recovery ----
    for cfo in ([800.0] if quick else [0.0, 500.0, 1500.0, -2000.0]):
        name = f"cfo_{int(cfo)}hz_qpsk"
        r = save_case(outdir, name, mod="QPSK", n_bits=6000,
                      rs_bps=1200.0, fs=96000.0, snr_db=20.0,
                      cfo_hz=cfo, phase_deg=37.0, seed=13)
        manifest.append({
            "name": name, "group": "carrier-offset",
            "iq": os.path.basename(r["iq"]),
            "wav": os.path.basename(r["wav"]),
            "truth": os.path.basename(r["truth"]),
            "expect": {"modulation": "QPSK", "cfo_hz": cfo},
        })
        print(f"  {name:34s} ok")

    # ---- 4. coded + interleaved: proves FEC / de-interleave / sync ----
    # Only geometry labels the receiver can actually name. The old set
    # ("block", "diagonal", "random") either does not exist or is the
    # identity permutation, so the receiver silently resolved them to
    # "none" while truth claimed otherwise.
    #
    # Note the transpose pairing: block2x8 and block8x2 are inverse
    # permutations of each other, so the receiver reports the
    # transpose of whatever was transmitted. Decoded bits are identical
    # either way; `expect.interleave` records the transmit geometry and
    # validate compares against the transpose as well.
    for il in ([None] if quick else [None, "block4x4", "block8x2"]):
        tag = il or "none"
        name = f"fec_conv_{tag}"
        r = save_case(outdir, name, mod="QPSK", n_bits=4000,
                      rs_bps=1200.0, fs=96000.0, snr_db=18.0,
                      fec="conv", conv_k=7, rate=0.5, interleave=il,
                      seed=17)
        manifest.append({
            "name": name, "group": "fec",
            "iq": os.path.basename(r["iq"]),
            "wav": os.path.basename(r["wav"]),
            "truth": os.path.basename(r["truth"]),
            "expect": {"modulation": "QPSK", "fec": "conv",
                       "interleave": tag},
        })
        print(f"  {name:34s} ok")

    # ---- 5. format variants: proves ingest ----
    r = save_case(outdir, "fmt_stereo_wav_qpsk", mod="QPSK", n_bits=6000,
                  rs_bps=1200.0, fs=96000.0, snr_db=20.0, seed=19)
    manifest.append({
        "name": "fmt_stereo_wav_qpsk", "group": "format",
        "iq": os.path.basename(r["iq"]),
        "wav": os.path.basename(r["wav"]),
        "truth": os.path.basename(r["truth"]),
        "expect": {"modulation": "QPSK"},
    })

    mpath = os.path.join(outdir, "manifest.json")
    with open(mpath, "w") as f:
        json.dump({"cases": manifest,
                   "n_cases": len(manifest),
                   "note": "each case has an exact ground-truth sidecar"},
                  f, indent=2)

    total = sum(os.path.getsize(os.path.join(outdir, c["iq"]))
                for c in manifest)
    return {"manifest": mpath, "n_cases": len(manifest),
            "bytes": total, "outdir": outdir}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/cases")
    ap.add_argument("--quick", action="store_true")
    a = ap.parse_args()
    print(f"building cases -> {a.out}")
    info = build(a.out, quick=a.quick)
    print(f"\n{info['n_cases']} cases, "
          f"{info['bytes']/1e6:.1f} MB total")
    print(f"manifest: {info['manifest']}")