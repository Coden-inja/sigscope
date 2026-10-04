"""De-interleaving: blind search over interleaver geometries.

The analyst usually does not know the interleaver, so we enumerate the
plausible families, apply each candidate, and score the RESULT.

SCORING CRITERION

The obvious structural heuristics - run length, transition rate, bit
entropy - cannot separate the candidates here, and are kept only as a
secondary diagnostic. A convolutional-coded frame carrying a random
payload IS near-random after encoding, so there is no "structure" for a
correct de-interleave to restore; the previous version of this file
ranked candidates on exactly that and could not have identified the right
one.

What a correct de-interleave restores is the CODE. With the right
permutation the Viterbi decoder's path metric converges and the decoded
message agrees with the frame preamble; with the wrong permutation the
decoder emits noise and agreement sits at chance. So the primary score is

    agreement(Viterbi(deinterleave(received_llr)), preamble)

That uses the preamble - the same known reference already used to pin the
carrier phase - and NOT the transmitted payload, so it remains a blind
search over geometry rather than a comparison against the answer.

CANDIDATES

Block geometries come from commpy.BlockInterleaver, which was verified to
round-trip and, importantly, to REJECT a mismatched receiver geometry
(tx 2x8 read back as 4x4 does not return the identity) - that rejection
is what makes the search informative. 'none' is the control.

commpy.ConvolutionalInterleaver was tried and is NOT used: its transmit
side emits a zero-fill ramp, and pairing it with the matching receive side
did not reproduce the input at any lane count tried (2/4/8/16, with and
without a flush tail). Rather than ship a claim that cannot be verified,
the convolutional family is left out.
"""
from __future__ import annotations

import numpy as np

try:
    from commpy import BlockInterleaver
    _HAS_COMMPY = True
except Exception:                                   # pragma: no cover
    _HAS_COMMPY = False


DIAGONAL_GEOMETRIES: tuple = ()      # see diagonal_perm(): all degenerate

# Candidate geometries searched blind. Kept small on purpose: each one
# costs a Viterbi decode, and an over-broad search mostly adds ways to
# produce a spurious best.
BLOCK_GEOMETRIES = ((2, 8), (8, 2), (4, 4),
                    (4, 16), (16, 4), (8, 8),
                    (4, 32), (32, 4))

# Minimum separation between the best and second-best candidate before we
# are willing to name an interleaver at all.
DEFAULT_MIN_MARGIN = 0.05


# ------------------------------------------------------------ candidates

def block_perm(rows: int, cols: int) -> np.ndarray:
    """Transmitter permutation for a rows x cols block interleaver.

    commpy writes the block row-wise and reads it column-wise, so
    transmitted = clean[perm] and the receiver recovers clean = wire[perm].
    """
    B = int(rows) * int(cols)
    d = np.arange(B, dtype=np.int64)
    return np.asarray(BlockInterleaver(int(rows), int(cols)).interleave(d),
                      dtype=np.int64)


def diagonal_perm(rows: int = 4, cols: int = 4) -> np.ndarray:
    """Diagonal (shear) interleaver within one block. DEGENERATE - see below.

    Kept only so the redundancy is documented and testable. For SQUARE
    blocks the shear `perm[i] = (i*c + (i*r)//B) mod B` reproduces the
    block transpose exactly - block_perm(4,4) and this both give
    [0,4,8,12,1,5,9,13,2,6,10,14,3,7,11,15] - so a "diagonal" candidate
    is a byte-identical duplicate of the square "block" one. That is not
    harmless: two candidates returning the same Viterbi output score
    identically, so the margin between the winner and the runner-up
    collapses to 0 and the abstain gate can never fire.

    For NON-square blocks the same formula is not even a permutation:
    diagonal_perm(2, 8) yields [0,8,0,8,0,8,0,8,1,9,1,9,1,9,1,9].

    So the diagonal family is excluded from the search. A genuinely
    distinct diagonal interleaver needs a construction that guarantees
    bijectivity by design (write column-major, read row-major with a
    per-row shear), not a closed-form index.
    """
    r, c = int(max(2, rows)), int(max(2, cols))
    B = r * c
    i = np.arange(B, dtype=np.int64)
    return (i * c + (i * r) // B) % B


def candidate_perms(n: int) -> list:
    """(label, perm, block_len) triples; perm[i] = wire pos of clean bit i."""
    out = [("none", np.arange(n, dtype=np.int64), 1)]
    if _HAS_COMMPY:
        for rows, cols in BLOCK_GEOMETRIES:
            B = rows * cols
            if B > n:
                continue
            try:
                out.append((f"block{rows}x{cols}", block_perm(rows, cols), B))
            except Exception:
                continue
    for rows, cols in DIAGONAL_GEOMETRIES:
        B = rows * cols
        if B > n:
            continue
        out.append((f"diag{rows}x{cols}", diagonal_perm(rows, cols), B))

    # Dedupe by permutation identity. Two candidates that produce the same
    # permutation produce the same Viterbi output and therefore the same
    # score, which collapses the winner-to-runner-up margin to 0 and makes
    # the abstain gate unfireable. Dropping duplicates costs nothing and
    # keeps the margin meaningful.
    seen = set()
    uniq = []
    for label, perm, blk in out:
        key = (int(blk), perm.tobytes())
        if key in seen:
            continue
        seen.add(key)
        uniq.append((label, perm, blk))
    return uniq


def _undo(wire: np.ndarray, perm: np.ndarray, block_len: int) -> np.ndarray:
    """Apply the inverse permutation block-wise; tail passes through."""
    if block_len <= 1:
        return wire
    nfull = wire.size // block_len
    if nfull == 0:
        return wire
    body = wire[:nfull * block_len].reshape(nfull, block_len)
    out = np.empty_like(body)
    for bi in range(nfull):
        out[bi] = body[bi][perm]
    tail = wire[nfull * block_len:]
    if tail.size:
        return np.concatenate([out.reshape(-1), tail])
    return out.reshape(-1)


def deinterleave(bits: np.ndarray, label: str, block_len: int = None,
                 n_hint: int = None) -> np.ndarray:
    """Undo the candidate named by `label` (as produced by candidate_perms)."""
    n = int(n_hint if n_hint is not None else bits.size)
    if label == "none":
        return bits
    perm, blk = _lookup(label, n)
    return _undo(bits, perm, blk)


def _lookup(label: str, n: int) -> tuple:
    for lab, perm, blk in candidate_perms(n):
        if lab == label:
            return perm, blk
    raise ValueError(f"unknown interleaver candidate '{label}'")


def interleave(bits: np.ndarray, label: str) -> np.ndarray:
    """Transmit-side operation: the exact inverse of `deinterleave`.

    Both directions go through the same permutation, since
    clean = wire[perm] and wire = clean[perm] are the same statement about
    the transposed map - applying `perm` twice is the identity.
    """
    return deinterleave(bits, label, n_hint=bits.size)


# ------------------------------------------------------------- scoring

def structure_score(bits: np.ndarray) -> dict:
    """Secondary diagnostic only - see the module docstring.

    Cheap, and it characterises the stream, but it is NOT the selection
    criterion: a conv-coded random payload has no run-length or entropy
    structure for a correct de-interleave to restore.
    """
    if bits.size < 32:
        return {"total": 0.0, "longest_run": 0, "mean_run": 0.0,
                "transition_rate": 0.0, "entropy": 0.0, "autocorr": 0.0,
                "note": "too short to score"}

    changes = np.flatnonzero(np.diff(bits.astype(np.int8)) != 0)
    bounds = np.concatenate([[0], changes + 1, [bits.size]])
    runs = np.diff(bounds)
    longest = int(runs.max()) if runs.size else 0
    mean_run = float(runs.mean()) if runs.size else 1.0

    d = np.diff(bits)
    d = d[d != 0]
    trate = float(np.mean(d != 0)) if d.size else 0.5

    p1 = float(np.mean(bits))
    H = 0.0
    if 0 < p1 < 1:
        H = -(p1 * np.log2(p1) + (1 - p1) * np.log2(1 - p1))

    ac = 0.0
    if bits.size > 64:
        bb = bits.astype(np.float64)
        bb = bb - bb.mean()
        denom = float(np.sum(bb * bb)) + 1e-12
        vals = [float(np.sum(bb[:-lag] * bb[lag:]) / denom)
                for lag in (1, 2, 4, 8) if lag < bb.size]
        ac = float(np.mean(np.abs(vals))) if vals else 0.0

    return {
        "total": round(float(0.35 * np.clip(longest / 32.0, 0, 1)
                             + 0.25 * np.clip(mean_run / 16.0, 0, 1)
                             + 0.20 * (1.0 - trate) + 0.10 * ac
                             + 0.10 * (1.0 - H)), 4),
        "longest_run": longest,
        "mean_run": round(mean_run, 2),
        "transition_rate": round(trate, 4),
        "entropy": round(H, 4),
        "autocorr": round(ac, 4),
    }


def search_deinterleaver(received, preamble_bits, viterbi_decode,
                         mode: str = "soft",
                         min_margin: float = DEFAULT_MIN_MARGIN) -> dict:
    """Blind de-interleave search, scored by preamble agreement.

    `received` may be hard bits or LLRs (per `mode`); `viterbi_decode(arr,
    mode)` must return decoded message bits for one candidate stream.
    Permuting LLRs per-bit is exactly equivalent to permuting hard
    decisions, so the same search covers both.

    ABSTAINS unless the winner clears `min_margin`. A search that reports
    a best-guess interleaver with no separation produces confident
    nonsense, which is the failure mode this project avoids elsewhere.
    """
    preamble = np.asarray(preamble_bits, dtype=np.uint8).ravel()
    if received is None or received.size == 0 or preamble.size < 8:
        return {"ok": False, "resolved": False, "candidates": 0,
                "reason": "no received bits or no preamble to score against",
                "best": None, "margin": None}

    rx = np.asarray(received)
    n = rx.size
    results = []
    for label, perm, blk in candidate_perms(n):
        try:
            cand = _undo(rx, perm, blk)
            dec = np.asarray(viterbi_decode(cand, mode), dtype=np.uint8).ravel()
        except Exception as exc:
            results.append({"candidate": label, "error": str(exc)})
            continue
        m = min(dec.size, preamble.size)
        agree = float(np.mean(dec[:m] == preamble[:m])) if m else 0.0
        results.append({
            "candidate": label,
            "block_len": int(blk),
            "preamble_agreement": round(agree, 4),
            "decoded_bits": int(dec.size),
            "structure": structure_score(dec),
        })

    scored = [r for r in results if "preamble_agreement" in r]
    if not scored:
        return {"ok": False, "resolved": False, "candidates": len(results),
                "reason": "every candidate failed to decode",
                "best": None, "margin": None, "ranking": results}
    scored.sort(key=lambda r: -r["preamble_agreement"])
    best = scored[0]
    margin = (best["preamble_agreement"] - scored[1]["preamble_agreement"]
              if len(scored) > 1 else best["preamble_agreement"])

    resolved = bool(best["preamble_agreement"] >= 0.999
                    and margin >= min_margin)
    out = {
        "ok": True,
        "resolved": resolved,
        "candidates": len(results),
        "best": best["candidate"] if resolved else None,
        "best_candidate_any": best["candidate"],
        "best_agreement": round(best["preamble_agreement"], 4),
        "margin": round(float(margin), 4),
        "min_margin": float(min_margin),
        "ranking": scored,
        "criterion": "Viterbi-decoded preamble agreement",
    }
    if not resolved:
        out["reason"] = (
            f"best candidate '{best['candidate']}' scored "
            f"{best['preamble_agreement']:.4f} with margin {margin:.4f} - "
            f"below the {min_margin} separation required to name one")
    return out