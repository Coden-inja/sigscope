import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Pre-seeded intelligence reports
let REPORTS_STORE = [
  {
    id: 'REP-2026-0917-01',
    captureFile: 'capture_20260917_124530.iq',
    classification: 'TOP SECRET // SPACE-SIGINT',
    analyst: 'Analyst NTRO-145380',
    timestamp: '2026-09-17T12:45:30Z',
    status: 'Verified',
    frequency: '137.500 MHz (VHF)',
    sampleRate: '4.096 Msps',
    bandwidth: '1.024 MHz',
    modulation: 'QPSK',
    symbolRate: '512 ksps',
    fec: 'Convolutional (Viterbi r=1/2 K=7)',
    interleaving: 'Block (16x12)',
    snr: '18.4 dB',
    syncWord: '0xA5F3C7D2',
    payloadLength: '8,192 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '98.4%',
    notes: 'ISRO PSLV 3rd-stage telemetry downlink intercepted during orbital insertion burn. Signal decoded with 0 bit errors under Viterbi syndrome check.',
  },
  {
    id: 'REP-2026-0920-02',
    captureFile: 'cubesat_telemetry_beacon.iq',
    classification: 'SECRET // DEFENSE-SPACE',
    analyst: 'Analyst NTRO-145380',
    timestamp: '2026-09-20T04:18:12Z',
    status: 'Verified',
    frequency: '437.525 MHz (UHF)',
    sampleRate: '1.000 Msps',
    bandwidth: '250.0 kHz',
    modulation: 'BPSK',
    symbolRate: '9.6 ksps',
    fec: 'Reed-Solomon RS(255,223)',
    interleaving: 'Convolutional',
    snr: '14.2 dB',
    syncWord: '0x7E7E7E7E',
    payloadLength: '1,024 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '97.2%',
    notes: 'Foreign CubeSat beacon identified. AX.25 frame header decoded with satellite telemetry: Bus voltage 8.2V, Solar panel temp 24C.',
  },
  {
    id: 'REP-2026-0925-03',
    captureFile: 'hf_intercept_maritime.wav',
    classification: 'RESTRICTED // NAVAL',
    analyst: 'Analyst NTRO-145380',
    timestamp: '2026-09-25T19:02:44Z',
    status: 'Verified',
    frequency: '8.4145 MHz (HF)',
    sampleRate: '48.0 kHz',
    bandwidth: '3.00 kHz',
    modulation: '8PSK',
    symbolRate: '2.40 ksps',
    fec: 'Convolutional r=1/2 K=7',
    interleaving: 'Long Diagonal Block',
    snr: '12.8 dB',
    syncWord: '0xEB90EB90',
    payloadLength: '4,096 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '95.8%',
    notes: 'STANAG 4285 naval tactical communication intercept in Arabian Sea sector. Blind de-interleaver converged to 8x20 diagonal matrix.',
  },
  {
    id: 'REP-2026-1002-04',
    captureFile: 'deep_space_dsn_carrier.iq',
    classification: 'TOP SECRET // DEEP-SPACE',
    analyst: 'Analyst NTRO-145380',
    timestamp: '2026-10-02T22:15:09Z',
    status: 'Under Review',
    frequency: '2.295 GHz (S-Band)',
    sampleRate: '2.048 Msps',
    bandwidth: '600.0 kHz',
    modulation: '8PSK',
    symbolRate: '300.0 ksps',
    fec: 'LDPC r=1/2 (CCSDS)',
    interleaving: 'Block Matrix',
    snr: '9.6 dB',
    syncWord: '0x1ACFFC1D',
    payloadLength: '16,384 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '92.4%',
    notes: 'Deep Space exploratory probe transmission. Low SNR compensated by adaptive loop filter timing lock.',
  }
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const report = REPORTS_STORE.find(r => r.id === id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, report });
  }

  return NextResponse.json({ success: true, reports: REPORTS_STORE });
}

export async function POST(request) {
  try {
    const data = await request.json();
    const newReport = {
      id: `REP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(REPORTS_STORE.length + 1).padStart(2, '0')}`,
      timestamp: new Date().toISOString(),
      analyst: 'Analyst NTRO-145380',
      status: 'Verified',
      ...data
    };
    REPORTS_STORE.unshift(newReport);
    return NextResponse.json({ success: true, report: newReport });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
