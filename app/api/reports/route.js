import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Pre-seeded benchmark intelligence and telemetry reports
let REPORTS_STORE = [
  {
    id: 'BENCH-2026-QPSK-01',
    captureFile: 'fmt_stereo_wav_qpsk.wav',
    classification: 'VERIFIED // AIR-CAPTURE',
    analyst: 'DSP Testbench Rig #01',
    timestamp: '2026-10-04T12:33:24Z',
    status: 'Verified',
    frequency: '137.500 MHz (VHF)',
    sampleRate: '96.000 kHz',
    bandwidth: '1.448 kHz',
    modulation: 'QPSK',
    symbolRate: '1200.0 Bd',
    fec: 'Convolutional (Viterbi r=1/2 K=7)',
    interleaving: 'Block (16x12)',
    snr: '21.8 dB',
    syncWord: '0xA5F3C7D2',
    payloadLength: '8,192 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '98.4%',
    notes: 'Real-world VHF RF capture. Cumulant AMC confirmed QPSK (C42 = -1.02); Gardner TED locked timing at 80 sps. Frame preamble 0xA5F3C7D2 aligned with zero bit errors.',
  },
  {
    id: 'BENCH-2026-BPSK-02',
    captureFile: 'bpsk_20.iq',
    classification: 'BENCHMARK // SNR-20dB',
    analyst: 'DSP Testbench Rig #01',
    timestamp: '2026-10-04T12:33:24Z',
    status: 'Verified',
    frequency: '437.525 MHz (UHF)',
    sampleRate: '96.000 kHz',
    bandwidth: '1.396 kHz',
    modulation: 'BPSK',
    symbolRate: '1200.0 Bd',
    fec: 'Reed-Solomon RS(255,223)',
    interleaving: 'Convolutional',
    snr: '20.0 dB',
    syncWord: '0x7E7E7E7E',
    payloadLength: '2,048 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '99.5%',
    notes: 'Standard BPSK test vector under 20.0 dB SNR. Zero bit errors (BER=0.0). Higher-Order Cumulant C42 converged to real axis with zero rotational ambiguity.',
  },
  {
    id: 'BENCH-2026-16QAM-03',
    captureFile: '16qam_20.iq',
    classification: 'BENCHMARK // HIGH-ORDER',
    analyst: 'DSP Testbench Rig #01',
    timestamp: '2026-10-04T12:33:24Z',
    status: 'Verified',
    frequency: '2.412 GHz (S-Band)',
    sampleRate: '96.000 kHz',
    bandwidth: '1.382 kHz',
    modulation: '16-QAM',
    symbolRate: '1200.0 Bd',
    fec: 'Trellis Coded (TCM)',
    interleaving: 'Rectangular Matrix',
    snr: '20.0 dB',
    syncWord: '0x3D5E7A1F',
    payloadLength: '4,096 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '99.1%',
    notes: 'Square 16-QAM constellation. Radial clustering algorithm locked constellation rings; constellation EVM measured at 4.2% with verified constellation slicing.',
  },
  {
    id: 'BENCH-2026-CFO-04',
    captureFile: 'qpsk_cfo300.iq',
    classification: 'STRESS-TEST // DOPPLER-CFO',
    analyst: 'DSP Testbench Rig #02',
    timestamp: '2026-10-04T12:33:24Z',
    status: 'Verified',
    frequency: '8.4145 MHz (HF)',
    sampleRate: '96.000 kHz',
    bandwidth: '1.395 kHz',
    modulation: 'QPSK (CFO: +300Hz)',
    symbolRate: '1200.0 Bd',
    fec: 'Convolutional r=1/2 K=7',
    interleaving: 'Diagonal Matrix',
    snr: '20.0 dB',
    syncWord: '0xA5F3C7D2',
    payloadLength: '4,096 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '97.5%',
    notes: 'High Doppler carrier offset stress vector. 4th-power FFT coarse CFO estimator detected +300.1 Hz; closed-loop Costas PLL maintained 0-degree phase lock.',
  },
  {
    id: 'BENCH-2026-FEC-05',
    captureFile: 'fec_block4x4.iq',
    classification: 'BENCHMARK // DE-INTERLEAVE',
    analyst: 'DSP Testbench Rig #02',
    timestamp: '2026-10-04T12:33:24Z',
    status: 'Verified',
    frequency: '144.390 MHz (VHF)',
    sampleRate: '96.000 kHz',
    bandwidth: '1.442 kHz',
    modulation: 'QPSK',
    symbolRate: '1200.0 Bd',
    fec: 'Viterbi + Block Interleaver',
    interleaving: 'Block (4x4)',
    snr: '18.0 dB',
    syncWord: '0x1ACFFC1D',
    payloadLength: '3,000 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '98.8%',
    notes: 'Convolutional FEC with 4x4 matrix interleaver. Blind periodicity estimator detected 16-bit span; de-interleaver successfully reconstructed frame syndrome.',
  },
  {
    id: 'BENCH-2026-8PSK-06',
    captureFile: '8psk_20.iq',
    classification: 'BENCHMARK // 8-ARY-PHASE',
    analyst: 'DSP Testbench Rig #01',
    timestamp: '2026-10-04T12:33:24Z',
    status: 'Verified',
    frequency: '435.100 MHz (UHF)',
    sampleRate: '96.000 kHz',
    bandwidth: '1.386 kHz',
    modulation: '8PSK',
    symbolRate: '1200.0 Bd',
    fec: 'LDPC r=2/3',
    interleaving: 'Cyclic Permutation',
    snr: '20.0 dB',
    syncWord: '0xEB90EB90',
    payloadLength: '5,120 bytes',
    crcStatus: 'Valid (Pass)',
    confidenceOverall: '96.4%',
    notes: '8-ary PSK phase constellation. Circular 8th-order phase detector recovered 45-degree constellation spacing; zero phase slips detected across observation window.',
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
