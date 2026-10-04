'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { 
  Radio, Play, Pause, Volume2, VolumeX, Mic, MicOff, 
  RotateCcw, Sliders, Activity, Grip, Layers, Bookmark, 
  CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';

const SPACE_PRESETS = [
  { name: 'NOAA-19 Weather APT', freq: 137.100, mode: 'FM', bw: '34 kHz', desc: 'Polar orbit meteorological satellite imagery' },
  { name: 'LEO CubeSat AX.25', freq: 437.525, mode: 'BPSK', bw: '25 kHz', desc: 'Amateur packet telemetry beacon' },
  { name: 'Deep Space DSN S-Band', freq: 2295.000, mode: '8PSK', bw: '250 kHz', desc: 'Interplanetary exploration downlink' },
  { name: 'Neutral Hydrogen Line (HI)', freq: 1420.405, mode: 'CW', bw: '100 kHz', desc: 'Cosmic 21cm interstellar radiation emission' },
  { name: 'ISS VHF Crossband', freq: 145.800, mode: 'FM', bw: '15 kHz', desc: 'International Space Station voice repeater' },
  { name: 'Space Weather Beacon', freq: 14.100, mode: 'AM', bw: '6 kHz', desc: 'Ionospheric propagation solar observation beacon' }
];

export default function LiveSDRPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [inputSource, setInputSource] = useState('simulated'); // 'simulated' | 'mic'
  const [centerFreq, setCenterFreq] = useState(137.100);
  const [rfGain, setRfGain] = useState(38);
  const [bandwidthKhz, setBandwidthKhz] = useState(48);
  const [demodMode, setDemodMode] = useState('FM');
  const [audioMuted, setAudioMuted] = useState(true);
  const [audioVolume, setAudioVolume] = useState(0.4);
  const [sMeterDbm, setSMeterDbm] = useState(-68);

  const specCanvasRef = useRef(null);
  const wfCanvasRef = useRef(null);

  // Web Audio Context & Analyzer references
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const demodOscRef = useRef(null);
  const demodGainRef = useRef(null);
  const animFrameRef = useRef(null);

  // Initialize Web Audio for Audio Demodulator
  useEffect(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = demodMode === 'CW' ? 'sine' : demodMode === 'AM' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(audioMuted ? 0 : audioVolume * 0.1, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      demodOscRef.current = osc;
      demodGainRef.current = gain;
    } catch (e) {
      console.error('Audio init error:', e);
    }

    return () => {
      if (demodOscRef.current) {
        try { demodOscRef.current.stop(); } catch(e){}
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch(e){}
      }
    };
  }, []);

  // Sync Audio Volume / Mute
  useEffect(() => {
    if (demodGainRef.current && audioCtxRef.current) {
      const target = audioMuted ? 0 : audioVolume * 0.12;
      demodGainRef.current.gain.setValueAtTime(target, audioCtxRef.current.currentTime);
    }
  }, [audioMuted, audioVolume]);

  // Sync Demod Oscillator Type / Pitch based on Demod Mode & Center Frequency
  useEffect(() => {
    if (demodOscRef.current && audioCtxRef.current) {
      demodOscRef.current.type = demodMode === 'CW' ? 'sine' : demodMode === 'AM' ? 'sawtooth' : 'triangle';
      const basePitch = demodMode === 'CW' ? 700 : demodMode === 'BPSK' ? 1200 : 850;
      demodOscRef.current.frequency.setValueAtTime(basePitch, audioCtxRef.current.currentTime);
    }
  }, [demodMode]);

  // Toggle Physical Microphone Capture
  const toggleMicInput = async () => {
    if (inputSource === 'mic') {
      // Switch back to simulated
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      setInputSource('simulated');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;
        setInputSource('mic');
      } catch (err) {
        alert('Microphone access denied or unavailable. Continuing in Simulated Space SDR mode.');
        setInputSource('simulated');
      }
    }
  };

  // Waterfall Offscreen buffer for continuous 60fps scrolling
  const wfBufferRef = useRef(null);

  // Main SDR animation loop (Spectrum & Waterfall)
  useEffect(() => {
    const specC = specCanvasRef.current;
    const wfC = wfCanvasRef.current;
    if (!specC || !wfC) return;

    const specCtx = specC.getContext('2d');
    const wfCtx = wfC.getContext('2d');

    // Create / size offscreen waterfall buffer
    if (!wfBufferRef.current) {
      const off = document.createElement('canvas');
      off.width = 400;
      off.height = 200;
      wfBufferRef.current = off;
    }
    const off = wfBufferRef.current;
    const offCtx = off.getContext('2d');

    const numBins = 128;
    const spectrumData = new Float32Array(numBins);
    let frameCount = 0;

    const render = () => {
      if (!isRunning) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }
      frameCount++;

      const W_spec = specC.clientWidth || 600;
      const H_spec = specC.clientHeight || 160;
      if (specC.width !== W_spec || specC.height !== H_spec) {
        specC.width = W_spec;
        specC.height = H_spec;
      }

      const W_wf = wfC.clientWidth || 600;
      const H_wf = wfC.clientHeight || 200;
      if (wfC.width !== W_wf || wfC.height !== H_wf) {
        wfC.width = W_wf;
        wfC.height = H_wf;
      }
      if (off.width !== W_wf || off.height !== H_wf) {
        off.width = W_wf;
        off.height = H_wf;
        offCtx.fillStyle = '#0b0f17';
        offCtx.fillRect(0, 0, W_wf, H_wf);
      }

      // 1. Obtain FFT Data
      if (inputSource === 'mic' && analyserRef.current) {
        const byteData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(byteData);
        for (let i = 0; i < numBins; i++) {
          const raw = byteData[Math.floor(i * (byteData.length / numBins))];
          spectrumData[i] = -100 + (raw / 255) * 80;
        }
      } else {
        // Space RF SDR simulated carrier and noise
        const baseNoise = -95 + (rfGain / 50) * 12;
        const centerBin = Math.floor(numBins / 2);
        for (let i = 0; i < numBins; i++) {
          const noise = baseNoise + (Math.random() - 0.5) * 5;
          const dist = Math.abs(i - centerBin);
          const carrier = dist < 8 ? (40 - dist * 4) * Math.sin(frameCount * 0.05 + i * 0.2) : 0;
          spectrumData[i] = noise + Math.max(0, carrier);
        }
      }

      // Update S-Meter reading
      const peakVal = Math.max(...spectrumData);
      setSMeterDbm(parseFloat(peakVal.toFixed(1)));

      // 2. Draw Spectrum
      specCtx.fillStyle = '#ffffff';
      specCtx.fillRect(0, 0, W_spec, H_spec);

      // Grid
      specCtx.strokeStyle = '#e5e7eb';
      specCtx.lineWidth = 1;
      for (let y = 20; y < H_spec - 15; y += 30) {
        specCtx.beginPath();
        specCtx.moveTo(40, y);
        specCtx.lineTo(W_spec - 10, y);
        specCtx.stroke();
      }

      // Plot
      specCtx.beginPath();
      for (let i = 0; i < numBins; i++) {
        const x = 40 + (i / (numBins - 1)) * (W_spec - 50);
        const norm = (-spectrumData[i] - 15) / 95; // 0 to 1
        const y = Math.max(10, Math.min(H_spec - 15, norm * (H_spec - 25)));
        i === 0 ? specCtx.moveTo(x, y) : specCtx.lineTo(x, y);
      }
      specCtx.strokeStyle = '#1f9d6b';
      specCtx.lineWidth = 1.4;
      specCtx.stroke();

      specCtx.lineTo(W_spec - 10, H_spec - 15);
      specCtx.lineTo(40, H_spec - 15);
      specCtx.fillStyle = 'rgba(31, 157, 107, 0.1)';
      specCtx.fill();

      // Center line
      const midX = 40 + (W_spec - 50) / 2;
      specCtx.strokeStyle = '#ef4444';
      specCtx.setLineDash([3, 3]);
      specCtx.beginPath();
      specCtx.moveTo(midX, 5);
      specCtx.lineTo(midX, H_spec - 15);
      specCtx.stroke();
      specCtx.setLineDash([]);

      // 3. Scroll Waterfall downward
      // Shift previous image down by 2px using offscreen buffer
      offCtx.drawImage(off, 0, 0, W_wf, H_wf - 2, 0, 2, W_wf, H_wf - 2);

      // Draw top new 2px line
      for (let i = 0; i < numBins; i++) {
        const val = Math.max(0, Math.min(1, (spectrumData[i] + 95) / 65));
        const r = Math.floor(Math.max(0, Math.min(255, (1.5 - Math.abs(4 * val - 3)) * 255)));
        const g = Math.floor(Math.max(0, Math.min(255, (1.5 - Math.abs(4 * val - 2)) * 255)));
        const b = Math.floor(Math.max(0, Math.min(255, (1.5 - Math.abs(4 * val - 1)) * 255)));
        offCtx.fillStyle = `rgb(${r},${g},${b})`;
        const bx = (i / numBins) * W_wf;
        const bw = Math.ceil(W_wf / numBins) + 1;
        offCtx.fillRect(bx, 0, bw, 2);
      }

      // Copy buffer to visible canvas
      wfCtx.drawImage(off, 0, 0);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning, inputSource, rfGain]);

  // S-Meter calculation
  // S1 = -121 dBm, S9 = -73 dBm, S9+20dB = -53 dBm
  const sMeterUnits = (() => {
    if (sMeterDbm <= -121) return 'S0';
    if (sMeterDbm <= -115) return 'S1';
    if (sMeterDbm <= -109) return 'S2';
    if (sMeterDbm <= -103) return 'S3';
    if (sMeterDbm <= -97) return 'S4';
    if (sMeterDbm <= -91) return 'S5';
    if (sMeterDbm <= -85) return 'S6';
    if (sMeterDbm <= -79) return 'S7';
    if (sMeterDbm <= -73) return 'S8';
    if (sMeterDbm <= -63) return 'S9';
    if (sMeterDbm <= -53) return 'S9 +10dB';
    if (sMeterDbm <= -43) return 'S9 +20dB';
    return 'S9 +30dB';
  })();

  const sMeterPct = Math.max(5, Math.min(100, ((sMeterDbm + 125) / 85) * 100));

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="content-area">
        <Header subtitle="Real-Time SDR Receiver & Live Spectrum Monitoring" />

        <div className="main">
          {/* SDR Master Receiver Control Bar */}
          <div className="c fh" style={{ flexWrap: 'wrap' }}>
            <span className="fic"><Radio size={24} /></span>
            <div>
              <h2>RF SDR Receiver Deck</h2>
              <small>
                {inputSource === 'mic' ? 'Live Physical Audio Input (Browser Media)' : 'Local Space RF SDR Tuner (RTL-SDR / HackRF Emulation)'}
              </small>
            </div>
            <span className="sp" />

            {/* Input Source Toggle */}
            <button 
              className={`btn ${inputSource === 'mic' ? 'd' : ''}`}
              onClick={toggleMicInput}
              title="Toggle Live Audio In / Microphone"
            >
              {inputSource === 'mic' ? <Mic size={15} /> : <MicOff size={15} />}
              {inputSource === 'mic' ? 'Using Mic Audio In' : 'Switch to Real Mic'}
            </button>

            {/* Pause/Resume Live Streaming */}
            <button 
              className={`btn ${isRunning ? 'd' : ''}`}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? <Pause size={15} /> : <Play size={15} />}
              {isRunning ? 'Halt Stream' : 'Run SDR'}
            </button>

            {/* Audio Demodulation Listen Toggle */}
            <button 
              className="btn"
              onClick={() => setAudioMuted(!audioMuted)}
              style={{ color: audioMuted ? '#6b7280' : '#1f9d6b', borderColor: audioMuted ? '#e5e7eb' : '#1f9d6b' }}
            >
              {audioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {audioMuted ? 'Demod Audio: Muted' : 'Demod Audio: Playing'}
            </button>

            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioVolume}
              onChange={e => setAudioVolume(parseFloat(e.target.value))}
              className="audio-scrubber"
              style={{ width: 60 }}
              title="Volume"
            />
          </div>

          {/* Quick Space Frequency Bookmarks */}
          <div className="c" style={{ marginTop: 14, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bookmark size={15} color="#1f9d6b" />
                <b style={{ fontSize: 12 }}>Space Satellite Presets:</b>
              </div>
              {SPACE_PRESETS.map(p => (
                <button
                  key={p.name}
                  className="btn"
                  style={{ 
                    fontSize: 11, 
                    padding: '3px 9px', 
                    background: centerFreq === p.freq ? '#eef9f3' : '#fff',
                    borderColor: centerFreq === p.freq ? '#1f9d6b' : '#e2e5eb'
                  }}
                  onClick={() => {
                    setCenterFreq(p.freq);
                    setDemodMode(p.mode);
                  }}
                >
                  <b>{p.freq.toFixed(3)} MHz</b> <span style={{ color: '#6b7280' }}>({p.name.split(' ')[0]})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid">
            <div className="l">
              {/* Live Spectrum Canvas */}
              <div className="c">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>
                    <Activity size={16} /> Live Spectrum Analyzer
                  </h3>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6b7280' }}>
                    <span>Center: <b style={{ color: '#1f9d6b' }}>{centerFreq.toFixed(3)} MHz</b></span>
                    <span>Span: <b>{bandwidthKhz} kHz</b></span>
                    <span>Peak: <b>{sMeterDbm} dBm</b></span>
                  </div>
                </div>
                <canvas 
                  ref={specCanvasRef} 
                  style={{ width: '100%', height: 160, display: 'block', borderRadius: 4 }} 
                />
              </div>

              {/* Real-time Continuous Scrolling Waterfall */}
              <div className="c">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>
                    <Grip size={16} /> Continuous Waterfall Display
                  </h3>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Rate: 60 fps • Colormap: Jet</span>
                </div>
                <canvas 
                  ref={wfCanvasRef} 
                  style={{ width: '100%', height: 210, display: 'block', borderRadius: 4 }} 
                />
              </div>
            </div>

            {/* Right Column: Tuner Controls & S-Meter */}
            <div className="r">
              {/* S-Meter Card */}
              <div className="c">
                <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Signal Strength (S-Meter)</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <b style={{ fontSize: 18, color: '#1f2937' }}>{sMeterUnits}</b>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1f9d6b' }}>{sMeterDbm} dBm</span>
                </div>
                <div className="s-meter-container">
                  <div className="s-meter-fill" style={{ width: `${sMeterPct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#9ca3af' }}>
                  <span>S1</span>
                  <span>S3</span>
                  <span>S5</span>
                  <span>S7</span>
                  <span>S9</span>
                  <span>+20</span>
                  <span>+40</span>
                </div>
              </div>

              {/* Tuner Controls Deck */}
              <div className="c">
                <h3 style={{ fontSize: 14 }}>Tuner Parameters</h3>

                <div className="form-group">
                  <label className="form-label">Center Frequency (MHz):</label>
                  <input 
                    type="number"
                    step="0.005"
                    className="form-input"
                    value={centerFreq}
                    onChange={e => setCenterFreq(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0 }}>RF Gain (LNA):</label>
                    <b style={{ fontSize: 11 }}>{rfGain} dB</b>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="49"
                    value={rfGain}
                    onChange={e => setRfGain(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#1f9d6b' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bandwidth (Filter):</label>
                  <select 
                    className="form-select"
                    value={bandwidthKhz}
                    onChange={e => setBandwidthKhz(parseInt(e.target.value, 10))}
                  >
                    <option value="12">12 kHz (Narrow NFM/Voice)</option>
                    <option value="25">25 kHz (Standard Telemetry)</option>
                    <option value="48">48 kHz (WAV Sampled Baseband)</option>
                    <option value="150">150 kHz (Wideband Broadcast)</option>
                    <option value="250">250 kHz (CubeSat High-Speed)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Demodulation Scheme:</label>
                  <select 
                    className="form-select"
                    value={demodMode}
                    onChange={e => setDemodMode(e.target.value)}
                  >
                    <option value="FM">FM (Frequency Modulation)</option>
                    <option value="AM">AM (Amplitude Modulation)</option>
                    <option value="BPSK">BPSK (Phase Shift Keying)</option>
                    <option value="8PSK">8PSK (Deep Space Downlink)</option>
                    <option value="CW">CW (Continuous Wave Morse/Carrier)</option>
                  </select>
                </div>
              </div>

              {/* Receiver Health Status */}
              <div className="ok">
                <ShieldCheck size={26} color="#1f9d6b" style={{ flexShrink: 0 }} />
                <div>
                  <b style={{ fontSize: 12 }}>SDR Hardware Locked</b>
                  <small>Local DSP loop active. Sample clock stable within 0.5 ppm.</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
