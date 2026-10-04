"""Deep diagnostic trace of the demodulation chain.

Every stage logs its inputs/outputs and invariants so a failure points
at one specific line instead of "BER is 0.5, good luck".

    python scripts/trace.py --mod QPSK --snr 20
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dsp.gen import generate, _rrc
from dsp.demod import _resample


def pct(a, p):
    return float(np.percentile(a, p))


def stage(n, title):
    print(f"\n{'='*72}\n[{n}] {title}\n{'='*72}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mod", default="QPSK")
    ap.add_argument("--snr", type=float, default=20.0)
    ap.add_argument("--rs", type=float, default=1200.0)
    ap.add_argument("--fs", type=float, default=96000.0)
    ap.add_argument("--n-bits", type=int, default=3000)
    a = ap.parse_args()

    mod, fs, rs, sps = a.mod.upper(), a.fs, a.rs, int(round(a.fs / a.rs))

    # ---------------------------------------------------------------- 1
    stage(1, "GENERATOR")
    r = generate(mod=mod, n_bits=a.n_bits, rs_bps=rs, fs=fs, snr_db=a.snr)
    x = r["signal"].astype(np.complex128)
    ref = r["frame_bits"]
    t = r["truth"]
    print(f"  mod={mod}  fs={fs}  Rs={rs}  sps={sps}")
    print(f"  samples={x.size}  expect symbols={x.size//sps}")
    print(f"  ref bits={ref.size}  bpb={t['bits_per_symbol']}"
          f"  -> expect {ref.size//t['bits_per_symbol']} symbols")
    print(f"  |x| mean={np.mean(np.abs(x)):.4f} "
          f"rms={np.sqrt(np.mean(np.abs(x)**2)):.4f}")

    # ---------------------------------------------------------------- 2
    stage(2, "COSTAS + GARDNER TIMING LOOP (instrumented)")
    y = _resample(x, 2.0 / sps)
    print(f"  resampled to 2 sps: {y.size} samples "
          f"(expect ~{2*x.size//sps})")
    y = y[64:]                       # same guard as demod.gardner_sync
    print(f"  after guard: {y.size}")

    # replicate the loop with full tracing
    def run_loop(mu0, omega0, gain=0.02, damp=0.02, burn=None, trace=True):
        mu, omega = mu0, omega0
        out, mus, errs, idx = [], [], [], []
        i = 0
        burn = burn if burn is not None else min(y.size // 2, 4096)
        while i < burn and i + 2 < y.size:
            e = float(np.clip(np.real(np.conj(y[i+1]) * (y[i+2]-y[i])), -1, 1))
            omega += damp * e
            mu += omega + gain * e
            adv = max(int(round(mu)), 1)
            i += adv
            mu -= adv
        start = i
        while i + 2 < y.size:
            e = float(np.clip(np.real(np.conj(y[i+1]) * (y[i+2]-y[i])), -1, 1))
            k, fr = int(np.floor(i)), i - np.floor(i)
            sym = (1-fr)*y[k] + fr*y[k+1] if 0 <= k < y.size-1 else y[i]
            out.append(sym)
            mus.append(mu); errs.append(e); idx.append(i)
            omega += damp * e
            mu += omega + gain * e
            adv = max(int(round(mu)), 1)
            i += adv
            mu -= adv
        return np.array(out), np.array(mus), np.array(errs), np.array(idx), i - start

    # 2 samples/symbol => the loop must advance 2.0 per output symbol
    for mu0, omega0 in [(2.0, 2.0), (2.0, 1.0), (0.5, 0.5), (2.0, 0.5)]:
        s, mus, errs, _idx, span = run_loop(mu0, omega0)
        mag = np.abs(s)
        print(f"\n  mu0={mu0} omega0={omega0}")
        print(f"    symbols={s.size}  input consumed={span} "
              f"(ratio {span/max(s.size,1):.3f} vs target 2.0)")
        print(f"    |s| p5={pct(mag,5):.3f} p50={pct(mag,50):.3f} "
              f"p95={pct(mag,95):.3f}")
        print(f"    mu   min={mus.min():.3f} max={mus.max():.3f} "
              f"mean={mus.mean():.3f}")
        print(f"    err  rms={np.sqrt(np.mean(errs**2)):.4f}")

    # ---------------------------------------------------------------- 3
    stage(3, "ORACLE: decimate at every phase (no timing loop)")
    print("  If the timing loop is unnecessary when phase is known,")
    print("  some phase must give |s| near 1.0 and a clean constellation.\n")
    best = None
    for ph in range(0, 8):
        v = y[ph:ph + (len(y)//2)*2:2]
        p = np.mean(np.abs(v)**2)
        v = v/np.sqrt(p)
        mag = np.abs(v)
        print(f"    phase {ph}: |s| p50={pct(mag,50):.3f} "
              f"cv={np.std(mag)/np.mean(mag):.4f} "
              f"ph_uniq={len(np.unique(np.round(np.angle(v),1)))}")
        cv = np.std(mag)/np.mean(mag)
        if best is None or cv < best[0]:
            best = (cv, ph, v)
    print(f"\n  best phase={best[1]} cv={best[0]:.4f}")

    # ---------------------------------------------------------------- 4
    stage(4, "SLICE at oracle phase -> BER")
    k, fr = int(best[1]), 0.0
    v = best[2]
    order = {"BPSK":2,"QPSK":4,"8PSK":8,"16QAM":16,"64QAM":64}.get(mod)
    if order:
        nb = int(np.log2(order))
        lvl = np.exp(1j*(2*np.pi/order)*np.arange(order))
        idx = np.argmin(np.abs(v[:,None]-lvl[None,:])**2, axis=1)
        bits = np.zeros((v.size, nb), np.uint8)
        g = np.array([n^(n>>1) for n in range(order)])
        inv = np.zeros(order,int); 
        for gi,gn in enumerate(g): inv[gn]=gi
        nat = inv[idx]
        for b in range(nb):
            bits[:,b] = ((nat>>(nb-1-b))&1)
        b = bits.reshape(-1)
        n = min(b.size, ref.size)
        print(f"  sliced {b.size} bits vs ref {ref.size}")
        print(f"  BER = {np.mean(b[:n]!=ref[:n]):.4f}")

    # ---------------------------------------------------------------- 5
    stage(5, "DISTANCE-TO-DECISION histogram")
    if order:
        d = np.min(np.abs(v[:,None]-lvl[None,:])**2, axis=1)
        print("  squared distance to nearest ideal point:")
        for p in [5,25,50,75,95]:
            print(f"    p{p}: {pct(d,p):.4f}")
        print(f"  (a clean constellation has most symbols very near 0)")


if __name__ == "__main__":
    main()