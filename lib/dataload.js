// Loads real DSP output produced by scripts/analyze.py into public/runs.
//
// Nothing here fabricates signal data. If a run is missing a field the UI
// shows "n/a" rather than a plausible-looking placeholder - a demo that
// invents numbers is worse than one that admits a gap.

const IDX = '/runs/index.json';

export async function fetchIndex() {
  const r = await fetch(IDX, { cache: 'no-store' });
  if (!r.ok) throw new Error(`cannot load ${IDX} (${r.status}) - run: python scripts/analyze.py`);
  return r.json();
}

const cache = new Map();

export async function fetchRun(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  const r = await fetch(`/runs/${id}.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`cannot load run ${id} (${r.status})`);
  const j = await r.json();
  cache.set(id, j);
  return j;
}

export function cacheRun(id, run) {
  if (id && run) {
    cache.set(id, run);
  }
}

// ---- formatting -------------------------------------------------------

export const hz = v => {
  if (v == null || !isFinite(v)) return 'n/a';
  const a = Math.abs(v);
  return a >= 1e6 ? (v / 1e6).toFixed(3) + ' MHz'
    : a >= 1e3 ? (v / 1e3).toFixed(2) + ' kHz'
      : v.toFixed(0) + ' Hz';
};

export const pct = v => (v == null || !isFinite(v)) ? 'n/a' : (v * 100).toFixed(1) + '%';

export const ber = v => {
  if (v == null || !isFinite(v)) return 'n/a';
  if (v === 0) return '0';
  return v.toExponential(2);
};

export const nInt = v => (v == null || !isFinite(v)) ? 'n/a' : Math.round(v).toLocaleString('en-US');

// Confidence is null whenever the rotation class could not be pinned, so
// this renders 'withheld' rather than a misleading 0%.
export const conf = c => (c == null || !isFinite(c)) ? 'withheld' : (c * 100).toFixed(1) + '%';

// Build the byte array actually decoded, for the bitstream/hex/ascii views.
export function bitsToBytes(bits) {
  if (!bits || !bits.length) return [];
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] & 1);
    out.push(b);
  }
  return out;
}

export const bin = b => b.toString(2).padStart(8, '0');
export const hx = b => b.toString(16).padStart(2, '0').toUpperCase();
export const asc = b => (b > 31 && b < 127 ? String.fromCharCode(b) : '.');
