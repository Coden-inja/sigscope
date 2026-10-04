"""Coded-frame pipeline: demodulate -> de-interleave -> Viterbi.

WHY THIS IS SEPARATE FROM demodulate()

A coded frame cannot go through the ordinary demodulation path. The
2*pi/M rotation ambiguity is resolved by matching the received bits to
the frame preamble, but in a coded frame the preamble is not in the
received bits at all - it is FEC-encoded (and usually interleaved) first.
Searching the preamble against coded bits therefore searches for
something that is not there, picks an essentially arbitrary rotation, and
poisons everything downstream.

For a coded frame the search has to run THROUGH the decoder: try each
candidate rotation, de-interleave, Viterbi-decode, and only then compare
against the preamble. With QPSK that is 4 rotations x N interleaver
candidates Viterbi decodes, which is cheap for a few thousand bits.

The ambiguity itself is not assumed away. If no candidate separates by the
required margin, the caller is told the frame is unresolved rather than
being handed a best guess.
"""
from __future__ import annotations

import numpy as np

from .demod import (_PSK_ORDERS, _qam_levels, block_phase_track, cfo_power_order,
                    coarse_cfo, defo_correct, eye_open_sync, slice_psk,
                    slice_qam, resolve_rotation)
from .fec import conv_decode, decode_conv, usable_len
from .interleave import DEFAULT_MIN_MARGIN, candidate_perms, _undo


def _slice(syms: np.ndarray, mod: str):
    """Slice to (bits, per-bit LLRs) using the right slicer for `mod`."""
    if mod in _PSK_ORDERS:
        return slice_psk(syms, _PSK_ORDERS[mod])
    lv = _qam_levels(mod)
    if lv >= 2:
        return slice_qam(syms, int("".join(c for c in mod if c.isdigit())))
    return np.zeros(0, dtype=np.uint8), np.zeros(0)


def _rotation_order(mod: str) -> int:
    if mod in _PSK_ORDERS:
        return _PSK_ORDERS[mod]
    return 4


def demodulate_coded(x: np.ndarray, mod: str, fs: float, sps: int,
                     preamble_bits: np.ndarray = None,
                     cfo_hint: float = None, k: int = 7,
                     poly_a: int = 0o171, poly_b: int = 0o133,
                     reference: np.ndarray = None,
                     min_margin: float = DEFAULT_MIN_MARGIN) -> dict:
    """Demodulate a convolutionally-coded frame and recover the message.

    Returns the DECODED message bits (the frame that was fed to the
    encoder), not the wire bits. `reference`, when supplied, is the
    pre-encoding frame and is only used to compute a BER for display.
    """
    mod = mod.upper()
    sps = int(max(sps, 2))
    stages = []

    m_ord = cfo_power_order(mod)
    cfo = cfo_hint
    if cfo is None:
        cfo = coarse_cfo(x, fs, m_ord)
    stages.append({"stage": "coarse_cfo", "method": f"{m_ord}th-power",
                   "cfo_hz": round(float(cfo), 2)})

    y = defo_correct(x, fs, cfo or 0.0)
    syms = eye_open_sync(y, sps, 0.35, mod=mod, fs=fs)
    if syms.size < 16:
        return {"ok": False, "error": "too few symbols recovered",
                "bits": [], "n_bits": 0, "stages": stages}
    
    # QAM requires alignment to the grid BEFORE block_phase_track, otherwise 
    # the k-means level estimator in block_phase_track will fit to a rotated
    # constellation and fail to track phase, making the 4-point ambiguity search later useless.
    syms, _conf, _rot, amb = resolve_rotation(syms, mod)
    
    syms, phases, max_step = block_phase_track(syms, mod)
    stages.append({"stage": "timing", "method": "oerder-meyr",
                   "n_symbols": int(syms.size)})
    stages.append({"stage": "phase_track", "n_blocks": int(phases.size),
                   "max_block_phase_rad": round(float(max_step), 4)})

    pre = (np.zeros(0, dtype=np.uint8) if preamble_bits is None
           else np.asarray(preamble_bits, dtype=np.uint8).ravel())

    order = _rotation_order(mod)
    tried = []
    for krot in range(order):
        v = syms * np.exp(-1j * 2 * np.pi * krot / order)
        _bits, llr = _slice(v, mod)
        llr = np.asarray(llr, dtype=np.float64)
        if llr.size == 0:
            continue
        for label, perm, blk in candidate_perms(int(llr.size)):
            cand = _undo(llr, perm, blk)
            dec = conv_decode(cand, mode="soft", k=k,
                              poly_a=poly_a, poly_b=poly_b)
            if dec.size == 0:
                tried.append({"rotation": krot, "interleaver": label,
                              "agreement": 0.0, "decoded_bits": 0})
                continue
            m = min(dec.size, pre.size)
            agree = (float(np.mean(dec[:m] == pre[:m]))
                     if (m >= 8 and pre.size) else float("nan"))
            tried.append({"rotation": int(krot), "interleaver": label,
                          "agreement": (None if np.isnan(agree)
                                        else round(agree, 4)),
                          "decoded_bits": int(dec.size)})

    scored = [t for t in tried if t.get("agreement") is not None]
    scored.sort(key=lambda t: -t["agreement"])
    if not scored:
        return {"ok": False, "resolved": False,
                "error": "no candidate could be scored against a preamble",
                "bits": [], "n_bits": 0, "stages": stages, "ranking": tried}

    best = scored[0]
    margin = (best["agreement"] - scored[1]["agreement"]
              if len(scored) > 1 else best["agreement"])
    resolved = bool(best["agreement"] >= 0.999 and margin >= min_margin)

    # Re-decode the winner so the returned bits are the ones that scored.
    v = syms * np.exp(-1j * 2 * np.pi * best["rotation"] / order)
    _bits, llr = _slice(v, mod)
    llr = np.asarray(llr, dtype=np.float64)
    for label, perm, blk in candidate_perms(int(llr.size)):
        if label != best["interleaver"]:
            continue
        clean = _undo(llr, perm, blk)
        break
    else:
        clean = llr
    dec = conv_decode(clean, mode="soft", k=k, poly_a=poly_a, poly_b=poly_b)

    out = {
        "ok": True,
        "mod": mod,
        "resolved": resolved,
        "confidence": round(float(best["agreement"]), 4) if resolved else None,
        "confidence_reliable": bool(resolved),
        "bits": dec.astype(np.uint8).tolist(),
        "n_bits": int(dec.size),
        "n_symbols": int(syms.size),
        "symbols": syms,
        "interleaver": best["interleaver"] if resolved else None,
        "interleaver_best_any": best["interleaver"],
        "interleaver_margin": round(float(margin), 4),
        "interleaver_note": (
            "receiver-side geometry. A block interleaver and its transpose "
            "are inverse permutations of one another - de-interleaving with "
            "rows x cols is interleaving with cols x rows - so the reported "
            "name may be the transpose of the transmit geometry. The "
            "decoded bits are identical either way."),
        "rotation": int(best["rotation"]) if resolved else None,
        "rotation_order": int(order),
        "preamble_agreement": round(float(best["agreement"]), 4),
        "candidates_tried": len(tried),
        "ranking": scored[:8],
        "stages": stages,
        "used_commpy": ["estimate_cfo_mth_power", "Trellis",
                        "viterbi_decode"],
    }
    if not resolved:
        out["reason"] = (
            f"best candidate (rotation {best['rotation']}, interleaver "
            f"'{best['interleaver']}') reached preamble agreement "
            f"{best['agreement']:.4f} with margin {margin:.4f}; below the "
            f"{min_margin} separation required to report a decoded frame")
    if reference is not None:
        ref = np.asarray(reference, dtype=np.uint8).ravel()
        m = min(dec.size, ref.size)
        out["ber"] = (round(float(np.mean(dec[:m] != ref[:m])), 6)
                      if m else None)
        out["compared_bits"] = int(m)
    return out