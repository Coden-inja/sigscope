"""Single-stage debug probe: is the transmitted symbol stream actually
recoverable, independent of any demodulation cleverness?

Answers the question "should this file decode at all?" by taking known
symbols, shaping them, and reading them straight back at the ideal
instant. If BER != 0 here, the bug is in the GENERATOR/mapper, not the
receiver - which is exactly where the last false lead came from.

    python scripts/probe.py --stage slicer --mod QPSK
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dsp import logs
from dsp.gen import generate, _bits_to_symbols, upsample
from dsp.estimate import _symbol_decimate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mod", default="QPSK")
    ap.add_argument("--snr", type=float, default=20.0)
    ap.add_argument("--rs", type=float, default=1200.0)
    ap.add_argument("--fs", type=float, default=96000.0)
    ap.add_argument("--n-bits", type=int, default=3000)
    a = ap.parse_args()

    logs.configure(level="DEBUG", stages={"gen"})
    logs.info("gen", f"probe start {logs.describe()}")

    mod, fs, rs = a.mod.upper(), a.fs, a.rs
    sps = int(round(fs / rs))

    # ---- A. mapper round-trip: bits -> symbols -> bits -----------------
    with logs.timed("gen"):
        rng = np.random.default_rng(5)
        bits = rng.integers(0, 2, 4000).astype(np.uint8)
        syms = _bits_to_symbols(bits, mod)
        bpb = {"BPSK": 1, "QPSK": 2, "8PSK": 3, "16QAM": 4, "64QAM": 6}[mod]
        logs.info("gen", "mapper output",
                  n_sym=int(syms.size), bpb=bpb,
                  uniq_phase=int(len(np.unique(np.round(np.angle(syms), 3)))),
                  uniq_amp=int(len(np.unique(np.round(np.abs(syms), 3)))),
                  expect_sym=int(bits.size / bpb))

        # de-map using the same gray table the generator used
        order = {"BPSK": 2, "QPSK": 4, "8PSK": 8}.get(mod)
        if order:
            nb = int(np.log2(order))
            g = np.array([n ^ (n >> 1) for n in range(order)])
            inv = np.zeros(order, int)
            for gi, gn in enumerate(g):
                inv[gn] = gi
            # nearest natural index, then gray->natural, then to bits
            lvl = np.exp(1j * 2 * np.pi * np.arange(order) / order)
            idx = np.argmin(np.abs(syms[:, None] - lvl[None, :]) ** 2, axis=1)
            nat = inv[idx]
            back = np.zeros((syms.size, nb), np.uint8)
            for b in range(nb):
                back[:, b] = (nat >> (nb - 1 - b)) & 1
            back = back.reshape(-1)
            n = min(back.size, bits.size)
            logs.info("gen", "mapper round-trip BER",
                      value=round(float(np.mean(back[:n] != bits[:n])), 6))

    # ---- B. waveform -> ideal sampling ---------------------------------
    with logs.timed("gen"):
        r = generate(mod=mod, n_bits=a.n_bits, rs_bps=rs, fs=fs,
                     snr_db=a.snr)
        x = r["signal"].astype(np.complex128)
        ref = r["frame_bits"]
        truth = r["truth"]
        logs.info("gen", "generated", samples=int(x.size), sps=sps,
                  ref_bits=int(ref.size), snr_set=a.snr,
                  cfo_hz=truth.get("cfo_hz"),
                  phase_deg=truth.get("phase_deg"))

        # ideal: the transmitter places symbol k at index k*sps
        ideal = x[0: ref.size // bpb * sps: sps]
        mag = np.abs(ideal)
        cv = float(np.std(mag) / np.mean(mag))
        logs.info("gen", "ideal-sample envelope", cv=round(cv, 5),
                  p50=round(float(np.median(mag)), 4),
                  expected_cv_lt=0.05)

        if order:
            lvl = np.exp(1j * 2 * np.pi * np.arange(order) / order)
            idx = np.argmin(np.abs(ideal[:, None] - lvl[None, :]) ** 2, axis=1)
            g = np.array([n ^ (n >> 1) for n in range(order)])
            inv = np.zeros(order, int)
            for gi, gn in enumerate(g):
                inv[gn] = gi
            nat = inv[idx]
            back = np.zeros((ideal.size, nb), np.uint8)
            for b in range(nb):
                back[:, b] = (nat >> (nb - 1 - b)) & 1
            back = back.reshape(-1)
            n = min(back.size, ref.size)
            ber = float(np.mean(back[:n] != ref[:n]))
            logs.info("gen", "IDEAL-SAMPLE BER (no timing/carrier loop)",
                      value=round(ber, 6), n_cmp=int(n))

            # is it a phase rotation? try every rotation offset
            if ber > 0.01:
                logs.warn("gen", "ideal-sample BER high - testing rotations")
                for rot in range(1, order):
                    lr = ideal * np.exp(-1j * 2 * np.pi * rot / order)
                    idx2 = np.argmin(
                        np.abs(lr[:, None] - lvl[None, :]) ** 2, axis=1)
                    nat2 = inv[idx2]
                    b2 = np.zeros((ideal.size, nb), np.uint8)
                    for b in range(nb):
                        b2[:, b] = (nat2 >> (nb - 1 - b)) & 1
                    b2 = b2.reshape(-1)
                    n2 = min(b2.size, ref.size)
                    logs.info("gen", "rotation candidate",
                              rot=rot,
                              ber=round(float(np.mean(b2[:n2] != ref[:n2])), 6))

                # is it a symbol-timing offset?
                logs.warn("gen", "testing symbol offsets")
                for off in range(-4, 5):
                    v = x[off * sps: off * sps + (ref.size // bpb) * sps: sps]
                    idx3 = np.argmin(
                        np.abs(v[:, None] - lvl[None, :]) ** 2, axis=1)
                    nat3 = inv[idx3]
                    b3 = np.zeros((v.size, nb), np.uint8)
                    for b in range(nb):
                        b3[:, b] = (nat3 >> (nb - 1 - b)) & 1
                    b3 = b3.reshape(-1)
                    n3 = min(b3.size, ref.size)
                    logs.info("gen", "offset candidate", off=off,
                              ber=round(float(np.mean(b3[:n3] != ref[:n3])), 6))

    # ---- C. matched-filter path ---------------------------------------
    with logs.timed("gen"):
        xs = _symbol_decimate(x, sps, 0.35)
        mag = np.abs(xs)
        logs.info("gen", "matched-filter envelope",
                  cv=round(float(np.std(mag) / np.mean(mag)), 5),
                  n=int(xs.size))

    logs.info("gen", "snapshot", **logs.snapshot()["stages"])


if __name__ == "__main__":
    main()