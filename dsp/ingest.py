"""Signal ingest: raw .IQ / .wav captures -> complex baseband array.

Handles the real-world formats an analyst actually receives:
  .wav   -> RI/LR stereo (I on left, Q on right), or mono real IF
  .iq    -> headerless raw dump: complex64, complex128, or int16 I/Q

Nothing here guesses silently. If a headerless file cannot be read
without knowing sample format + rate, the error says exactly which
knobs are missing, so the GUI can prompt for them.
"""
from __future__ import annotations

import os
import numpy as np

DTYPES = {
    "complex64": np.complex64,
    "complex128": np.complex128,
    "int16": np.int16,
    "int8": np.int8,
    "uint8": np.uint8,
    "int32": np.int32,
    "float32": np.float32,
}

SAMPLE_FORMATS = [
    "complex64", "complex128",
    "int16-interleaved", "int8-interleaved",
    "int16-separate", "int16-real",
]

LAYOUT_HELP = (
    "interleaved  = [I0,Q0,I1,Q1,...]\n"
    "separate     = [I0,I1,...,I(N-1), Q0,Q1,...,Q(N-1)]"
)


class IngestError(ValueError):
    """Raised with actionable text when format/rate info is missing."""


def _parse(fmt: str) -> tuple:
    """'int16-interleaved' -> (np.int16, 'interleaved')"""
    for layout in ("interleaved", "separate", "real"):
        suffix = "-" + layout
        if fmt.endswith(suffix):
            return DTYPES[fmt[: -len(suffix)]], layout
    return DTYPES.get(fmt, None), None


def _raw_to_complex(a: np.ndarray, layout: str, width: int) -> np.ndarray:
    """Convert a raw ndarray to complex baseband according to layout."""
    if np.iscomplexobj(a):
        return a.astype(np.complex128)

    if layout == "interleaved":
        if a.size % 2:
            a = a[:-1]
        i = a[0::2].astype(np.float64)
        q = a[1::2].astype(np.float64)
    elif layout == "separate":
        n = a.size // 2
        if n == 0:
            raise IngestError("file too short for separate I/Q layout")
        i = a[:n].astype(np.float64)
        q = a[n:2 * n].astype(np.float64)
    elif layout == "real":
        i = a.astype(np.float64)
        q = np.zeros_like(i)
    else:
        raise IngestError(f"unknown layout '{layout}'\n{LAYOUT_HELP}")

    if width == 16:
        i /= 32768.0
        q /= 32768.0
    elif width == 8:
        i = (i - 127.5) / 127.5
        q = (q - 127.5) / 127.5
    elif width == 32:
        i /= 2147483648.0
        q /= 2147483648.0

    return i + 1j * q


def _normalize(x: np.ndarray) -> np.ndarray:
    """Remove DC offset and normalise to unit RMS power."""
    x = x - np.mean(x)
    rms = np.sqrt(np.mean(np.abs(x) ** 2))
    if rms > 0:
        x = x / rms
    return x


def read_iq(path: str, sample_format: str = None, fs: float = None) -> dict:
    """Read a headerless .IQ raw dump."""
    if not os.path.exists(path):
        raise IngestError(f"file not found: {path}")

    size = os.path.getsize(path)
    if size == 0:
        raise IngestError("file is empty")

    # Infer candidate formats by whether size divides cleanly.
    # `_parse` returns a numpy SCALAR TYPE (np.complex64), not a dtype
    # instance, and `.itemsize` on a scalar type is a getset_descriptor -
    # so it must be wrapped: np.dtype(dt).itemsize. Reading it straight off
    # the type raised TypeError here on EVERY .iq load, so the whole
    # headerless-raw path was dead.
    candidates = []
    for fmt in SAMPLE_FORMATS:
        dt, _ = _parse(fmt)
        width = np.dtype(dt).itemsize
        if size % width == 0:
            candidates.append((fmt, size // width))
    if not candidates:
        raise IngestError(
            "cannot interpret raw file: size is not a multiple of any "
            "known sample width\ntry specifying --format "
            + " | ".join(SAMPLE_FORMATS)
        )

    chosen = sample_format or "complex64"
    dt, layout = _parse(chosen)
    if dt is None:
        raise IngestError(
            f"unknown sample_format '{chosen}'\nvalid: " + " | ".join(SAMPLE_FORMATS)
        )

    width = np.dtype(dt).itemsize
    n = size // width
    if layout in ("separate", "interleaved"):
        n //= 2
    raw = np.fromfile(path, dtype=dt, count=n * (2 if layout in ("separate", "interleaved") else 1))

    if np.iscomplexobj(raw):
        bit_width = 64
    else:
        bit_width = width * 8
    x = _raw_to_complex(raw, layout, bit_width)

    if fs is None:
        raise IngestError(
            "raw .IQ files carry no sample-rate header.\n"
            "pass fs= to set the sample rate (e.g. fs=2.048e6)\n"
            f"candidates for this file: "
            + ", ".join(f"{f}({c} samples)" for f, c in candidates)
        )

    return {
        "samples": _normalize(x),
        "fs": float(fs),
        "source_format": chosen,
        "container": os.path.splitext(path)[1].lower().lstrip("."),
        "n_samples": int(x.size),
    }


def read_wav(path: str, layout: str = "stereo_iq") -> dict:
    """Read a .wav capture via scipy.io.wavfile (native header = real fs)."""
    from scipy.io import wavfile

    if not os.path.exists(path):
        raise IngestError(f"file not found: {path}")

    fs, data = wavfile.read(path)
    data = np.asarray(data)

    if data.ndim == 1:
        # Mono. Could be a real IF recording, or a single-channel
        # complex file that was saved incorrectly. Treat as real IF.
        x = _raw_to_complex(data, "real", np.dtype(data.dtype).itemsize * 8)
        note = "mono wav -> treated as real IF (Q=0)"
    elif data.shape[1] == 2:
        if layout == "stereo_iq":
            i = data[:, 0].astype(np.float64)
            q = data[:, 1].astype(np.float64)
        else:  # stereo_real = two antennas / two channels
            i = data[:, 0].astype(np.float64)
            q = data[:, 1].astype(np.float64)
        width = np.dtype(data.dtype).itemsize * 8
        if width == 16:
            i /= 32768.0
            q /= 32768.0
        elif width == 8:
            i = (i - 127.5) / 127.5
            q = (q - 127.5) / 127.5
        x = i + 1j * q
        note = "2-channel wav -> stereo I/Q"
    else:
        # N-channel: take first two as I/Q, ignore rest.
        i = data[:, 0].astype(np.float64)
        q = data[:, 1].astype(np.float64)
        x = i + 1j * q
        note = f"{data.shape[1]}-channel wav -> using channels 0,1 as I/Q"

    return {
        "samples": _normalize(x),
        "fs": float(fs),
        "source_format": f"wav_{np.dtype(data.dtype).name}_{data.shape[1]}ch",
        "container": "wav",
        "n_samples": int(x.size),
        "note": note,
    }


def load(path: str, sample_format: str = None, fs: float = None,
         wav_layout: str = "stereo_iq") -> dict:
    """Dispatch on extension. This is the only ingest entry point."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".wav":
        out = read_wav(path, layout=wav_layout)
    elif ext in (".iq", ".dat", ".bin", ".raw"):
        out = read_iq(path, sample_format=sample_format, fs=fs)
    else:
        raise IngestError(
            f"unsupported extension '{ext}'\n"
            "expected .wav / .iq / .dat / .bin / .raw"
        )
    out["path"] = path
    return out


def snr_db(x: np.ndarray, fs: float = None) -> float:
    """Blind SNR estimate: noise floor from out-of-band bins, signal from
    the band-integrated excess above that floor.

    For a narrowband signal in a wide sampled band (here Rs=1200 bps in a
    96 kHz span, so the signal is ~1-2% of the bins) the median of the
    periodogram is a clean noise-floor estimate, because the signal
    occupies too few bins to move a median.

        noise_total = median(P) * nbins
        signal_total = sum(P over the occupied band) - nband * median(P)

    SNR = signal_total / noise_total.

    THE TWO PREVIOUS VERSIONS WERE BOTH WRONG

    (a) `10*log10(peak_bin / median(P))` is not SNR. It is SNR plus
        10*log10(nbins / nband) - the extra bins of noise that the
        single peak bin is being compared against. With 320k total bins
        and ~4k signal bins that inflation is ~19 dB, which is why real
        20 dB captures reported 150 dB, and clean ones reported 300 dB
        (the floor fell through to the 1e-20 epsilon).

    (b) The constant-modulus moment estimator, SNR = 2*mu^2/var - 1,
        assumes |s| is constant. RRC pulse shaping leaves large envelope
        ripple, so var(|x|^2) is dominated by ISI rather than noise and it
        saturated near 5-9 dB regardless of the true SNR.

    `fs` is accepted and unused: the estimate is a power RATIO, so the
    sample rate cancels. It is kept in the signature so callers that
    already pass it do not have to change.

    Guards against the case this method cannot handle: if the "occupied
    band" is more than half the spectrum, the median is no longer
    noise-dominated and the estimate is not trustworthy, so it is refused
    rather than returned as a plausible-looking number.
    """
    x = np.asarray(x, dtype=np.complex128).ravel()
    n = x.size
    if n < 64:
        return 0.0

    edge = min(n // 20, 4096)
    if n - 2 * edge >= 64:
        x = x[edge: n - edge]
        n = x.size

    w = np.hanning(n)
    P = np.abs(np.fft.fft(x * w)) ** 2
    if P.max() <= 0:
        return 0.0

    floor = float(np.median(P))
    if floor <= 0.0:
        return 300.0

    # Occupied band = contiguous-ish set of bins clearly above the floor.
    thr = floor * 4.0
    band = P > thr
    nband = int(band.sum())
    if nband == 0:
        return 300.0
    if nband > 0.5 * n:
        # Median is contaminated by signal; this method does not apply.
        return float("nan")

    signal_total = float(P[band].sum() - nband * floor)
    noise_total = floor * n
    if signal_total <= 0.0:
        return 0.0
    return float(np.clip(10.0 * np.log10(signal_total / noise_total),
                        0.0, 300.0))