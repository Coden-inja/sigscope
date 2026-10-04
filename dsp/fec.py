"""FEC: convolutional coding, Viterbi decoding, and RS/block-code scoring.

CONVOLUTIONAL - DELEGATED TO COMMPY.

An earlier version of this file implemented the K=7 rate-1/2 encoder and a
soft-decision Viterbi decoder by hand. Both were wrong, and the ENCODER
was the more serious of the two:

    its output agreed with commpy.Trellis(7, [0o171, 0o133]) on only
    44.3% of bits, over 64 random input words.

The cause is the shift-register bit order. This file treated the current
input as the LSB (`s = (state << 1) | b`), while the MATLAB poly2trellis
convention that commpy follows - and that (171,133) is defined in - puts
the current input at the MSB (`window = (b << m) | s`) and the oldest bit
at the LSB. A K=7 r=1/2 convolutional code's codewords depend on every tap
position, so mirroring the register silently produces a DIFFERENT,
non-NASA code whose free distance collapses from 10 to 2. CommPy's
Trellis/Viterbi round-trips at BER 0.0 in both hard and soft mode; that is
the reference this project measures against, so both directions now go
through it rather than a second implementation that can drift.

Reed-Solomon syndrome scoring is kept as-is: it is self-contained, it is
not a convolutional code, and it is what scores an RS(n,k) candidate
geometry blind.
"""
from __future__ import annotations

import numpy as np

try:
    from commpy import Trellis as _Trellis
    from commpy import ConvolutionalEncoder as _ConvEncoder
    from commpy import viterbi_decode as _commpy_viterbi
    _HAS_COMMPY = True
except Exception:                                   # pragma: no cover
    _HAS_COMMPY = False


# ------------------------------------------------------------------ GF(256)

GF_POLY = 0x11D
GF_EXP = np.zeros(512, dtype=np.uint16)
GF_LOG = np.zeros(256, dtype=np.uint16)


def _init_gf():
    x = 1
    for i in range(255):
        GF_EXP[i] = x
        GF_LOG[x] = i
        x <<= 1
        if x & 0x100:
            x ^= GF_POLY
    for i in range(255, 512):
        GF_EXP[i] = GF_EXP[i - 255]


_init_gf()


def gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return int(GF_EXP[GF_LOG[a] + GF_LOG[b]])


def gf_pow(a: int, n: int) -> int:
    if a == 0:
        return 0
    return int(GF_EXP[(GF_LOG[a] * n) % 255])


def gf_inv(a: int) -> int:
    if a == 0:
        raise ZeroDivisionError
    return int(GF_EXP[255 - GF_LOG[a]])


def rs_generator_poly(nsym: int) -> np.ndarray:
    """Generator polynomial g(x) = prod (x - alpha^i), i=1..nsym."""
    g = np.array([1], dtype=np.uint8)
    for i in range(nsym):
        g = np.convolve(g, np.array([1, gf_pow(2, i)]), mode="full") % 256
        g = g.astype(np.uint8)
    return g


def rs_syndromes(block: np.ndarray, nsym: int) -> np.ndarray:
    """Evaluate received block at alpha^1..alpha^nsym (little-endian polys)."""
    s = np.zeros(nsym, dtype=np.uint8)
    for j in range(nsym):
        acc = 0
        root = gf_pow(2, j + 1)
        for c in block:
            acc = gf_mul(acc, root) ^ int(c)
        s[j] = acc
    return s


def rs_score_block(block_bits: np.ndarray, n: int, k: int) -> dict:
    """Score a bit-block as a RS(n,k) codeword via syndromes.

    The generator polynomial is `n-k` symbols long, which for common
    codes (n=k+m) lets us detect both the right geometry and whether the
    block is already a valid codeword.
    """
    nbytes = n // 8
    kbytes = k // 8
    if nbytes * 8 != n or kbytes * 8 != k:
        return {"syndromes": 0, "zero_syndromes": False, "valid": False,
                "reason": "n,k must be multiples of 8"}
    if block_bits.size < n:
        return {"syndromes": 0, "zero_syndromes": False, "valid": False,
                "reason": "block too short"}

    nblk = block_bits.size // n
    best_zero = 0
    checked = 0
    nsym = nbytes - kbytes
    if nsym <= 0 or nsym >= nbytes:
        return {"syndromes": nsym, "zero_syndromes": False, "valid": False,
                "reason": "invalid redundancy"}
    for b in range(min(nblk, 12)):
        blk = block_bits[b * n: b * n + n].reshape(nbytes, 8) @ (2 ** np.arange(7, -1, -1))
        blk = blk.astype(np.uint8)
        syn = rs_syndromes(blk, nsym)
        checked += 1
        if not np.any(syn):
            best_zero += 1
    return {
        "syndromes": int(nsym),
        "zero_syndromes": best_zero,
        "checked_blocks": checked,
        "valid": bool(best_zero > 0),
        "score": round(best_zero / max(checked, 1), 3),
    }


# ------------------------------------------------- convolutional coding

_TRELLIS_CACHE: dict = {}

DEFAULT_POLY = (0o171, 0o133)


def conv_trellis(k: int = 7, poly_a: int = DEFAULT_POLY[0],
                 poly_b: int = DEFAULT_POLY[1]):
    """Cached commpy Trellis. Raises RuntimeError if commpy is absent."""
    if not _HAS_COMMPY:
        raise RuntimeError("commpy required for convolutional coding")
    key = (int(k), int(poly_a), int(poly_b))
    if key not in _TRELLIS_CACHE:
        # commpy takes a plain sequence here: passing a numpy array trips
        # `if not generators` on an array's truth value.
        _TRELLIS_CACHE[key] = _Trellis(int(k), [int(poly_a), int(poly_b)])
    return _TRELLIS_CACHE[key]


def convolutional_encode(bits: np.ndarray, k: int = 7, rate: float = 0.5,
                         poly_a: int = DEFAULT_POLY[0],
                         poly_b: int = DEFAULT_POLY[1],
                         terminate: bool = True) -> np.ndarray:
    """Rate-1/2 K=7 convolutional encode via commpy.

    Zero-tail-terminated by default: `m` zero bits are appended so the
    register flushes back to state 0, which is what lets the decoder do
    exact (rather than best-effort) termination.

    `rate` is accepted for call compatibility but only 1/2 is
    implemented, since that is the two-polynomial case commpy's Trellis
    encodes. A different rate raises rather than being silently ignored.
    """
    if abs(rate - 0.5) > 1e-9:
        raise ValueError(f"only rate 1/2 is implemented, got {rate}")
    t = conv_trellis(k, poly_a, poly_b)
    enc = _ConvEncoder(t)
    out, _final = enc.encode(np.asarray(bits, dtype=np.int64),
                             terminate=terminate)
    return np.asarray(out, dtype=np.uint8)


def usable_len(n_bits: int, k: int = 7, poly_a: int = DEFAULT_POLY[0],
                poly_b: int = DEFAULT_POLY[1]) -> int:
    """Largest prefix length of `n_bits` that is a whole number of trellis
    steps. commpy's viterbi_decode rejects any other length outright, and a
    streaming demodulator routinely ends on an odd symbol."""
    n_out = len((poly_a, poly_b))
    return (int(n_bits) // n_out) * n_out


def conv_decode(received: np.ndarray, k: int = 7,
                poly_a: int = DEFAULT_POLY[0],
                poly_b: int = DEFAULT_POLY[1],
                mode: str = "soft", terminated: bool = True) -> np.ndarray:
    """Viterbi-decode via commpy. `received` is hard bits or LLRs.

    LLR convention is commpy's: positive favours bit 0. Any trailing bits
    that do not complete a trellis step are DROPPED here rather than
    raising - `usable_len` exposes the same arithmetic so callers can
    report the count instead of hiding it.
    """
    t = conv_trellis(k, poly_a, poly_b)
    if mode == "soft":
        rx = np.asarray(received, dtype=np.float64)
    else:
        rx = np.asarray(received, dtype=np.int64)
    n_use = usable_len(rx.size, k, poly_a, poly_b)
    if n_use == 0:
        return np.zeros(0, dtype=np.uint8)
    out = _commpy_viterbi(t, rx[:n_use], mode, terminated=terminated)
    return np.asarray(out, dtype=np.uint8)


def decode_conv(received, mode: str = "soft", k: int = 7,
                poly_a: int = DEFAULT_POLY[0],
                poly_b: int = DEFAULT_POLY[1],
                reference: np.ndarray = None) -> dict:
    """Viterbi-decode a frame and report the result honestly.

    `received` is LLRs when mode='soft' (commpy convention: positive
    favours bit 0) or hard 0/1 bits when mode='hard'. Soft input is
    preferred - it recovers several dB - but the mode is always recorded,
    because the coding gain differs and the caller may in fact be looking
    at an uncoded frame.
    """
    if not _HAS_COMMPY:
        return {"ok": False, "available": False,
                "reason": "commpy not installed",
                "decoded_bits": 0, "n_bits": 0}

    if received is None:
        return {"ok": False, "available": True, "reason": "no received bits",
                "decoded_bits": 0, "n_bits": 0}
    rx = np.asarray(received,
                    dtype=np.float64 if mode == "soft" else np.int64)
    if rx.size == 0:
        return {"ok": False, "available": True,
                "reason": "no received bits", "decoded_bits": 0, "n_bits": 0}

    n_out = 2
    dropped = int(rx.size - usable_len(rx.size, k, poly_a, poly_b))
    dec = conv_decode(rx, k, poly_a, poly_b, mode=mode, terminated=True)

    res = {
        "ok": True,
        "available": True,
        "implementation": "commpy.Trellis + commpy.viterbi_decode",
        "constraint_length": int(k),
        "polynomials_octal": [int(poly_a), int(poly_b)],
        "rate": "1/2",
        "mode": mode,
        "terminated": True,
        "decoded_bits": int(dec.size),
        "n_bits": int(rx.size),
        "trailing_bits_dropped": int(dropped),
    }
    if reference is not None:
        ref = np.asarray(reference, dtype=np.uint8).ravel()
        m = min(dec.size, ref.size)
        res["compared_bits"] = int(m)
        if m:
            err = int(np.sum(dec[:m] != ref[:m]))
            res["bit_errors"] = err
            res["ber"] = round(err / m, 6)
        else:
            res["bit_errors"] = None
            res["ber"] = None
    return res