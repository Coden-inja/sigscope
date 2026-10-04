"""Synthetic signal generator with PUBLISHED GROUND TRUTH.

This is the single most important file in the project. A DSP pipeline is
only believable if you can prove it recovers parameters that were never
told to it. Every signal produced here emits a sidecar .truth.json
containing the exact parameters used, so the dashboard can display
estimated-vs-true and the demo becomes reproducible proof instead of a
claim.

Modulation: BPSK QPSK 8PSK 16QAM 64QAM 2FSK 4FSK 8FSK
Optional: convolutionally-coded payload + interleaver + AWGN.
"""
from __future__ import annotations

import json
import os
import re

import numpy as np

from .fec import convolutional_encode


# ------------------------------------------------------------- mapping

_GRAY = {2: [0b00, 0b01, 0b11, 0b10],
         3: [0b000, 0b001, 0b011, 0b010, 0b110, 0b111, 0b101, 0b100],
         4: [0b0000, 0b0001, 0b0011, 0b0010, 0b0110, 0b0111, 0b0101, 0b0100,
             0b1100, 0b1101, 0b1111, 0b1110, 0b1010, 0b1011, 0b1001, 0b1000]}


_PSK_ORDER = {"BPSK": 2, "QPSK": 4}
_QAM_ORDER = {"16QAM": 16, "64QAM": 64, "4QAM": 4}

_GRAY_INV: dict = {}


def _gray_inv(nb: int) -> np.ndarray:
    """Lookup table mapping a Gray-coded value to its natural index.

    Gray code is n XOR (n >> 1). Note that a naive `while t:` loop that
    XORs adjacent bits silently truncates leading zeros, which for nb=2
    yields [0,1,2,3] (identity) instead of the true [0,1,3,2] - that bug
    collapsed every QAM axis to 2 levels and made 16QAM emit only 4
    distinct symbols.
    """
    if nb not in _GRAY_INV:
        g = np.array([n ^ (n >> 1) for n in range(1 << nb)], dtype=np.int64)
        inv = np.zeros(1 << nb, dtype=np.int64)
        for gi, gn in enumerate(g):
            inv[gn] = gi
        _GRAY_INV[nb] = inv
    return _GRAY_INV[nb]


def _bits_to_symbols(bits: np.ndarray, mod: str) -> np.ndarray:
    """Gray-coded M-PSK / M-QAM symbol mapper -> normalised complex symbols."""
    mod = mod.upper()
    if mod.endswith("PSK"):
        m = _PSK_ORDER[mod] if mod in _PSK_ORDER else int(re.search(r"\d+", mod).group())
        bpb = int(np.log2(m))
        pad = (-len(bits)) % bpb
        if pad:
            bits = np.concatenate([bits, np.zeros(pad, np.uint8)])
        vals = (bits.reshape(-1, bpb).astype(np.int64)
                @ (2 ** np.arange(bpb - 1, -1, -1, dtype=np.int64)))
        nat = _gray_inv(bpb)[vals]
        return np.exp(1j * 2 * np.pi * nat / m).astype(np.complex128)

    if mod.endswith("QAM"):
        m = _QAM_ORDER[mod] if mod in _QAM_ORDER else int(re.search(r"\d+", mod).group())
        k = int(np.log2(m))
        assert k % 2 == 0, "square QAM only"
        axis = k // 2   # bits per axis (I and Q each)
        pad = (-len(bits)) % k
        if pad:
            bits = np.concatenate([bits, np.zeros(pad, np.uint8)])
        bm = bits.reshape(-1, k).astype(np.int64)
        w = 2 ** np.arange(axis - 1, -1, -1, dtype=np.int64)
        # pack each axis's bit columns back into an integer value before
        # looking it up - the Gray table is indexed by value, not columns
        i_vals = bm[:, :axis] @ w
        q_vals = bm[:, axis:] @ w
        gdec = _gray_inv(axis)

        # Centre on the constellation's true midpoint. `axis` is BITS per
        # axis, so the LEVELS per axis are 2**axis: 16QAM (axis=2) has 4
        # levels centred on 1.5, 64QAM (axis=3) has 8 centred on 3.5.
        # Subtracting (axis-1)/2 instead emitted levels {0..L-1} shifted by
        # a constant - a TRANSLATED constellation with |E[a]| ~ 0.7.
        # That is not a small cosmetic offset: a square QAM is only
        # C4-rotationally symmetric about the ORIGIN, so with a DC offset
        # x**4 is dominated by mean(a)**4 and arg(mean(x**4)) pins the
        # 4th-power CFO estimate at 0 Hz. QAM + carrier offset was
        # therefore resting entirely on block phase tracking.
        half = ((1 << axis) - 1) / 2.0
        ii = gdec[i_vals] - half
        qq = gdec[q_vals] - half
        sym = (ii + 1j * qq).reshape(-1)
        return sym / np.sqrt(np.mean(np.abs(sym) ** 2))

    raise ValueError(f"unknown modulation '{mod}'")


# --------------------------------------------------------- pulse shaping

def _rrc(t: np.ndarray, beta: float, sps: int) -> np.ndarray:
    """Root-raised-cosine taps."""
    if beta == 0:
        return np.sinc(t)

    # Closed-form RRC, vectorised. The two removable singularities
    # (k -> 0 and 4*beta*k -> +/-1) are filled with their analytic
    # limits, which is what keeps the filter's peak and rolloff correct.
    k = np.asarray(t, dtype=float)
    num = (np.sin(np.pi * k * (1 - beta))
           + 4 * beta * k * np.cos(np.pi * k * (1 + beta)))
    den = np.pi * k * (1 - (4 * beta * k) ** 2)
    out = np.zeros_like(k)
    good = np.abs(den) > 1e-9
    out[good] = num[good] / den[good]

    # limit at k = 0
    near0 = (~good) & (np.abs(k) < 1e-9)
    out[near0] = 1.0 + beta * (4 / np.pi - 1.0)

    # limit at 4*beta*k = +/-1  (the "eye opening" points)
    sing = (~good) & (np.abs(k) >= 1e-9)
    if np.any(sing):
        ks = k[sing]
        b = beta
        # analytic continuation at |4*b*k| = 1
        val = ((b / np.sqrt(2)) * ((1 + 2 / np.pi) * np.sin(np.pi / (4 * b))
               + (1 - 2 / np.pi) * np.cos(np.pi / (4 * b))))
        out[sing] = val if b > 0 else 0.0
        del ks
    return out


def upsample(symbols: np.ndarray, sps: int, beta: float = 0.35) -> np.ndarray:
    """Pulse-shape a symbol stream at `sps` samples/symbol with RRC.

    The impulse train is built symmetrically about each symbol instant
    (samples at k*sps + span*sps) and convolved with 'full', so symbol k
    lands exactly at output index k*sps. Using mode='same' instead would
    both attenuate the pulse (keeping only the middle of a 2*span*sps
    filter) and shift the symbol grid, which smears the constellation
    and makes the data unrecoverable.
    """
    sps = int(sps)
    span = 8
    n = span * sps
    # t is in SYMBOL units, matching the closed-form RRC definition.
    t = np.arange(-n, n + 1, dtype=float) / sps
    h = _rrc(t, beta, sps)
    # Normalise to unit PEAK, not unit energy. The RRC is sampled at
    # sps samples/symbol, so sum(h^2) ~ sps and energy-normalising
    # divides the peak by sqrt(sps) (~9x at sps=80), destroying the
    # constellation. Unit peak keeps symbols at |a| ~ 1 after shaping.
    peak_idx = int(np.argmax(np.abs(h)))
    peak = float(np.abs(h[peak_idx]))
    if peak > 0:
        h = h / peak

    # Impulse train padded so the filter spreads without clipping, then
    # convolve and compensate BOTH the padding delay and the offset of
    # the filter's true peak from its geometric centre. Assuming the peak
    # sits at the centre index shifts the whole symbol grid by tens of
    # samples, which smears the constellation beyond recovery.
    L = symbols.size * sps
    up = np.zeros(L + 2 * n, dtype=np.complex128)
    up[n:n + L:sps] = symbols

    y = np.convolve(up, h, mode="full")
    start = n + peak_idx
    return y[start:start + L]


# ------------------------------------------------------------- modulators

def _modulate(symbols: np.ndarray, mod: str, sps: int,
              beta: float = 0.35) -> np.ndarray:
    """Complex-baseband waveform for PSK/QAM."""
    return upsample(symbols, sps, beta)


def _fsk_modulate(symbols: np.ndarray, order: int, sps: int,
                  fs: float, rs: float, cfo: float = 0.0,
                  beta: float = 0.35) -> np.ndarray:
    """M-FSK via a bank of orthogonal tone generators (tone spacing Rs/2)."""
    n = symbols.size * sps
    sym_level = (np.real(symbols).astype(int) + order) % order
    dt = 1.0 / fs

    # Per-sample tone frequency, held constant across each symbol period.
    freq = (sym_level - (order - 1) / 2.0) * rs / 2.0
    freq = np.repeat(freq, sps)

    # Integrate phase so tone transitions are phase-continuous.
    phase = 2.0 * np.pi * np.cumsum(freq) * dt
    phase += 2.0 * np.pi * cfo * np.arange(n) * dt

    # Window each symbol period slightly to give a soft transition.
    out = np.exp(1j * phase)
    win = np.hanning(2 * sps)
    win /= max(win.sum(), 1e-12)
    out = np.convolve(out, win, mode="same")

    return out * np.sqrt(1.0 / max(np.mean(np.abs(out) ** 2), 1e-12))


# -------------------------------------------------------------- pipeline

def generate(mod: str = "QPSK", n_bits: int = 8000, sps: int = None,
             rs_bps: float = 1200.0, fs: float = 96000.0,
             snr_db: float = 20.0, cfo_hz: float = 0.0,
             phase_deg: float = 0.0, fec: str = None,
             conv_k: int = 7, rate: float = 0.5,
             interleave: str = None, seed: int = 7,
             include_header: bool = True) -> dict:
    """Generate a capture + return (waveform, ground_truth).

    rs_bps and fs define the signal; sps is DERIVED as round(fs/rs_bps) so
    the capture is always self-consistent. Passing sps explicitly only
    overrides the derived value (and rs_bps is then recomputed to match).

    fec          : None | 'conv'
    interleave   : None | 'block' | 'diagonal' | 'random'
    """
    rng = np.random.default_rng(seed)
    mod = mod.upper()
    is_fsk = mod.endswith("FSK")

    if sps is None:
        sps = int(max(2, round(fs / rs_bps)))
    else:
        # keep the pair self-consistent: derive Rs from the sampling grid
        sps = int(max(2, sps))
        rs_bps = fs / sps
    sps = int(sps)

    if mod == "BPSK":
        digits = 2
    elif mod == "QPSK":
        digits = 4
    else:
        digits = int(re.search(r"\d+", mod).group())
    bpb = 1 if is_fsk else int(np.log2(digits))
    order = digits if is_fsk else 0
    nsym = n_bits // bpb

    # payload: a structured frame so header/payload split is meaningful
    if include_header:
        # Preamble of 1s (for non-coherent acquisition), a length field,
        # then an alternating sync pattern. Expanded to individual BITS,
        # not raw byte values, so the stream is genuinely binary.
        sync = np.tile([1, 0, 1, 0, 1, 0, 0, 1], 4)      # 32-bit sync
        length_field = np.tile([1, 1, 0, 0, 1, 0, 0, 0], 4)
        header = np.concatenate([np.ones(24, np.uint8), length_field, sync])
        payload = rng.integers(0, 2, max(nsym * bpb - header.size, 0),
                               dtype=np.uint8)
        frame = np.concatenate([header, payload])
    else:
        header = np.array([], np.uint8)
        frame = rng.integers(0, 2, nsym * bpb, dtype=np.uint8)

    truth = {
        "modulation": mod,
        "fs_hz": fs,
        "rs_bps": rs_bps,
        "sps": int(sps),
        "snr_db": snr_db,
        "cfo_hz": cfo_hz,
        "phase_deg": phase_deg,
        "bits_per_symbol": bpb,
        "n_symbols": int(frame.size // bpb),
        "fec": fec or "none",
        "conv_k": conv_k if fec == "conv" else None,
        "code_rate": rate if fec == "conv" else None,
        "interleave": interleave or "none",
        "header_bits": int(header.size),
        "generator_seed": seed,
    }

    code_bits = frame
    if fec == "conv":
        code_bits = convolutional_encode(frame, k=conv_k, rate=rate)
        truth["n_code_bits"] = int(code_bits.size)

    # Interleaving is applied HERE, on the wire bits, after FEC encoding -
    # which is the whole point of an interleaver. It used to be recorded
    # in `truth` and never applied, so every case labelled
    # interleave='block'/'diagonal' was really an un-interleaved capture
    # wearing the label.
    if interleave:
        from .interleave import interleave as _il
        code_bits = _il(np.asarray(code_bits, dtype=np.uint8), interleave)
        truth["interleave_applied"] = True
    else:
        truth["interleave_applied"] = False

    syms = np.zeros(code_bits.size // bpb, dtype=np.complex128)
    if bpb == 1:
        syms = np.where(code_bits > 0, -1.0 + 1e-9, 1.0).astype(np.complex128)
    else:
        syms = _bits_to_symbols(code_bits, mod)

    if is_fsk:
        x = _fsk_modulate(syms, order, sps, fs, rs_bps, cfo=cfo_hz)
    else:
        x = _modulate(syms, mod, sps)

    # re-normalise after pulse shaping, then apply impairments
    x = x / max(np.sqrt(np.mean(np.abs(x) ** 2)), 1e-30)
    x = x * np.exp(1j * (2 * np.pi * cfo_hz * np.arange(x.size) / fs + np.deg2rad(phase_deg)))

    # pulse shaping on FSK introduced amplitude ripple; normalise again
    power = np.mean(np.abs(x) ** 2)
    if snr_db is not None and snr_db < 99:
        noise_p = power / (10 ** (snr_db / 10.0))
        w = np.sqrt(noise_p / 2.0) * (rng.standard_normal(x.size) + 1j * rng.standard_normal(x.size))
        x = x + w

    x = x / max(np.sqrt(np.mean(np.abs(x) ** 2)), 1e-30)
    truth["actual_snr_db"] = float(round(10 * np.log10(power / max(np.mean(np.abs(x) ** 2) - power, 1e-30)), 2))
    return {"signal": x.astype(np.complex64), "truth": truth, "frame_bits": frame}


def save_case(outdir: str, name: str, **kw) -> dict:
    """Write <name>.iq + <name>.truth.json (and .wav variant)."""
    os.makedirs(outdir, exist_ok=True)
    from scipy.io import wavfile

    res = generate(**kw)
    x = res["signal"]
    iq = os.path.join(outdir, f"{name}.iq")
    x.astype(np.complex64).tofile(iq)

    # stereo .wav variant: I on left, Q on right
    n = min(x.size, 200000)
    wav = os.path.join(outdir, f"{name}.wav")
    i16 = np.clip(x[:n].real * 32767, -32768, 32767).astype(np.int16)
    q16 = np.clip(x[:n].imag * 32767, -32768, 32767).astype(np.int16)
    wavfile.write(wav, int(kw.get("fs", 96000)), np.stack([i16, q16], axis=1))

    tpath = os.path.join(outdir, f"{name}.truth.json")
    # Store the transmitted frame bits so a BER can be recomputed from the
    # file alone. Without them the validator has no reference for coded
    # frames and could only report "decoded, unverifiable" - which is how
    # a broken decoder could pass unnoticed. Hex-packed rather than a JSON
    # list of ints: 8000 bits is ~40 kB per case as [0,1,...].
    t = dict(res["truth"])
    fb = np.asarray(res["frame_bits"], dtype=np.uint8)
    t["frame_bits_hex"] = fb.tobytes().hex()
    t["n_frame_bits"] = int(fb.size)
    with open(tpath, "w") as f:
        json.dump(t, f, indent=2)

    return {"iq": iq, "wav": wav, "truth": tpath, "truth_obj": res["truth"]}