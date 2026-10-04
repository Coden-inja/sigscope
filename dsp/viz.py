"""Visualisation data: spectrum, waterfall (STFT), constellation.

Each function returns plain JSON-serialisable dicts so the dashboard can
render them directly with no server-side plotting library.
"""
from __future__ import annotations

import numpy as np


def spectrum(x: np.ndarray, fs: float, nfft: int = 4096) -> dict:
    """Averaged periodogram in dB, centred on DC."""
    nfft = int(min(nfft, 2 ** int(np.ceil(np.log2(max(x.size, 8))))))
    nfft = max(nfft, 256)
    # Welch-style averaging reduces variance and makes bursts visible.
    step = nfft // 2
    win = np.hanning(nfft)
    acc = np.zeros(nfft)              # np.fft.fft returns nfft bins
    nacc = 0
    for start in range(0, max(x.size - nfft, 0) + 1, step):
        seg = x[start:start + nfft]
        if seg.size < nfft:
            seg = np.pad(seg, (0, nfft - seg.size))
        acc += np.abs(np.fft.fftshift(np.fft.fft(seg * win))) ** 2
        nacc += 1
    if nacc == 0:
        acc = np.abs(np.fft.fftshift(np.fft.fft(x[:nfft] * win))) ** 2
        nacc = 1
    P = acc / nacc
    Pdb = 10 * np.log10(P / max(P.max(), 1e-30) + 1e-30)

    freqs = np.fft.fftshift(np.fft.fftfreq(nfft, 1 / fs))
    # Decimate for transport if huge
    m = max(1, Pdb.size // 2048)
    return {
        "freq": (freqs[::m] / 1000.0).round(3).tolist(),   # kHz
        "power_db": Pdb[::m].round(2).tolist(),
        "fs": fs,
        "nfft": nfft,
    }


def waterfall(x: np.ndarray, fs: float, nfft: int = 1024,
              n_rows: int = 128) -> dict:
    """STFT magnitude in dB: [time, freq, power]."""
    nfft = int(min(nfft, 2 ** int(np.ceil(np.log2(max(x.size, 8))))))
    nfft = max(nfft, 128)
    step = max(nfft // 4, 1)
    win = np.hanning(nfft)

    rows = []
    times = []
    for start in range(0, x.size - nfft + 1, step):
        seg = x[start:start + nfft]
        P = np.abs(np.fft.fftshift(np.fft.fft(seg * win))) ** 2
        rows.append(P)
        times.append(start / fs)
    if not rows:
        seg = x[:nfft]
        if seg.size < nfft:
            seg = np.pad(seg, (0, nfft - seg.size))
        rows = [np.abs(np.fft.fftshift(np.fft.fft(seg * win))) ** 2]
        times = [0.0]

    M = np.array(rows)
    if M.shape[0] > n_rows:
        # average-pool down to n_rows
        k = M.shape[0] // n_rows
        M = M[: k * n_rows].reshape(n_rows, k, -1).mean(axis=1)
        # times is a plain list; np.asarray before the pool reshape
        ts_pool = np.asarray(times[: k * n_rows]).reshape(n_rows, k).mean(axis=1)
        times = ts_pool.tolist()

    Mdb = 10 * np.log10(M / max(M.max(), 1e-30) + 1e-30)
    freqs = np.fft.fftshift(np.fft.fftfreq(nfft, 1 / fs)) / 1000.0  # kHz
    ts = np.array(times) * 1000.0  # ms

    # quantise power to int8 for compact JSON transport
    q = np.clip(Mdb, -100, 0)
    q = ((q + 100) / 100 * 127).astype(np.int8)

    return {
        "freq": freqs.round(3).tolist(),
        "time": ts.round(3).tolist(),
        "power": q.tolist(),
        "db_min": -100.0,
        "db_max": 0.0,
    }


def constellation(x: np.ndarray, max_points: int = 4000) -> dict:
    """IQ scatter (magnitude-preserving) plus a normalised unit-circle copy."""
    idx = np.linspace(0, x.size - 1, min(x.size, max_points)).astype(int)
    p = x[idx]
    return {
        "i": p.real.round(5).tolist(),
        "q": p.imag.round(5).tolist(),
        "n": int(x.size),
    }


def eye_diagram(x: np.ndarray, sps: int, n_traces: int = 60,
                tpb: int = 2) -> dict:
    """Eye diagram from the raw waveform at an assumed sps."""
    sps = int(max(sps, 2))
    n_per = sps * tpb
    usable = (x.size // n_per) * n_per
    if usable < n_per * 2:
        return {"t": [], "traces": []}
    xb = x[:usable].reshape(-1, sps)
    k = min(n_traces, xb.shape[0])
    sel = np.linspace(0, xb.shape[0] - 1, k).astype(int)
    tr = xb[sel]
    return {
        "t": (np.arange(sps) / sps).round(4).tolist(),
        "i": tr.real.round(4).tolist(),
        "q": tr.imag.round(4).tolist(),
    }