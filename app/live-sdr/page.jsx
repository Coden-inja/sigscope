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
  { name: 'NOAA-19 Weather APT', short: 'NOAA-19', freq: 137.100, mode: 'FM', bw: '34 kHz', desc: 'Polar orbit meteorological satellite imagery' },
  { name: 'LEO CubeSat AX.25', short: 'CubeSat', freq: 437.525, mode: 'BPSK', bw: '25 kHz', desc: 'Amateur packet telemetry beacon' },
  { name: 'Deep Space DSN S-Band', short: 'DSN S-Band', freq: 2295.000, mode: '8PSK', bw: '250 kHz', desc: 'Interplanetary exploration downlink' },
  { name: 'Neutral Hydrogen Line (HI)', short: 'Hydrogen HI', freq: 1420.405, mode: 'CW', bw: '100 kHz', desc: 'Cosmic 21cm interstellar radiation emission' },
  { name: 'ISS VHF Crossband', short: 'ISS VHF', freq: 145.800, mode: 'FM', bw: '15 kHz', desc: 'International Space Station voice repeater' },
  { name: 'Space Weather Beacon', short: 'Space WX', freq: 14.100, mode: 'AM', bw: '6 kHz', desc: 'Ionospheric propagation solar observation beacon' }
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
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        analyserRef.current = analyser;
        setInputSource('mic');
      } catch (err) {
        console.warn('Microphone permission denied or device unavailable:', err);
      }
    }
  };

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
        offCtx.clearRect(0, 0, W_wf, H_wf);
        offCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
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

      // 2. Draw Spectrum on light frosted viewport
      specCtx.clearRect(0, 0, W_spec, H_spec);
      specCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      specCtx.fillRect(0, 0, W_spec, H_spec);

      // Faint dotted grid
      specCtx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      specCtx.lineWidth = 1;
      specCtx.setLineDash([2, 4]);
      for (let y = 20; y < H_spec - 15; y += 30) {
        specCtx.beginPath();
        specCtx.moveTo(40, y);
        specCtx.lineTo(W_spec - 10, y);
        specCtx.stroke();
      }
      specCtx.setLineDash([]);

      // Emerald Plot Line
      specCtx.beginPath();
      for (let i = 0; i < numBins; i++) {
        const x = 40 + (i / (numBins - 1)) * (W_spec - 50);
        const norm = (-spectrumData[i] - 15) / 95; // 0 to 1
        const y = Math.max(10, Math.min(H_spec - 15, norm * (H_spec - 25)));
        i === 0 ? specCtx.moveTo(x, y) : specCtx.lineTo(x, y);
      }
      specCtx.strokeStyle = '#16A34A';
      specCtx.lineWidth = 1.8;
      specCtx.stroke();

      specCtx.lineTo(W_spec - 10, H_spec - 15);
      specCtx.lineTo(40, H_spec - 15);
      specCtx.fillStyle = 'rgba(22, 163, 74, 0.15)';
      specCtx.fill();

      // Center marker line (subtle purple)
      const midX = 40 + (W_spec - 50) / 2;
      specCtx.strokeStyle = '#6D3AE8';
      specCtx.setLineDash([3, 3]);
      specCtx.beginPath();
      specCtx.moveTo(midX, 5);
      specCtx.lineTo(midX, H_spec - 15);
      specCtx.stroke();
      specCtx.setLineDash([]);

      // 3. Scroll Waterfall downward
      offCtx.drawImage(off, 0, 0, W_wf, H_wf - 2, 0, 2, W_wf, H_wf - 2);

      // Draw top new 2px line with dark purple to bright lime colormap
      for (let i = 0; i < numBins; i++) {
        const val = Math.max(0, Math.min(1, (spectrumData[i] + 95) / 65));
        let r, g, b;
        if (val < 0.5) {
          const t = val / 0.5;
          r = Math.round(15 + t * (109 - 15));
          g = Math.round(6 + t * (58 - 6));
          b = Math.round(28 + t * (232 - 28));
        } else {
          const t = (val - 0.5) / 0.5;
          r = Math.round(109 + t * (198 - 109));
          g = Math.round(58 + t * (244 - 58));
          b = Math.round(232 + t * (50 - 232));
        }
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
        <Header />

        <div className="main">
          {/* Page Title */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Live SDR</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 300, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Live SDR Receiver
            </h1>
          </div>

          {/* SDR Master Receiver Control Bar */}
          <div className="c fh" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
            <span className="fic" style={{ background: 'var(--bg-tile)', color: 'var(--accent-purple)', borderRadius: '50%', width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={22} />
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>RF SDR Receiver Deck</h2>
              <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {inputSource === 'mic' ? 'Live audio input (Browser media)' : 'Local RF tuner emulation (RTL-SDR / HackRF)'}
              </small>
            </div>
            <span className="sp" />

            {/* Input Source Toggle */}
            <button 
              type="button"
              id="mic-listen-toggle-btn"
              className={`pill-btn ${inputSource === 'mic' ? 'mic-active' : 'glass-btn'}`}
              onClick={toggleMicInput}
              title="Toggle Live Audio In / Microphone"
            >
              {inputSource === 'mic' ? <Mic size={15} color="var(--accent-lime)" /> : <MicOff size={15} />}
              {inputSource === 'mic' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-lime)', display: 'inline-block', boxShadow: '0 0 8px var(--accent-lime-glow)' }} />
                  <b>Listening</b>
                </span>
              ) : (
                'Microphone'
              )}
            </button>

            {/* Pause/Resume Live Streaming */}
            <button 
              type="button"
              className={`pill-btn ${!isRunning ? 'halt-active' : 'glass-btn'}`}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? <Pause size={15} /> : <Play size={15} />}
              {isRunning ? 'Halt Stream' : 'Run SDR'}
            </button>

            {/* Audio Demodulation Listen Toggle */}
            <button 
              type="button"
              className={`pill-btn ${!audioMuted ? 'audio-live-active' : 'glass-btn'}`}
              onClick={() => setAudioMuted(!audioMuted)}
              style={{ color: audioMuted ? 'var(--text-secondary)' : 'var(--accent-lime)' }}
            >
              {audioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {audioMuted ? 'Audio Muted' : 'Audio Live'}
            </button>

            <div className="vol-control" title={`Audio Volume: ${Math.round(audioVolume * 100)}%`}>
              <Volume2 size={13} color="var(--text-secondary)" />
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                onChange={e => setAudioVolume(parseFloat(e.target.value))}
                style={{ width: 75, accentColor: 'var(--accent-purple)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(audioVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Quick Space Frequency Bookmarks */}
          <div className="c" style={{ marginBottom: 16, padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bookmark size={15} color="var(--accent-purple)" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Space Presets:</span>
              </div>
              {SPACE_PRESETS.map(p => {
                const isSelected = centerFreq === p.freq;
                return (
                  <button
                    key={p.name}
                    type="button"
                    className={`preset-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setCenterFreq(p.freq);
                      setDemodMode(p.mode);
                    }}
                  >
                    <b>{p.freq.toFixed(3)} MHz</b>
                    <span style={{ opacity: 0.75, fontSize: 10.5 }}>({p.short || p.name.split(' ')[0]})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid">
            <div className="l">
              {/* Live Spectrum Canvas */}
              <div className="c">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color="var(--accent-lime)" /> Spectrum
                  </h3>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <span>Center: <b style={{ color: 'var(--text-main)' }}>{centerFreq.toFixed(3)} MHz</b></span>
                    <span>Span: <b style={{ color: 'var(--text-main)' }}>{bandwidthKhz} kHz</b></span>
                    <span>Peak: <b style={{ color: 'var(--accent-lime)' }}>{sMeterDbm} dBm</b></span>
                  </div>
                </div>
                <div className="cv-wrapper">
                  <canvas 
                    ref={specCanvasRef} 
                    style={{ width: '100%', height: 160, display: 'block' }} 
                  />
                </div>
              </div>

              {/* Real-time Continuous Scrolling Waterfall */}
              <div className="c">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Grip size={16} color="var(--accent-purple)" /> Waterfall
                  </h3>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>60 fps · Purple to Lime</span>
                </div>
                <div className="cv-wrapper">
                  <canvas 
                    ref={wfCanvasRef} 
                    style={{ width: '100%', height: 210, display: 'block' }} 
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Tuner Controls & S-Meter */}
            <div className="r">
              {/* S-Meter Card */}
              <div className="c">
                <h3 style={{ fontSize: 14, margin: '0 0 10px', color: 'var(--text-main)', fontWeight: 600 }}>Signal Strength (S-Meter)</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <b style={{ fontSize: 20, color: 'var(--text-main)', fontWeight: 400 }}>{sMeterUnits}</b>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-lime)' }}>{sMeterDbm} dBm</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-pill)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${sMeterPct}%`, height: '100%', background: 'linear-gradient(90deg, #6D3AE8 0%, #16A34A 100%)', borderRadius: 999, transition: 'width 0.1s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
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
                <h3 style={{ fontSize: 14, margin: '0 0 14px', color: 'var(--text-main)', fontWeight: 600 }}>Tuner Parameters</h3>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Center Frequency (MHz):</label>
                  <input 
                    type="number"
                    step="0.005"
                    className="form-input"
                    style={{ width: '100%' }}
                    value={centerFreq}
                    onChange={e => setCenterFreq(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>RF Gain (LNA):</label>
                    <b style={{ fontSize: 11.5, color: 'var(--text-main)' }}>{rfGain} dB</b>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="49"
                    value={rfGain}
                    onChange={e => setRfGain(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Bandwidth (Filter):</label>
                  <select 
                    className="sel"
                    style={{ width: '100%' }}
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
                  <label className="form-label" style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Demodulation Scheme:</label>
                  <select 
                    className="sel"
                    style={{ width: '100%' }}
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
              <div className="c" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldCheck size={24} color="var(--accent-lime)" style={{ flexShrink: 0 }} />
                <div>
                  <b style={{ fontSize: 12.5, color: 'var(--text-main)', display: 'block' }}>SDR Hardware Locked</b>
                  <small style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Local DSP loop active · Clock ±0.5 ppm</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
