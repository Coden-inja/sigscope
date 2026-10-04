import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SAMPLES = [
  {
    id: '0412',
    name: 'capture_20260917_124530.iq',
    description: 'VHF Deep Space Downlink Intercept (ISRO PSLV Telemetry)',
    format: 'Complex64 (IQ)',
    size: '256 MB',
    sampleRate: 4096000,
    sampleRateFormatted: '4.096 Msps',
    bandwidth: 1024000,
    bandwidthFormatted: '1.024 MHz',
    modulation: 'QPSK',
    symbolRate: 512000,
    symbolRateFormatted: '512 ksps',
    fec: 'Convolutional (Viterbi)',
    interleaving: 'Block (16x12)',
    snr: 18.4,
    syncWord: '0xA5F3C7D2',
    duration: '30.00 s',
    samples: 122880000,
    sourceBand: 'VHF (Estimated)'
  },
  {
    id: 'cubesat',
    name: 'cubesat_telemetry_beacon.iq',
    description: 'LEO CubeSat VHF/UHF Beacon (AX.25 Packet Protocol)',
    format: 'Complex64 (IQ)',
    size: '64 MB',
    sampleRate: 1000000,
    sampleRateFormatted: '1.000 Msps',
    bandwidth: 250000,
    bandwidthFormatted: '250.0 kHz',
    modulation: 'BPSK',
    symbolRate: 9600,
    symbolRateFormatted: '9.6 ksps',
    fec: 'Reed-Solomon RS(255,223)',
    interleaving: 'Convolutional',
    snr: 14.2,
    syncWord: '0x7E7E7E7E',
    duration: '64.00 s',
    samples: 64000000,
    sourceBand: 'UHF (437.5 MHz)'
  },
  {
    id: 'noaa',
    name: 'noaa_19_apt_weather.wav',
    description: 'NOAA-19 Polar Satellite APT Image Transmission (137.1 MHz)',
    format: '16-bit PCM WAV',
    size: '4.8 MB',
    sampleRate: 48000,
    sampleRateFormatted: '48.0 kHz',
    bandwidth: 34000,
    bandwidthFormatted: '34.0 kHz',
    modulation: '2-FSK / FM-AM',
    symbolRate: 4160,
    symbolRateFormatted: '4.16 ksps',
    fec: 'Uncoded Subcarrier',
    interleaving: 'None',
    snr: 21.0,
    syncWord: '0x0FF00FF0',
    duration: '50.00 s',
    samples: 2400000,
    sourceBand: 'VHF (137.100 MHz)'
  },
  {
    id: 'dsn',
    name: 'deep_space_dsn_carrier.iq',
    description: 'Deep Space Network S-Band Telemetry Intercept',
    format: 'Complex64 (IQ)',
    size: '128 MB',
    sampleRate: 2048000,
    sampleRateFormatted: '2.048 Msps',
    bandwidth: 600000,
    bandwidthFormatted: '600.0 kHz',
    modulation: '8PSK',
    symbolRate: 300000,
    symbolRateFormatted: '300.0 ksps',
    fec: 'LDPC r=1/2 (CCSDS)',
    interleaving: 'Block Matrix',
    snr: 9.6,
    syncWord: '0x1ACFFC1D',
    duration: '31.25 s',
    samples: 64000000,
    sourceBand: 'S-Band (2.295 GHz)'
  },
  {
    id: 'hf',
    name: 'hf_intercept_maritime.wav',
    description: 'HF Maritime STANAG 4285 Secure Naval Data Link',
    format: 'Stereo IQ WAV',
    size: '11.4 MB',
    sampleRate: 48000,
    sampleRateFormatted: '48.0 kHz',
    bandwidth: 3000,
    bandwidthFormatted: '3.00 kHz',
    modulation: '8PSK',
    symbolRate: 2400,
    symbolRateFormatted: '2.40 ksps',
    fec: 'Convolutional r=1/2 K=7',
    interleaving: 'Long Diagonal Block',
    snr: 12.8,
    syncWord: '0xEB90EB90',
    duration: '118.75 s',
    samples: 5700000,
    sourceBand: 'HF (8.414 MHz)'
  }
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const found = SAMPLES.find(s => s.id === id);
    if (!found) {
      return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, sample: found });
  }

  return NextResponse.json({ success: true, samples: SAMPLES });
}
