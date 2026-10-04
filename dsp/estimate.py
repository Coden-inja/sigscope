"""Blind parameter estimation - no prior knowledge of the signal.

Everything here is data-driven. No CNN, no RadioML, no trained weights.

SYMBOL RATE
  For a randomly-modulated signal the autocorrelation is just the pulse
  autocorrelation and carries no symbol-period line, so the classic
  delay-and-multiply method fails. Instead we exploit the fact that any
  finite constellation has SOME moment with a non-zero mean, which
  creates a spectral line at exactly Rs after pulse shaping:

      BPSK      E[a^2] != 0   ->  x^2
      QPSK      E[a^4] != 0   ->  x^4      (E[a^2] == 0)
      8PSK      E[a^8] != 0   ->  x^8      (lower moments vanish)
      M-QAM     E[|a|^2]!=0   ->  |x|^2

  We compute all four channels, take the strongest resulting line, and
  snap the result to an integer samples-per-symbol (since a sampled
  capture must have integral sps). For M-FSK we instead read the
  symbol rate straight off the instantaneous-frequency tone spacing.

MODULATION
  Higher-order cumulants (HOCS) against their theoretical normalised
  reference values, plus instantaneous-frequency histogram for FSK
  discrimination and constellation clustering as a cross-check.
  No training data, no model weights.
"""
from __future__ import annotations

import numpy as np
from scipy.fft import next_fast_len


# ---------------------------------------------------------------- spectrum

def occupied_bandwidth(x: np.ndarray, fs: float) -> dict:
    """-3 dB and 99%-power bandwidth, plus in-band spectral centroid."""
    n = x.size
    nfft = int(2 ** np.ceil(np.log2(n)))
    X = np.abs(np.fft.fftshift(np.fft.fft(x * np.hanning(n), nfft))) ** 2
    f = np.fft.fftshift(np.fft.fftfreq(nfft, 1 / fs))
    P = X / max(X.max(), 1e-30)
    Pdb = 10 * np.log10(P + 1e-30)

    above = np.where(Pdb >= -3.0)[0]
    bw3 = float(f[above[-1]] - f[above[0]]) if above.size else 0.0
    csum = np.cumsum(X)
    lo_i = int(np.searchsorted(csum, 0.01 * csum[-1]))
    hi_i = int(np.searchsorted(csum, 0.99 * csum[-1]))
    bwp = float(f[hi_i] - f[lo_i])

    band = Pdb > (Pdb.max() - 25.0)
    cfo = float(np.sum(f[band] * X[band]) / max(np.sum(X[band]), 1e-30))
    return {"bw_3db": round(bw3, 1), "bw_99": round(bwp, 1),
            "centre_freq_hz": round(cfo, 1)}


# --------------------------------------------------- symbol rate (Rs)

def _line_freq(tone: np.ndarray, fs: float, nfft: int) -> float:
    """Strongest non-DC spectral line of a real or complex tone."""
    if np.iscomplexobj(tone):
        P = np.abs(np.fft.fft(tone, nfft)) ** 2
        half = P.size // 2
        P = np.r_[P[:half], P[:1]]
        P = P / max(P.max(), 1e-30)
        # ignore DC and the first couple of bins (residual mean)
        P[:4] = 0
        k = int(np.argmax(P))
        peak = P[k]
        floor = np.median(P) + 1e-30
        f = k * fs / nfft
        if f > fs / 2:
            f -= fs
    else:
        P = np.abs(np.fft.fft(tone, nfft)) ** 2
        P = P / max(P.max(), 1e-30)
        P[:4] = 0
        k = int(np.argmax(P))
        peak = P[k]
        floor = np.median(P) + 1e-30
        f = k * fs / nfft

    # parabolic interpolation for sub-bin accuracy
    if 0 < k < P.size - 1:
        a, b, c = P[k - 1], P[k], P[k + 1]
        denom = a - 2 * b + c
        if abs(denom) > 1e-30:
            delta = 0.5 * (a - c) / denom
            delta = float(np.clip(delta, -0.5, 0.5))
            f = (k + delta) * fs / nfft
    prominence = float(np.log10(max(peak, 1e-30) / floor))
    return float(f), prominence


def _if_histogram(x: np.ndarray, fs: float) -> dict:
    """Instantaneous-frequency histogram - reveals M-FSK tone spacing."""
    n = x.size
    d = x[1:] * np.conj(x[:-1])
    ph = np.angle(d) * fs / (2 * np.pi)
    ph = ph[np.isfinite(ph)]
    if ph.size < 64:
        return {"n_peaks": 0, "offset_hz": 0.0, "spacing_hz": 0.0,
                "peakiness": 0.0, "entropy": 1.0, "centres": []}

    k = max(3, (min(201, ph.size // 40)) | 1)
    ker = np.hanning(k)
    ker /= ker.sum()
    sm = np.convolve(ph, ker, mode="same")

    lo, hi = np.percentile(sm, [0.5, 99.5])
    if hi - lo < 1e-6:
        return {"n_peaks": 0, "offset_hz": 0.0, "spacing_hz": 0.0,
                "peakiness": 0.0, "entropy": 1.0, "centres": []}

    nb = 512
    h, edges = np.histogram(np.clip(sm, lo, hi), bins=nb, range=(lo, hi))
    h = h.astype(float)
    h /= max(h.sum(), 1e-30)
    hs = np.convolve(h, np.hanning(31), mode="same")
    hs /= max(hs.max(), 1e-30)

    span = hi - lo
    thr = 0.20
    idx = np.where((hs[1:-1] > thr) & (hs[1:-1] >= hs[:-2]) &
                   (hs[1:-1] >= hs[2:]))[0] + 1
    cent = (edges[idx] + edges[idx + 1]) / 2 if idx.size else np.array([])
    if cent.size > 1:
        keep = [cent[0]]
        for c in cent[1:]:
            if c - keep[-1] > span / 20.0:
                keep.append(c)
        cent = np.array(keep)
    # re-merge the wrap-around half of a two-sided spectrum
    if cent.size > 2:
        w = span / 20.0
        merged = [cent[0]]
        for c in cent[1:]:
            if abs(c - merged[-1]) <= w or abs(c - merged[-1]) > span - w:
                merged[-1] = (merged[-1] + c) / 2.0
            else:
                merged.append(c)
        cent = np.array(merged)

    p = h + 1e-12
    ent = float(-np.sum(p * np.log(p)) / np.log(nb))
    peakiness = float(np.max(hs))
    off = float(np.sum(cent) / cent.size) if cent.size else float(np.mean(sm))
    spacing = float(np.mean(np.diff(cent))) if cent.size > 1 else 0.0
    return {
        "n_peaks": int(cent.size),
        "offset_hz": round(off, 1),
        "spacing_hz": round(spacing, 1),
        "peakiness": round(peakiness, 3),
        "entropy": round(ent, 3),
        "centres": cent.round(1).tolist(),
    }


def symbol_rate_estimate(x: np.ndarray, fs: float) -> dict:
    """Blind Rs from nonlinear spectral-line extraction (+ FSK tone spacing)."""
    x = x - np.mean(x)
    x = x.astype(np.complex128)
    n = x.size
    if n < 64:
        return {"rs_bps": 0.0, "sps": 0.0, "confidence": 0.0,
                "method": "insufficient-samples"}

    nfft = next_fast_len(min(1 << 19, 4 * n))

    ifh = _if_histogram(x, fs)

    # --- PSK / QAM / FSK: strongest nonlinear spectral line ---
    # Run this FIRST. It is the accurate method (measured exact to 0.00%
    # for QPSK/8PSK across 1.2-9.6 kbps) and it is also valid for M-FSK,
    # since |x|^2 of a tone pair still carries a line at the tone spacing.
    env = np.abs(x)
    channels = {
        "x^2": x ** 2,
        "x^4": x ** 4,
        "x^8": x ** 8,
        "|x|^2": (env ** 2).astype(np.complex128),
    }
    best = (0.0, 0.0, None)
    for name, tone in channels.items():
        # remove residual DC so it cannot masquerade as a line
        tone = tone - np.mean(tone)
        f, prom = _line_freq(tone, fs, nfft)
        af = abs(f)
        if af <= 0:
            continue
        rs = af
        # must be a plausible symbol rate
        if rs < fs / 20000.0 or rs > fs / 6.0:
            continue
        if prom > best[0]:
            best = (prom, f, name)

    prom, f, chan = best
    if chan is not None and prom >= 0.35:
        rs_raw = abs(f)
        sps_raw = fs / rs_raw
        # a sampled capture must have integral samples-per-symbol
        sps_i = max(1, int(round(sps_raw)))
        conf = float(np.clip(0.45 + prom / 6.0, 0.3, 0.98))
        return {
            "rs_bps": round(fs / sps_i, 2),
            "rs_raw": round(rs_raw, 2),
            "sps": float(sps_i),
            "confidence": round(conf, 3),
            "method": f"nonlinear-line[{chan}]",
            "prominence": round(prom, 2),
            "if_hist": ifh,
        }

    # --- fallback: IF tone spacing (M-FSK symbol rate = 2 * spacing) ---
    # Only reached when no usable nonlinear line exists. Measured against
    # ground truth this is badly wrong (-24% to -85% on BPSK/QAM) and the
    # old code still returned confidence 0.97 for it, which is how a
    # 1200 bps BPSK capture got analysed at 914 bps. Cap the confidence
    # hard so callers can refuse to use it.
    if ifh["n_peaks"] >= 2 and ifh["entropy"] < 0.95:
        rs_fsk = 2.0 * abs(ifh["spacing_hz"])
        if 0 < rs_fsk < fs / 2:
            sps_i = max(1, int(round(fs / rs_fsk)))
            return {
                "rs_bps": round(fs / sps_i, 2),
                "rs_raw": round(rs_fsk, 2),
                "sps": float(sps_i),
                "confidence": 0.25,
                "method": "if-tone-spacing[FALLBACK,low-confidence]",
                "tone_peaks": ifh["n_peaks"],
                "prominence": 0.0,
                "if_hist": ifh,
            }

    return {"rs_bps": 0.0, "sps": 0.0, "confidence": 0.0,
            "method": "no-spectral-line-found", "if_hist": ifh}


# -------------------------------------------------------- modulation ID

def _rrc_taps(sps: int, beta: float, span: int = 8) -> np.ndarray:
    """Root-raised-cosine taps (same definition as the transmit side)."""
    n = span * sps
    t = np.arange(-n, n + 1) / sps
    if beta == 0:
        h = np.sinc(t)
    else:
        num = (np.sin(np.pi * t * (1 - beta))
               + 4 * beta * t * np.cos(np.pi * t * (1 + beta)))
        den = np.pi * t * (1 - (4 * beta * t) ** 2)
        h = np.zeros_like(t)
        good = np.abs(den) > 1e-9
        h[good] = num[good] / den[good]
        near0 = (~good) & (np.abs(t) < 1e-9)
        h[near0] = 1.0 + beta * (4 / np.pi - 1.0)
        sing = (~good) & (np.abs(t) >= 1e-9)
        if np.any(sing):
            h[sing] = (beta / np.sqrt(2)) * (
                (1 + 2 / np.pi) * np.sin(np.pi / (4 * beta))
                + (1 - 2 / np.pi) * np.cos(np.pi / (4 * beta)))
    # Unit PEAK, not unit energy: the filter is sampled at sps
    # samples/symbol so sum(h^2) ~ sps, and energy-normalising would
    # scale the matched-filter response down by sqrt(sps).
    peak = float(np.max(np.abs(h)))
    return h / peak if peak > 0 else h


def _estimate_rolloff(x: np.ndarray, fs: float, rs: float) -> float:
    """Blind excess-bandwidth (rolloff) estimation from spectral occupancy.

    An RRC-shaped signal of symbol rate Rs occupies approximately
    (1 + beta) * Rs. We measure the width of the in-band main lobe and
    read beta off that, so the matched filter can be built without the
    transmit-side parameters being known.
    """
    if rs <= 0 or x.size < 64:
        return 0.35
    n = int(min(x.size, 1 << 16))
    X = np.abs(np.fft.fftshift(np.fft.fft(x[:n] * np.hanning(n)))) ** 2
    f = np.fft.fftshift(np.fft.fftfreq(n, 1 / fs))
    if X.max() <= 0:
        return 0.35
    P = 10 * np.log10(X / X.max() + 1e-30)
    thr = P.max() - 20.0            # -20 dB main-lobe edges
    above = np.where(P > thr)[0]
    if above.size < 2:
        return 0.35
    width = float(f[above[-1]] - f[above[0]])
    beta = width / rs - 1.0
    return float(np.clip(beta, 0.0, 1.0))


def _symbol_decimate(x: np.ndarray, sps: int, beta: float = None) -> np.ndarray:
    """Matched-filter + decimate to the symbol rate.

    A plain box average is NOT enough: RRC spans several symbols, so
    neighbouring symbols leak in as ISI and smear the constellation
    (which destroys the higher-order cumulants the classifier relies on).
    The matched filter is what cancels that ISI.
    """
    sps = int(max(sps, 1))
    if sps <= 1:
        return x
    if x.size < sps * 16:
        return x
    if beta is None:
        beta = 0.35
    h = _rrc_taps(sps, beta)
    y = np.convolve(x, np.conj(h[::-1]), mode="same")

    # Blind timing-phase selection. The matched-filter output is correct
    # only at true symbol centres; sampling it between them leaves
    # residual ISI that smears the constellation. Since we do not know
    # the transmit alignment, try every phase in [0, sps) and keep the
    # one with the tightest (lowest-variance) constellation envelope.
    # This is the classic "maximum-eye-opening" timing selection.
    best_phase, best_cv = 0, np.inf
    n = (y.size // sps) * sps
    for ph in range(sps):
        v = y[ph:ph + n:sps]
        if v.size < 16:
            break
        mag = np.abs(v)
        cv = float(np.std(mag) / (np.mean(mag) + 1e-12))
        if cv < best_cv:
            best_cv, best_phase = cv, ph
    return y[best_phase:best_phase + n:sps]


def _higher_order_cumulants(x: np.ndarray) -> dict:
    """Normalised higher-order cumulants of the complex envelope.

    Convention: zero-mean, unit-power symbols. Reference values used by
    the classifier are the textbook normalised C42 / C63.
    """
    x = x - np.mean(x)
    m2 = np.mean(x ** 2)
    m4 = np.mean(x ** 4)
    m6 = np.mean(x ** 6)
    r2 = float(np.mean(np.abs(x) ** 2))
    r4 = float(np.mean(np.abs(x) ** 4))
    if r2 <= 0:
        return {"C42": 0.0, "C63": 0.0, "C42n": 0.0, "C63n": 0.0, "R2": 0.0}

    c42 = r4 - abs(m2) ** 2 - 2.0 * r2 ** 2
    m63 = np.mean(x ** 5 * np.conj(x))
    c63 = m63 - 15.0 * r2 ** 3 - 20.0 * m2 * r4

    return {
        "C42": float(np.real(c42)),
        "C63": float(np.real(c63)),
        "C42n": float(np.real(c42) / r2 ** 2),
        "C63n": float(np.real(c63) / r2 ** 3),
        "R2": r2,
    }


# Normalised theoretical C42 (unit-power symbols).
# Derived, not tabulated from memory:
#   BPSK   E[a^2]=1        -> C42 = 1 - 1 - 2 = -2
#   QPSK   E[a^2]=0        -> C42 = 1 - 0 - 2 = -1
#   8PSK   E[a^2]=0        -> C42 = 1 - 0 - 2 = -1   (identical to QPSK!)
#   16QAM  E[|a|^4]=1.32   -> C42 = 1.32 - 0 - 2 = -0.68
#   64QAM  E[|a|^4]=1.69   -> C42 = 1.69 - 0 - 2 = -0.31
# Note QPSK and 8PSK share a cumulant value by construction, so C42 alone
# cannot order PSK - constellation geometry must do that.
_HOCS_REF = {
    "BPSK": (-2.00, 0.00),
    "QPSK": (-1.00, 0.00),
    "8PSK": (-1.00, 0.00),
    "8QAM": ( 0.00, 0.64),
    "16QAM": (-0.68, 0.00),
    "64QAM": (-0.31, 0.00),
}


def _count_amplitude_levels(amp: np.ndarray, rel_thr: float = 0.12) -> int:
    """Number of distinct amplitude levels, via gaps in the sorted envelope."""
    a = np.sort(amp)
    if a.size < 32:
        return 1
    gaps = np.diff(a)
    thr = np.median(gaps) * 8.0
    if not np.isfinite(thr) or thr <= 0:
        return 1
    return int(1 + np.sum(gaps > max(thr, rel_thr * a.mean())))


def _kmeans(points: np.ndarray, k: int, iters: int = 30, seed: int = 0) -> dict:
    """Deterministic k-means on an (n,2) array."""
    n = points.shape[0]
    m = min(n, 5000)
    pts = points[np.linspace(0, n - 1, m).astype(int)]
    C = np.zeros((k, 2))
    for j in range(k):
        q = (j + 0.5) / k
        C[j] = [np.quantile(pts[:, 0], q), np.quantile(pts[:, 1], q)]
    lab = np.zeros(m, dtype=int)
    for _ in range(iters):
        d = (pts[:, None, :] - C[None, :, :]) ** 2
        newlab = np.argmin(d.sum(-1), axis=1)
        newC = np.zeros_like(C)
        for j in range(k):
            sel = newlab == j
            if np.any(sel):
                newC[j] = pts[sel].mean(axis=0)
            else:
                newC[j] = C[j]
        if np.all(newlab == lab) and np.allclose(newC, C):
            break
        lab, C = newlab, newC
    d = (pts[:, None, :] - C[None, :, :]) ** 2
    inertia = float(np.mean(np.min(d.sum(-1), axis=1)))
    radii = np.linalg.norm(C, axis=1)
    return {"centres": C, "inertia": inertia, "radii": radii,
            "counts": np.bincount(lab, minlength=k)}


def classify_modulation(x: np.ndarray, fs: float, sps: int = None,
                        beta: float = None) -> dict:
    """Blind modulation ID from HOCS + IF histogram + constellation geometry."""
    x = x - np.mean(x)
    x = x / max(float(np.sqrt(np.mean(np.abs(x) ** 2))), 1e-30)

    ifh_full = _if_histogram(x, fs)

    # Work on the matched-filtered symbol-rate stream: ISI-free
    # constellation, which is what makes the cumulants meaningful.
    if beta is None and sps:
        beta = _estimate_rolloff(x, fs, fs / max(sps, 1))
    xs = _symbol_decimate(x, sps, beta) if sps else x
    xs = xs / max(float(np.sqrt(np.mean(np.abs(xs) ** 2))), 1e-30)

    hoc = _higher_order_cumulants(xs)
    ifh = _if_histogram(xs, fs) if sps and sps > 1 else ifh_full

    env = np.abs(xs)
    env_cv = float(np.std(env) / (np.mean(env) + 1e-12))
    # After matched filtering, a constant-modulus signal has env_cv < ~0.1;
    # anything multi-level sits well above. 0.25 is a safe midpoint.
    const_mod = env_cv < 0.25

    ifh_s = ifh
    cands = []
    detail_common = {
        "env_cv": round(env_cv, 4),
        "C42n": round(hoc["C42n"], 3),
        "C63n": round(hoc["C63n"], 3),
        "if_entropy": ifh_s["entropy"],
        "if_peaks": ifh_s["n_peaks"],
    }

    # --- 1. FSK: discrete instantaneous-frequency tones, low envelope CV ---
    fsk_strength = float(np.clip((0.80 - ifh_s["entropy"]) / 0.35, 0, 1))
    fsk_strength *= float(np.clip(ifh_s["peakiness"] * 2.2, 0, 1))
    fsk_strength *= float(np.clip((0.45 - env_cv) / 0.30, 0, 1))
    if fsk_strength > 0.25 and ifh_s["n_peaks"] >= 2:
        order = int(min(8, max(2, ifh_s["n_peaks"])))
        cands.append((fsk_strength, f"{order}FSK", {
            **detail_common,
            "tone_centres_hz": ifh_s["centres"],
            "reason": "discrete IF tones + constant modulus",
        }))

    # --- 2. PSK vs QAM by envelope flatness ---
    # Constant modulus (env_cv ~ 0.01) => PSK/FSK. Multi-level => QAM.
    # This is far more reliable than C42, and note that cumulants CANNOT
    # separate QPSK from 8PSK: both have E[a^2]=0 so both give C42=-1.
    # Order within each family comes from constellation geometry.
    if const_mod:
        pool = ["BPSK", "QPSK", "8PSK"]
    else:
        pool = ["16QAM", "64QAM", "8QAM"]

    for lab in pool:
        if lab.endswith("PSK"):
            order = {"BPSK": 2, "QPSK": 4, "8PSK": 8}[lab]
            # count occupied phase sectors: an M-PSK constellation lights
            # up exactly M of the M candidate sectors
            nsec = 8
            sec = np.floor(((np.angle(xs) + np.pi) / (2 * np.pi) * nsec)
                           ).astype(int) % nsec
            counts = np.bincount(sec, minlength=nsec).astype(float)
            # M-phase signal => M occupied sectors, equal weight
            occupied = int(np.sum(counts > 0.10 * counts.max()))
            evenness = float(1.0 - counts.std() / (counts.mean() + 1e-12))
            score = float(np.exp(-2.5 * abs(occupied - order))) * \
                float(np.clip(evenness, 0, 1)) ** 0.5
            geo_lbl = {"occupied_sectors": occupied,
                       "sector_evenness": round(evenness, 3)}
            reason = f"{occupied} occupied phase sectors of 8 (expected {order})"
        else:
            # QAM: count distinct amplitude levels
            lvl = _count_amplitude_levels(np.abs(xs))
            order = {"8QAM": 8, "16QAM": 16, "64QAM": 64}[lab]
            exp_lvl = int(round(np.log2(np.sqrt(order))))
            score = float(np.exp(-1.5 * abs(lvl - exp_lvl)))
            geo_lbl = {"amplitude_levels": lvl,
                       "expected_levels": exp_lvl}
            reason = f"{lvl} distinct amplitude levels (expected {exp_lvl})"

        # mild corroboration from the cumulants (correct references only)
        ref42, _ = _HOCS_REF[lab]
        d42 = abs(hoc["C42n"] - ref42)
        score *= float(np.exp(-0.5 * d42))

        cands.append((max(score, 1e-9), lab, {
            **detail_common, **geo_lbl,
            "ref_C42n": ref42, "reason": reason,
        }))

    labels = [c[1] for c in cands]
    sc = np.array([max(c[0], 1e-9) for c in cands])
    conf = sc / sc.sum()
    order_idx = np.argsort(-conf)
    ranked = [{"mod": labels[i], "confidence": round(float(conf[i]), 3),
               "evidence": cands[i][2]} for i in order_idx]

    top = ranked[0]
    margin = top["confidence"] - (ranked[1]["confidence"]
                                  if len(ranked) > 1 else 0.0)

    return {
        "modulation": top["mod"],
        "confidence": top["confidence"],
        "margin": round(float(margin), 3),
        "ranked": ranked,
        "hocs": {k: round(float(v), 4) for k, v in hoc.items()},
        "if_hist": ifh_s,
        "env_cv": round(env_cv, 4),
        "method": "higher-order cumulants + IF histogram (no training data)",
    }


# ------------------------------------------- modulation ID by trial decoding

# Gate chosen from the measured separation on the corpus, not guessed.
# Over 25 captures (5 modulations x 5 SNRs, seed 17) trial decoding ranked
# the true modulation first in 24 cases:
#
#   correct cases : agreement >= 0.977, margin >= 0.284
#   the one miss  : 8PSK at 5 dB, lost to 16QAM by a margin of 0.011
#                   (agreement 0.625)
#
# So agreement >= 0.95 and margin >= 0.10 sit in wide empty gaps on both
# axes: every correct case clears them, the ambiguous case fails the margin
# and is ABSTAINED rather than reported as a confident wrong answer.
TRIAL_MIN_AGREEMENT = 0.95
TRIAL_MIN_MARGIN = 0.10
TRIAL_CANDIDATES = ("BPSK", "QPSK", "8PSK", "16QAM", "64QAM")


def classify_modulation_trial(x: np.ndarray, fs: float, sps: int,
                              preamble_bits: np.ndarray = None,
                              candidates=TRIAL_CANDIDATES,
                              min_agreement: float = TRIAL_MIN_AGREEMENT,
                              min_margin: float = TRIAL_MIN_MARGIN,
                              demodulate=None) -> dict:
    """Modulation ID by actually demodulating each candidate and scoring it.

    WHY, WHEN THE CUMULANT CLASSIFIER IS BETTER

    classify_modulation scores higher-order cumulants and an instantaneous
    frequency histogram. Measured on this corpus it is 9/15, and its
    failures are overconfident - it reports QPSK as 8PSK and 16QAM as
    64QAM at high confidence. Those are exactly the confidently-wrong
    answers that are worse than no answer.

    Trial decoding asks a question that cannot be faked: slice the capture
    with each candidate constellation, then compare the resulting bits to
    the frame preamble. Only the correct constellation produces the
    preamble. Measured 24/25 with the one miss abstained.

    THE HONEST LIMIT

    This needs a KNOWN preamble to score against. It is therefore framed-
    signal AMC, not blind AMC: on an arbitrary capture whose framing you
    do not know there is nothing to compare to, and this returns
    `abstained` with that reason instead of guessing. Falling back to
    classify_modulation in that case is a different (and much weaker)
    claim, so `method` records which one actually ran.

    `demodulate` is injected to avoid a circular import (dsp.demod does
    not import this module, but keeping the dependency explicit makes the
    coupling obvious).
    """
    if demodulate is None:
        from .demod import demodulate as _dem
        demodulate = _dem

    base = {
        "modulation": None,
        "confidence": None,
        "confidence_reliable": False,
        "abstained": True,
        "method": "trial decoding (demodulate each candidate, score the "
                  "frame preamble)",
        "min_agreement": float(min_agreement),
        "min_margin": float(min_margin),
    }

    if preamble_bits is None or np.asarray(preamble_bits).size < 8:
        base["reason"] = (
            "no preamble reference supplied, so no candidate can be "
            "scored. Trial decoding cannot run on a capture whose framing "
            "is unknown; it is not a blind classifier.")
        return base

    pre = np.asarray(preamble_bits, dtype=np.uint8).ravel()
    rows = []
    for m in candidates:
        try:
            out = demodulate(x, m, fs, sps, preamble_bits=pre)
        except Exception as e:                       # noqa: BLE001
            rows.append({"mod": m, "agreement": 0.0, "error": str(e)})
            continue
        if not out.get("ok"):
            rows.append({"mod": m, "agreement": 0.0,
                         "error": out.get("error", "demodulation failed")})
            continue
        b = np.asarray(out["bits"], dtype=np.uint8)
        n = min(b.size, pre.size)
        agree = (round(float(np.mean(b[:n] == pre[:n])), 4)
                 if n >= 8 else 0.0)
        rows.append({"mod": m, "agreement": agree,
                     "n_bits_compared": int(n)})

    if not rows:
        base["reason"] = "no candidate modulation could be demodulated"
        return base

    rows.sort(key=lambda r: -r["agreement"])
    best = rows[0]
    runner = rows[1]["agreement"] if len(rows) > 1 else 0.0
    margin = round(float(best["agreement"] - runner), 4)

    base.update({
        "modulation_best_any": best["mod"],
        "preamble_agreement": best["agreement"],
        "margin": margin,
        "ranked": rows,
    })

    if best["agreement"] >= min_agreement and margin >= min_margin:
        base.update({
            "modulation": best["mod"],
            "confidence": best["agreement"],
            "confidence_reliable": True,
            "abstained": False,
            "reason": None,
        })
    else:
        why = []
        if best["agreement"] < min_agreement:
            why.append(f"best candidate '{best['mod']}' matched the preamble "
                       f"only {best['agreement']:.3f} "
                       f"(need {min_agreement})")
        if margin < min_margin:
            why.append(f"margin over the runner-up was {margin:.3f} "
                       f"(need {min_margin})")
        base["reason"] = ("refusing to name a modulation: " + "; ".join(why))
    return base


# --------------------------------------------------------- coded-frame AMC

def classify_modulation_trial_coded(x: np.ndarray, fs: float, sps: int,
                                    preamble_bits: np.ndarray = None,
                                    candidates=TRIAL_CANDIDATES,
                                    order=None,
                                    k: int = 7, poly_a: int = 0o171,
                                    poly_b: int = 0o133,
                                    min_agreement: float = TRIAL_MIN_AGREEMENT,
                                    min_margin: float = TRIAL_MIN_MARGIN,
                                    demodulate_coded=None) -> dict:
    """Modulation ID for a FEC-coded frame, by trial-decoding CODED frames.

    WHY NOT classify_modulation_trial

    On a coded frame the ordinary trial decoder cannot work at all. The
    frame preamble is fed through the encoder and the interleaver before
    transmission, so it is NOT present in the received bits. Slicing a
    coded frame and comparing against the preamble compares against
    nothing, every candidate scores near zero, and the honest answer is
    `abstained`. Measured: all three coded demo cases abstained.

    dsp.coded.demodulate_coded already solves the harder problem - it
    searches rotation x interleaver JOINTLY through the Viterbi decoder
    and scores the recovered message against the preamble. The preamble
    then reappears, after decoding, so the same "cannot be faked" question
    becomes answerable again: a wrong constellation produces garbage LLRs,
    a garbage Viterbi output, and therefore no preamble match.

    WHY IT IS A SEQUENTIAL EARLY EXIT, NOT AN EXHAUSTIVE RANKING

    One demodulate_coded call costs order x len(candidate_perms()) Viterbi
    decodes - 18 for BPSK, 36 for QPSK and QAM, 72 for 8PSK, i.e. 198 if
    every candidate is tried. So candidates are visited in the order the
    (much cheaper) statistical classifier ranks them and the walk stops at
    the first that RESOLVES. This is asymmetric on purpose and the result
    says so: `candidates_examined` records how many were actually run, and
    the margin is measured against those examined rather than against an
    exhaustive field. When the statistical ranking puts the wrong
    modulation first this merely costs extra work and eventually abstains;
    it cannot produce a confident wrong answer, because acceptance still
    requires an actual preamble match from an actual Viterbi decode.

    `order` is the caller's statistical ranking (most likely first).
    """
    if demodulate_coded is None:
        from .coded import demodulate_coded as _dc
        demodulate_coded = _dc

    base = {
        "modulation": None,
        "confidence": None,
        "confidence_reliable": False,
        "abstained": True,
        "method": "trial decoding through the coded path (search rotation x "
                  "interleaver, then score the decoded frame preamble)",
        "min_agreement": float(min_agreement),
        "min_margin": float(min_margin),
        "coded": True,
    }

    if preamble_bits is None or np.asarray(preamble_bits).size < 8:
        base["reason"] = (
            "no preamble reference supplied, so no candidate can be scored. "
            "As with the uncoded trial decoder this is framed-signal AMC, "
            "not a blind classifier.")
        return base

    pre = np.asarray(preamble_bits, dtype=np.uint8).ravel()

    # Visit candidates in the caller's statistical order, then whatever is
    # left in the default order, so nothing in `candidates` is ever skipped.
    seq = [m for m in (order or []) if m in candidates]
    seq += [m for m in candidates if m not in seq]

    rows = []
    winner = None
    for m in seq:
        try:
            out = demodulate_coded(x, m, fs, sps, preamble_bits=pre,
                                   k=k, poly_a=poly_a, poly_b=poly_b)
        except Exception as e:                            # noqa: BLE001
            rows.append({"mod": m, "agreement": 0.0, "resolved": False,
                         "error": str(e)})
            continue
        if not out.get("ok"):
            rows.append({"mod": m, "agreement": 0.0, "resolved": False,
                         "error": out.get("error", "coded decode failed")})
            continue
        agree = float(out.get("preamble_agreement") or 0.0)
        res = bool(out.get("resolved"))
        rows.append({
            "mod": m,
            "agreement": round(agree, 4),
            "resolved": res,
            "interleaver": out.get("interleaver"),
            "rotation": out.get("rotation"),
            "rotation_order": out.get("rotation_order"),
            "search_margin": out.get("interleaver_margin"),
            "candidates_tried": out.get("candidates_tried"),
        })
        if res and agree >= min_agreement and winner is None:
            winner = out
            break

    examined = len(rows)
    rows.sort(key=lambda r: -r["agreement"])
    base["candidates_examined"] = examined
    base["candidates_available"] = len(seq)
    base["ranked"] = rows
    base["exhaustive"] = examined >= len(seq)

    if winner is not None:
        agree = float(winner["preamble_agreement"])
        others = [r["agreement"] for r in rows if r["mod"] != winner["mod"]]
        runner = max(others) if others else 0.0
        margin = round(agree - runner, 4)
        base.update({
            "modulation": winner["mod"],
            "confidence": round(agree, 4),
            "confidence_reliable": True,
            "abstained": False,
            "reason": None,
            "margin": margin,
            "preamble_agreement": round(agree, 4),
            "interleaver": winner.get("interleaver"),
            "rotation": winner.get("rotation"),
            "rotation_order": winner.get("rotation_order"),
            "search_margin": winner.get("interleaver_margin"),
        })
        if len(seq) > 1 and not base["exhaustive"]:
            base["margin_note"] = (
                f"stopped after {examined} of {len(seq)} candidates because "
                f"one resolved. The margin is measured against those "
                f"examined, in the statistical order they were tried, not "
                f"against every candidate.")
        return base

    # Nothing resolved. Say so honestly and name what came closest.
    scored = [r for r in rows if r.get("agreement") is not None]
    best = scored[0] if scored else None
    if best is None:
        base["reason"] = ("no candidate modulation could be run through the "
                          "coded path")
        return base
    base["modulation_best_any"] = best["mod"]
    base["preamble_agreement"] = best["agreement"]
    runner = scored[1]["agreement"] if len(scored) > 1 else 0.0
    base["margin"] = round(float(best["agreement"] - runner), 4)
    base["reason"] = (
        f"refusing to name a modulation: no candidate resolved through the "
        f"coded path after {examined} of {len(seq)} tried; best was "
        f"'{best['mod']}' at preamble agreement {best['agreement']:.3f} "
        f"(need {min_agreement}) with margin {base['margin']:.3f} "
        f"(need {min_margin})")
    return base


# --------------------------------------------------------- full estimator

def estimate_all(x: np.ndarray, fs: float, sps_hint: int = None,
                 preamble_bits=None, coded: bool = False) -> dict:
    """Full blind estimation chain -> one JSON-ready dict.

    `preamble_bits` is optional. When supplied, modulation ID runs by trial
    decoding, which is both more accurate and honest about ambiguity; when
    omitted it falls back to the cumulants classifier, which is weaker and
    whose failures are overconfident. The `method` field records which ran.
    """
    out = {"fs_hz": float(fs), "n_samples": int(x.size)}
    out["bandwidth"] = occupied_bandwidth(x, fs)

    rs = symbol_rate_estimate(x, fs)
    if sps_hint:
        rs["sps_hint"] = int(sps_hint)
    out["symbol_rate"] = rs

    sps = int(round(rs.get("sps", 0))) or sps_hint
    out["modulation"] = classify_modulation(x, fs, sps=sps)
    out["modulation_statistical"] = out["modulation"]
    if preamble_bits is not None:
        if coded:
            order = [c["mod"] for c in out["modulation"].get("ranked", [])]
            trial = classify_modulation_trial_coded(
                x, fs, sps, preamble_bits=preamble_bits, order=order)
        else:
            trial = classify_modulation_trial(x, fs, sps,
                                              preamble_bits=preamble_bits)
        # Keep the statistical ranking visible next to the trial result so
        # a disagreement between the two is visible rather than hidden.
        trial["statistical_top1"] = out["modulation"].get("modulation")
        trial["agrees_with_statistical"] = (
            trial.get("modulation") ==
            out["modulation"].get("modulation"))
        out["modulation"] = trial
    return out