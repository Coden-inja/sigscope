You are debugging a software-defined-radio demodulation chain in Python (NumPy/SciPy/CommPy). I need you to identify the root cause of a specific bug and propose the textbook-correct fix. Please reason from DSP first principles rather than guessing.

# Problem statement (SIH26147)
Automated analysis of `.IQ` / `.wav` radio recordings: load file, show spectrum/constellation/waterfall, estimate symbol rate, classify modulation, demodulate to bits. Python DSP core + Next.js dashboard.

# What I have built
A synthetic signal generator (known ground truth) and a demodulator, plus a matched-filter + symbol-timing + slicer chain. Everything is deterministic and reproducible. Ground-truth symbol streams are available, so bugs are exactly measurable.

Test conditions: `fs=96000`, `Rs=1200` baud, `sps=fs/Rs=80`, `n_bits=3000`, `snr_db=20`, rolloff beta=0.35.

# Current results (measured, not estimated)
| modulation | symbol count | BER |
|---|---|---|
| BPSK  | 2999 | 0.0 |
| QPSK  | 1499 | 0.49  <-- BROKEN |
| 8PSK  | 999  | 0.0 |
| 16QAM | 749  | 0.000668 |
| 64QAM | 499  | 0.001336 |

Symbol counts are correct for all five, so the symbol-rate estimate and framing are right. Only QPSK fails, and it fails at ~chance level (0.49 ≈ random), which means a systematic phase/rotation error, not noise.

# Chain, in order
1. `generate()` → bits → Gray-coded M-PSK/M-QAM mapper → RRC pulse shape (span=8 symbols, beta=0.35) → add CFO=0, phase=0 → AWGN at 20 dB → normalize. Ground truth `frame_bits` and the exact transmitted symbol array are retained.
2. `demodulate()`:
   a. `coarse_cfo()` = CommPy `estimate_cfo_mth_power(x, fs, M)`
   b. `defo_correct()`
   c. Costas loop — **deliberately skipped for non-BPSK** (CommPy `costas_loop_bpsk` is BPSK-only; it rotated the QPSK constellation onto the real axis and took BER from 0.0 to 0.47)
   d. `matched_filter()` — same RRC, 2*span*sps+1 taps, unit peak, `np.convolve(mode="same")`
   e. timing recovery via Oerder–Meyr (below)
   f. `slice_psk` / `slice_qam` → bits

# The specific bug
Oerder–Meyr feedforward timing estimation, implemented as:

    tau_hat = -(T / (2*pi)) * arg{ sum_{k=0}^{L0-1} |x(k*Ts)|^2 * exp(-j*2*pi*k/N) }

with N = sps = 80 samples/symbol, L0 = number of symbols. I compute it as:

    e = |y[0 : L0*N]|^2
    e = e - e.mean()                      # remove DC
    S = sum_k e[k] * exp(-j*2*pi*k/N)     # single-bin DFT at symbol rate
    tau = -(N / (2*pi)) * angle(S)
    tau = float(tau % N)                  # wrap into [0, N)
    if tau >= N - 1e-9 or tau < 0: tau = 0.0
    return tau                            # in samples

Then symbols are sampled at instants `k*N + tau` with cubic (Catmull-Rom) interpolation, and normalized to unit RMS.

# Measured timing estimates (this is the key diagnostic)
| modulation | tau (samples) | dist(om) | dist(phase 0) |
|---|---|---|---|
| BPSK  | 0.0070  | 0.00020 | 0.00020 |
| QPSK  | 79.9981 | 1.96514 | 0.00027 |
| 8PSK  | 0.0200  | 0.00033 | 0.00033 |
| 16QAM | 0.0300  | 0.00038 | 0.00038 |
| 64QAM | 0.0500  | 0.00069 | 0.00070 |

`dist(...)` = mean squared error against the exact transmitted symbol array, after unit-RMS normalization.

# What this tells me
For BPSK, 8PSK, 16QAM, 64QAM the estimator returns tau ≈ 0 and the recovered symbols match the theoretical best to within 5e-4 — essentially perfect.

For QPSK it returns tau = 79.9981, which is *almost* N (one full symbol period). Since tau ≈ 0 and tau ≈ N are physically the same sampling instant modulo the symbol period, a naive `tau % N` should have mapped 79.9981 to ~79.9981 and produced a one-symbol misalignment — which is exactly consistent with the chance-level BER of 0.49 and the correct symbol *count* but garbage *content*.

So my working hypothesis: the QPSK energy-tone phase lands just on the wrong side of the branch cut, and the estimator needs to be made robust to a ~N-offset ambiguity.

# Questions I want answered
1. **Is my sign/branch-cut handling of the Oerder–Meyr estimator correct?** In particular: should I be normalizing the phase to the nearest multiple of N (i.e. `tau = ((tau + N/2) mod N) - N/2`) rather than `[0, N)`? And is the DC removal (`e - e.mean()`) legitimate here, or does it bias the phase for QPSK specifically?
2. **Why would QPSK specifically produce a phase near -0.002 instead of near 0, while BPSK/8PSK/16QAM/64QAM all land within 0.05 samples of zero?** QPSK is the only one of these that is simultaneously (a) constant-envelope AND (b) biphase, so its squared envelope `|x|^2` has a genuinely different harmonic structure from the others. Is there a known weakness of the Oerder–Meyr estimator for biphase/constant-envelope signals, e.g. a spectral null at the symbol rate that makes `arg(·)` ill-conditioned? If so, what is the standard remedy?
3. **Should I be using `|x|^2` at all, or is a data-independent envelope like `|x|` (not squared) preferred for this estimator?** Does the choice change biphase behaviour?
4. Is there a fundamentally more robust blind timing estimator I should switch to for this application — e.g. maximum-likelihood (Schneider & Philippou), Mueller & Muller, or a decision-directed early/late — and under what conditions is each preferred over Oerder–Meyr?
5. Is there a **sanity-check/validation gate** I can add so the tool can detect "this timing estimate is untrustworthy, abstain" rather than silently emitting garbage? This matters because the tool must classify arbitrary unknown recordings and must not confidently return wrong bits. A confidence/abstain mechanism is a hard requirement, not optional.

# Additional context on things I already ruled out
- CommPy `costas_loop_bpsk` is BPSK-specific and corrupts QPSK/8PSK/QAM (confirmed: BER 0.0 → 0.47 on clean QPSK). BPSK-only usage is correct.
- `scipy.signal.resample` on the narrowband signal folds the empty spectrum onto the passband and smears the constellation (envelope CV 0.0135 → 0.24). I low-pass to the occupied band before resampling now.
- Gardner's TED at 2 samples/symbol was unusable (mid-symbol tap deep in ISI, error term dominated by interference). Oerder–Meyr replaced it.
- Blind grid search over sampling phase with several "eye opening" cost metrics (envelope CV, radial 2-means bimodality, amplitude IQR, adjacent-symbol separation) all selected the wrong phase for 64QAM, because amplitude variance is not a valid eye metric when amplitude is part of the modulation.
- `slice_psk` and `slice_qam` are verified correct in isolation: given the exact transmitted symbol array, both return BER = 0.0 for QPSK, 16QAM and 64QAM.
- The RRC numerator must be `sin(pi*k*(1-beta)) + 4*beta*k*cos(pi*k*(1+beta))`. An earlier `pi*k*(1-beta)` typo inverted every symbol.

# Constraints
- Must stay blind/data-independent (no known symbols, no training set).
- Must work across BPSK/QPSK/8PSK/16QAM/64QAM with one code path.
- Python, NumPy/SciPy/CommPy only. No MATLAB, no GNU Radio.
- Must emit a confidence score and be able to abstain.

Please give me: (a) the correct interpretation of the near-N ambiguity and the minimal robust fix, (b) whether the biphase harmonic-null explanation is plausible and what the standard fix is if so, (c) any errors in my estimator as written, and (d) a concrete confidence/abstain gating strategy with a formula I can implement.
