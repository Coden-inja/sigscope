"""Reproducible demodulator validation sweep.

Run:  python scripts/validate.py            # nominal grid
      python scripts/validate.py --quick    # nominal config only

Everything here is measured, not asserted: each cell is a real generate ->
demodulate -> BER comparison against the transmitted frame bits.

Measured envelope (Rs=1200, sps=80, fs=96k, preamble supplied):
  nominal        BPSK/QPSK/8PSK/16QAM 0.000, 64QAM 0.0007
  SNR            BPSK/QPSK/16QAM/64QAM clean to 0 dB; 8PSK breaks ~5 dB
  CFO 0..700 Hz  all five modulations clean (worst 64QAM 0.0007)
  phase 0..360   all modulations clean at every angle tested

Why the CFO row is now clean: the QAM mapper used to emit a TRANSLATED
constellation (levels {0..L-1} centred on the wrong value, so |E[a]|~0.7).
A square QAM is only C4-symmetric about the ORIGIN, so x**4 was dominated
by the DC offset and arg(mean(x**4)) pinned the 4th-power CFO estimate at
0 Hz - QAM carrier offset was resting entirely on block phase tracking,
which cannot hold lock on a dense 8x8 grid. Centring the mapper fixed it at
the source. See the note in dsp/gen.py::_bits_to_symbols.

Blind mode (no preamble) is honest about what it cannot know: PSK fails
(BER 1.0 / 0.5 / 0.33 for BPSK / QPSK / 8PSK) because the 2*pi/M rotation
class is unobservable without a reference, and confidence is WITHHELD
rather than reporting a misleadingly high grid-fit score.

Coded frames get their own section. A coded frame cannot use the ordinary
demodulation path at all: the rotation search matches the received bits to
the frame preamble, but in a coded frame the preamble is FEC-encoded and
interleaved first, so it is not in the received bits and that search
returns an arbitrary rotation. dsp/coded.py instead searches rotation x
interleaver JOINTLY through the Viterbi decoder, and abstains when no
candidate separates by the required margin.
"""

import argparse
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np

sys.path.insert(0, ".")

from dsp.coded import demodulate_coded     # noqa: E402
from dsp.demod import demodulate          # noqa: E402
from dsp.estimate import (classify_modulation,   # noqa: E402
                          classify_modulation_trial,
                          classify_modulation_trial_coded)
from dsp.gen import generate              # noqa: E402
from dsp.ingest import snr_db             # noqa: E402
from dsp.interleave import candidate_perms  # noqa: E402

FS = 96000.0
RS = 1200.0
SPS = 80
N_BITS = 3000
MODS = ["BPSK", "QPSK", "8PSK", "16QAM", "64QAM"]
SNR_PROBE = [5, 10, 15, 20, 25]

# Must match dsp/interleave.py candidate_perms(). 'none' and the block
# geometries are receiver-side names; a block interleaver and its
# transpose are inverses, so the reported name may be the transpose of
# the transmitted one and decoded bits are identical either way.
FEC_INTERLEAVERS = [None, "block4x4", "block8x2"]


def _perm_for(label, n=N_BITS):
    # Normalise the label: the "no interleaver" candidate is spelled
    # "none" in candidate_perms() but arrives as None from truth and as
    # the string "None" via str(). Fold every spelling onto one form.
    if label is None:
        label = "none"
    label = str(label).strip().lower()
    for lab, perm, blk in candidate_perms(n):
        if lab == label:
            return perm, blk
    return None, None


def _invert(perm):
    inv = np.empty_like(perm)
    inv[perm] = np.arange(perm.size, dtype=perm.dtype)
    return inv


def label_matches_truth(picked, truth_label, n=N_BITS):
    """Is the reported interleaver the transmitted one, or its inverse?

    A block interleaver and its transpose are inverses, so a correct
    receiver may legitimately name either. Comparing NAMES would therefore
    be near-tautological, so this compares PERMUTATIONS instead: the picked
    permutation must equal the transmitted permutation or its inverse.

    This still is not a vacuous test - it rejects a pick of the wrong
    geometry entirely (e.g. answering block2x8 when block4x4 was sent),
    which a BER-only check cannot see, because several geometries decode
    the same bits at low BER once the wrong one happens to be inverted
    consistently.
    """
    p_perm, p_blk = _perm_for(picked, n)
    t_perm, t_blk = _perm_for(str(truth_label), n)
    if p_perm is None or t_perm is None or p_blk != t_blk:
        return False
    return (np.array_equal(p_perm, t_perm)
            or np.array_equal(p_perm, _invert(t_perm)))

# Same preamble the generator writes: 24 ones + length field + sync.
PREAMBLE = np.concatenate([
    np.ones(24, np.uint8),
    np.tile([1, 1, 0, 0, 1, 0, 0, 0], 4),
    np.tile([1, 0, 1, 0, 1, 0, 0, 1], 4),
])


def ber_for(mod, snr=20.0, cfo=0.0, phase=0.0, seed=0, preamble=True):
    """Return (ber, confidence) for one generated capture."""
    r = generate(mod=mod, n_bits=N_BITS, rs_bps=RS, fs=FS,
                 snr_db=snr, cfo_hz=cfo, phase_deg=phase, seed=seed)
    x = r["signal"].astype(np.complex128)
    ref = r["frame_bits"]
    out = demodulate(x, mod, FS, SPS,
                     preamble_bits=PREAMBLE if preamble else None)
    if not out.get("ok"):
        return None, 0.0
    bits = np.asarray(out["bits"], dtype=np.uint8)
    n = min(bits.size, ref.size)
    if n == 0:
        return None, 0.0
    conf = out.get("confidence")
    return (float(np.mean(bits[:n] != ref[:n])),
            0.0 if conf is None else float(conf))


def _fmt(ber):
    return "ERR" if ber is None else f"{ber:.5f}"


# ----------------------------------------------------------- parallel driver
# Every sweep case is independent - generate, demodulate, score - so they
# fan out across cores cleanly. Measured single-core cost of the whole
# suite is ~3.7 min, dominated by classify_modulation_trial (5 demodulations
# per case) and demodulate_coded (36 Viterbi decodes per case); on 4 cores
# that is ~1 min.

def _worker_count(requested=None) -> int:
    if requested:
        return max(1, int(requested))
    env = os.environ.get("VALIDATE_WORKERS")
    if env:
        try:
            return max(1, int(env))
        except ValueError:
            pass
    return max(1, (os.cpu_count() or 1))


class _Pool:
    """One lazily-created process pool, reused for the whole run.

    Creating a ProcessPoolExecutor per _run() call was a real and measured
    pessimisation: the sweeps call _run once per sweep value (22 times
    alone), and every new pool spawns `workers` fresh interpreters that
    each re-import numpy, scipy and commpy from scratch. Measured on this
    machine that cost 75s of CPU spread across 221s elapsed - a 0.34x
    SPEEDUP, i.e. slower than running serially. One pool for the whole
    run amortises the import cost once.
    """

    def __init__(self, workers):
        self.workers = max(1, int(workers))
        self._ex = None

    def map(self, worker, tasks):
        tasks = list(tasks)
        if not tasks:
            return []
        if self.workers <= 1 or len(tasks) == 1:
            return [worker(t) for t in tasks]
        if self._ex is None:
            try:
                self._ex = ProcessPoolExecutor(max_workers=self.workers)
            except Exception as e:                       # noqa: BLE001
                print(f"  (parallel pool unavailable: {e}; running serially)")
                self.workers = 1
                return [worker(t) for t in tasks]
        try:
            return list(self._ex.map(worker, tasks))
        except Exception as e:                           # noqa: BLE001
            print(f"  (pool failed: {e}; running serially)")
            self.shutdown()
            self.workers = 1
            return [worker(t) for t in tasks]

    def shutdown(self):
        if self._ex is not None:
            try:
                self._ex.shutdown(wait=True)
            except Exception:                            # noqa: BLE001
                pass
            self._ex = None


# Workers must be module-level (picklable by name under the Windows spawn
# start method) and take only picklable arguments.

def _w_ber(a):
    mod, snr, cfo, phase, seed = a
    return ber_for(mod, snr=snr, cfo=cfo, phase=phase, seed=seed)


def _w_snr(a):
    mod, snr = a
    r = generate(mod=mod, n_bits=3000, rs_bps=RS, fs=FS,
                 snr_db=float(snr), seed=0)
    return snr_db(r["signal"].astype(np.complex128))


def _w_amc(a):
    mod, snr, seed = a
    r = generate(mod=mod, n_bits=3000, rs_bps=RS, fs=FS,
                 snr_db=float(snr), seed=seed)
    x = r["signal"].astype(np.complex128)
    h = classify_modulation(x, FS, SPS)
    t = classify_modulation_trial(x, FS, SPS, preamble_bits=PREAMBLE)
    claimed = (not t.get("abstained")) and t.get("modulation")
    return {
        "hocs": h.get("modulation"),
        "hocs_ok": h.get("modulation") == mod,
        "trial": t.get("modulation"),
        "claimed": claimed,
        "trial_ok": claimed == mod,
        "agree": t.get("preamble_agreement"),
        "margin": t.get("margin"),
        "seed": seed,
    }


def _w_coded_amc(a):
    mod, snr, il, seed = a
    r = generate(mod=mod, n_bits=3000, rs_bps=RS, fs=FS,
                 snr_db=float(snr), fec="conv", conv_k=7, rate=0.5, interleave=il, seed=seed)
    x = r["signal"].astype(np.complex128)
    h = classify_modulation(x, FS, SPS)
    order = [c["mod"] for c in h.get("ranked", [])]
    t = classify_modulation_trial_coded(x, FS, SPS, preamble_bits=PREAMBLE, order=order)
    claimed = (not t.get("abstained")) and t.get("modulation")
    return {
        "hocs": h.get("modulation"),
        "hocs_ok": h.get("modulation") == mod,
        "trial": t.get("modulation"),
        "claimed": claimed,
        "trial_ok": claimed == mod,
        "agree": t.get("preamble_agreement"),
        "margin": t.get("margin"),
        "seed": seed,
        "examined": t.get("candidates_examined"),
        "available": t.get("candidates_available"),
    }


def _w_fec(a):
    il, seed = a
    r = generate(mod="QPSK", n_bits=3000, rs_bps=RS, fs=FS, snr_db=18.0,
                 fec="conv", conv_k=7, rate=0.5, interleave=il, seed=seed)
    out = demodulate_coded(r["signal"].astype(np.complex128), "QPSK", FS,
                           SPS, preamble_bits=PREAMBLE,
                           reference=r["frame_bits"])
    return {
        "interleave": il,
        "seed": seed,
        "resolved": bool(out.get("resolved")),
        "picked": out.get("interleaver"),
        "ber": out.get("ber"),
    }


def _w_fec_uncoded(a):
    _ignored, seed = a
    r = generate(mod="QPSK", n_bits=3000, rs_bps=RS, fs=FS, snr_db=18.0,
                 fec="none", seed=seed)
    out = demodulate_coded(r["signal"].astype(np.complex128), "QPSK", FS,
                           SPS, preamble_bits=PREAMBLE)
    return out.get("preamble_agreement")



def nominal(seeds=5, pool=None):
    print("=== nominal demo config (snr=20 dB, cfo=0, phase=0) ===")
    print("mod".ljust(8) + "".join(f"seed{s}".ljust(11) for s in range(seeds))
          + "max")
    tasks = [(m, 20.0, 0.0, 0.0, s) for m in MODS for s in range(seeds)]
    res = pool.map(_w_ber, tasks)
    ok = True
    for i, m in enumerate(MODS):
        bers = [res[i * seeds + s][0] for s in range(seeds)]
        vals = [b for b in bers if b is not None]
        worst = max(vals) if vals else 1.0
        if worst > 0.01 or len(vals) != seeds:
            ok = False
        print(m.ljust(8) + "".join(_fmt(b).ljust(11) for b in bers)
              + f"{worst:.5f}")
    return ok


def sweep(title, values, key, seeds=3, pool=None):
    print(f"\n=== {title} (worst of {seeds} seeds) ===")
    print(key.ljust(7) + "".join(m.ljust(11) for m in MODS))
    rows = {}
    for v in values:
        tasks = [(m, float(v), 0.0, 0.0, s) if key == "snr"
                 else (m, 20.0, float(v), 0.0, s) if key == "cfo"
                 else (m, 20.0, 0.0, float(v), s)
                 for m in MODS for s in range(seeds)]
        res = pool.map(_w_ber, tasks)
        row = []
        for i, m in enumerate(MODS):
            vals = [res[i * seeds + s][0] for s in range(seeds)]
            if any(b is None for b in vals):
                row.append(float("nan"))
            else:
                row.append(max(vals))
        rows[v] = row
        print(str(v).ljust(7) + "".join(_fmt(b).ljust(11) for b in row))
    return rows


def snr_probe(pool=None):
    print("\n=== blind SNR estimator vs known SNR ===")
    print("mod".ljust(8) + "".join(f"{s:>9}dB" for s in SNR_PROBE))
    print("-" * 62)
    res = pool.map(_w_snr,
                   [(m, float(s)) for m in MODS for s in SNR_PROBE])
    n = len(SNR_PROBE)
    offsets, bad = [], False
    for i, m in enumerate(MODS):
        row = res[i * n:(i + 1) * n]
        for s, est in zip(SNR_PROBE, row):
            if np.isfinite(est):
                offsets.append(est - s)
        finite = [e for e in row if np.isfinite(e)]
        # must not decrease as SNR rises
        if any(b < a - 0.5 for a, b in zip(finite, finite[1:])):
            bad = True
            print(f"  {m}: NOT monotonic -> {['%.2f' % e for e in row]}")
        print(m.ljust(8) + "".join(
            ("     ERR" if not np.isfinite(e) else f"{e:9.2f}")
            for e in row))
    if offsets:
        mean_off = float(np.mean(offsets))
        spread = float(np.ptp(offsets))
        print(f"  offset vs truth: mean {mean_off:+.2f} dB, "
              f"spread {spread:.2f} dB over {len(offsets)} points")
        if spread > 2.0:
            print("  FAIL: estimate depends on modulation")
            bad = True
        else:
            print("  ok: modulation-independent")
    return not bad


def fec_and_interleave(seeds=3, pool=None):
    """Coded frames: de-interleave + Viterbi, with a joint rotation search.

    Checks the three things that matter:
      1. the frame is RESOLVED (the search separated from the runner-up),
      2. the decoded BER is low,
      3. a wrong hypothesis is actually REJECTED rather than reported -
         this is the honesty check. Without it, a search that always
         returns its best guess would pass the first two.
    """
    print("\n=== FEC + de-interleave (QPSK, snr=18 dB) ===")
    print("interleave".ljust(12) + "resolved".ljust(10)
          + "picked".ljust(12) + "worst BER".ljust(11) + "label".ljust(9)
          + "n")
    res = pool.map(_w_fec,
                   [(il, s) for il in FEC_INTERLEAVERS for s in range(seeds)])
    ok = True
    for i, il in enumerate(FEC_INTERLEAVERS):
        rows = res[i * seeds:(i + 1) * seeds]
        n_res = sum(1 for r in rows if r["resolved"])
        picked = sorted({r["picked"] for r in rows
                         if r["resolved"] and r["picked"]})
        bers = [r["ber"] for r in rows
                if r["resolved"] and r["ber"] is not None]
        worst_ber = max(bers) if bers else None

        # Label correctness, checked per seed at the permutation level.
        # A case that failed to resolve has no label to check.
        judged = [r for r in rows if r["resolved"] and r["picked"]]
        n_lbl = sum(1 for r in judged
                    if label_matches_truth(r["picked"], il))
        label_ok = bool(judged) and n_lbl == len(judged)

        resolved = n_res == seeds
        good = (resolved and worst_ber is not None and worst_ber <= 0.01
                and label_ok)
        ok = ok and good
        lbl = (f"{n_lbl}/{len(judged)}" if judged else "n/a")
        print(str(il).ljust(12)
              + ("yes" if resolved else f"NO ({n_res}/{seeds})").ljust(10)
              + ",".join(picked).ljust(12)
              + _fmt(worst_ber).ljust(11)
              + (lbl if label_ok else f"{lbl} BAD").ljust(9)
              + f"{n_res}/{seeds}"
              + ("" if good else "   <-- FAIL"))
        if resolved and len(picked) > 1:
            print(f"     note: picked different interleavers across seeds "
                  f"({picked})")
        if judged and not label_ok:
            for r in judged:
                if not label_matches_truth(r["picked"], il):
                    print(f"     note: seed reported '{r['picked']}' but "
                          f"{il} was sent (permutation mismatch)")

    # Honesty check: the preamble is not in the coded stream, so a stream
    # built WITHOUT FEC must NOT score a perfect preamble match through
    # the coded path. If it did, the "agreement" metric would be measuring
    # nothing.
    agrees = pool.map(_w_fec_uncoded, [(None, s) for s in range(seeds)])
    agree = max((a for a in agrees if a is not None), default=None)
    honest = agree is None or agree < 0.999
    verdict = ("rejected (good)" if honest
               else "ACCEPTED (BAD - the preamble metric is not "
                    "discriminating)")
    print(f"\n  uncoded stream through the coded path: agreement={agree}"
          f" -> {verdict}")
    return ok and honest


def amc_trial_decoding(seeds=2, pool=None):
    """Modulation ID: cumulants vs trial decoding, with abstention.

    The point of this section is not that trial decoding scores well, it
    is that the WRONG answers are refused. A classifier that is 15/15 but
    overconfident on its misses would be worse than one that abstains, so
    both numbers are reported: correct picks, and wrong picks that were
    NOT caught.
    """
    print("\n=== modulation ID: cumulants vs trial decoding ===")
    print(f"{'mod':<6} {'snr':>4} | {'HOCS':<7} {'ok':<3} | "
          f"{'trial':<7} {'agree':>6} {'margin':>7} {'resolved':>9} "
          f"{'ok':<3}")
    snrs = (20.0, 15.0, 10.0, 5.0)
    tasks = [(m, float(s), sd) for m in MODS for s in snrs
             for sd in range(seeds)]
    res = pool.map(_w_amc, tasks)
    hocs_ok = trial_ok = 0
    wrong_and_claimed = []
    per = len(snrs) * seeds
    for i, m in enumerate(MODS):
        rows = res[i * per:(i + 1) * per]
        for r in rows:
            hocs_ok += bool(r["hocs_ok"])
            trial_ok += bool(r["trial_ok"])
            if r["claimed"] and not r["trial_ok"]:
                wrong_and_claimed.append((m, r))
        # one representative line per (mod, snr): first seed
        for j, s in enumerate(snrs):
            r = rows[j * seeds]
            print(f"{m:<6} {s:4.0f} | {str(r['hocs']):<7} "
                  f"{'Y' if r['hocs_ok'] else 'n':<3} | "
                  f"{str(r['trial']):<7} {_f2(r['agree']):>6} "
                  f"{_f2(r['margin']):>7} "
                  f"{('yes' if r['claimed'] else 'ABSTAIN'):>9} "
                  f"{'Y' if r['trial_ok'] else 'n':<3}")

    n = len(res)
    print(f"\n  cumulants top-1 correct : {hocs_ok}/{n}")
    print(f"  trial decode  correct   : {trial_ok}/{n}")
    if wrong_and_claimed:
        print("  FAIL: confidently wrong answers were NOT abstained:")
        for m, w in wrong_and_claimed:
            print(f"    truth={m} claimed={w['trial']} "
                  f"(agree={w['agree']}, margin={w['margin']})")
        return False
    print("  ok: every wrong answer was abstained, not claimed")
    return True


def coded_amc(seeds=2, pool=None):
    print("\n=== coded modulation ID (snr=18 dB) ===")
    print(f"{'mod':<6} {'il':<10} | {'HOCS':<7} {'ok':<3} | "
          f"{'trial':<7} {'agree':>6} {'margin':>7} {'resolved':>9} "
          f"{'ok':<3} {'exam'}")
    c_mods = ["BPSK", "QPSK", "8PSK", "16QAM", "64QAM"]
    tasks = [(m, 18.0, il, sd) for m in c_mods for il in FEC_INTERLEAVERS for sd in range(seeds)]
    res = pool.map(_w_coded_amc, tasks)
    
    hocs_ok = trial_ok = 0
    wrong_and_claimed = []
    for r, (m, snr, il, sd) in zip(res, tasks):
        hocs_ok += bool(r["hocs_ok"])
        trial_ok += bool(r["trial_ok"])
        if r["claimed"] and not r["trial_ok"]:
            wrong_and_claimed.append((m, r))
        if sd == 0:
            print(f"{m:<6} {str(il):<10} | {str(r['hocs']):<7} "
                  f"{'Y' if r['hocs_ok'] else 'n':<3} | "
                  f"{str(r['trial']):<7} {_f2(r['agree']):>6} "
                  f"{_f2(r['margin']):>7} "
                  f"{('yes' if r['claimed'] else 'ABSTAIN'):>9} "
                  f"{'Y' if r['trial_ok'] else 'n':<3} "
                  f"{r['examined']}/{r['available']}")
                  
    n = len(res)
    print(f"\n  cumulants top-1 correct : {hocs_ok}/{n}")
    print(f"  trial decode  correct   : {trial_ok}/{n}")
    if wrong_and_claimed:
        print("  FAIL: confidently wrong answers were NOT abstained:")
        for m, w in wrong_and_claimed:
            print(f"    truth={m} claimed={w['trial']} "
                  f"(agree={w['agree']}, margin={w['margin']})")
        return False
    print("  ok: every wrong answer was abstained, not claimed")
    return True


def _f2(v, width=6):
    return " " * width if v is None else f"{float(v):{width}.3f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true",
                    help="nominal config only")
    ap.add_argument("--workers", type=int, default=None,
                    help="parallel worker processes "
                         "(default: all logical cores)")
    args = ap.parse_args()

    w = _worker_count(args.workers)
    pool = _Pool(w)
    t_start = time.perf_counter()
    try:
        ok = nominal(seeds=1 if args.quick else 5, pool=pool)

        if not args.quick:
            print(f"\n[workers: {pool.workers}]")
            sweep("SNR sweep (dB)", [30, 20, 15, 12, 10, 8, 5, 0], "snr",
                  pool=pool)
            sweep("CFO sweep (Hz)", [0, 100, 300, 500, 700], "cfo",
                  pool=pool)
            sweep("phase sweep (deg)",
                  [0, 10, 30, 45, 60, 90, 135, 180, 270], "phase", pool=pool)

            # blind (no preamble) - documents what the tool can do with no
            # known reference, which is the realistic arbitrary-file case
            print("\n=== BLIND, no preamble (snr=20, cfo=0, phase=0) ===")
            bl = pool.map(_w_ber,
                          [(m, 20.0, 0.0, 0.0, 0) for m in MODS])
            for m, (ber, conf) in zip(MODS, bl):
                print(f"  {m:<8} ber={_fmt(ber)}  confidence={conf:.4f}")

            ok = snr_probe(pool=pool) and ok
            ok = amc_trial_decoding(pool=pool) and ok
            ok = coded_amc(pool=pool) and ok
            ok = fec_and_interleave(pool=pool) and ok
    finally:
        pool.shutdown()

    print(f"\n[wall clock: {time.perf_counter() - t_start:.1f}s]")
    print("NOMINAL DEMO CONFIG: " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
