import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const freqHz = parseFloat(searchParams.get('freq')) || 144800000;
  const sampleRate = parseInt(searchParams.get('rate'), 10) || 2048000;
  const numBins = 256;

  // Generate real-time synthetic RF spectrum data around tuned frequency
  const bins = new Float32Array(numBins);
  const noiseBase = -98.0;

  for (let i = 0; i < numBins; i++) {
    // AWGN noise floor
    bins[i] = noiseBase + (Math.random() - 0.5) * 6;
  }

  // Inject prominent RF carriers if within band
  // e.g. NOAA 137.100 MHz, CubeSat 437.525 MHz, DSN 2295.0 MHz
  const centerBin = Math.floor(numBins / 2);
  const signalPeak = -32.0;

  for (let k = -12; k <= 12; k++) {
    const shape = Math.exp(-((k / 6) ** 2));
    bins[centerBin + k] += (signalPeak - noiseBase) * shape;
  }

  // Intermittent harmonic or secondary carrier
  const secBin = centerBin + 45;
  if (secBin < numBins - 5) {
    for (let k = -4; k <= 4; k++) {
      bins[secBin + k] += 25 * Math.exp(-((k / 2) ** 2));
    }
  }

  return NextResponse.json({
    timestamp: Date.now(),
    freq: freqHz,
    sampleRate: sampleRate,
    rbw: Math.round(sampleRate / numBins),
    peakPowerDb: -32.4 + (Math.random() - 0.5) * 1.5,
    noiseFloorDb: -96.2 + (Math.random() - 0.5) * 2.0,
    snrDb: 63.8,
    bins: Array.from(bins.map(v => parseFloat(v.toFixed(1))))
  });
}
