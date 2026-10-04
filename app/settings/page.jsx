'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { 
  Settings as SettingsIcon, Shield, Sliders, Cpu, 
  Lock, Save, RefreshCcw, CheckCircle2, Radio, HardDrive, Info
} from 'lucide-react';

const DEFAULT_CONFIG = {
  fftRadix: 'Radix-2 Cooley-Tukey (SciPy / NumPy FFT)',
  welchAverages: '8',
  cfoSearchRange: '100', // kHz
  confidenceThreshold: '85', // %
  autoDeinterleave: true,
  viterbiK7: true,
  reedSolomon223: true,
  ldpcEnabled: true,
  sdrDevice: 'RTL-SDR v4 (2832U R828D Tuner)',
  sampleRateNormalizer: 'Preserve Native Baseband Sample Rate',
  airGapEnforced: true,
  zeroizeMemoryOnExit: true,
  theme: 'Dark Professional'
};

export default function SettingsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [dspConfig, setDspConfig] = useState(DEFAULT_CONFIG);

  // Load configuration from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sigscope_dsp_config');
      if (saved) {
        setDspConfig(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not read config from localStorage', e);
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('sigscope_dsp_config', JSON.stringify(dspConfig));
    } catch (e) {}
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleReset = () => {
    setDspConfig(DEFAULT_CONFIG);
    try {
      localStorage.setItem('sigscope_dsp_config', JSON.stringify(DEFAULT_CONFIG));
    } catch (e) {}
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="content-area">
        <Header subtitle="System Configuration & DSP Pipeline Parameters" />

        <div className="main">
          {savedToast && (
            <div style={{ background: '#e3f6ec', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 16px', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <CheckCircle2 size={16} color="#1f9d6b" />
              <b>Configuration saved and persisted to local session profile.</b>
            </div>
          )}

          {/* Hackathon Problem Statement Banner */}
          <div className="c" style={{ background: 'linear-gradient(135deg, #14161a 0%, #1e2430 100%)', color: '#fff', border: '1px solid #2d333f', marginBottom: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="pill" style={{ background: 'rgba(31, 157, 107, 0.25)', color: '#34d399', fontSize: 10, padding: '2px 8px', marginBottom: 6 }}>
                  SMART INDIA HACKATHON 2026 • SPACE TECHNOLOGY
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 6px', color: '#f9fafb' }}>
                  SIH26147: Automated model for analysis of .IQ and .wav files along with signal parameter extraction
                </h2>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9ca3af', flexWrap: 'wrap' }}>
                  <span>Team ID: <b style={{ color: '#e5e7eb' }}>145380</b></span>
                  <span>Team Name: <b style={{ color: '#e5e7eb' }}>Toll Tax (TT)</b></span>
                  <span>Problem Sponsor: <b style={{ color: '#e5e7eb' }}>NTRO (National Technical Research Organisation)</b></span>
                  <span>Execution: <b style={{ color: '#34d399' }}>100% Offline Air-Gapped</b></span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="pill" style={{ background: '#1f9d6b', color: '#fff', fontWeight: 600, fontSize: 11 }}>
                  SIG-SCOPE v1.0 Production
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div className="grid">
              <div className="l">
                {/* DSP Core Engine Settings */}
                <div className="c">
                  <h3><Cpu size={16} /> DSP Pipeline Reference Parameters</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">FFT Algorithm Implementation:</label>
                      <select 
                        className="form-select"
                        value={dspConfig.fftRadix}
                        onChange={e => setDspConfig({ ...dspConfig, fftRadix: e.target.value })}
                      >
                        <option>Radix-2 Cooley-Tukey (SciPy / NumPy FFT)</option>
                        <option>Direct Discrete Fourier Transform</option>
                        <option>Chirp-Z Transform (Fine-Resolution Zoom)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Welch PSD Averaging Window Slices:</label>
                      <select 
                        className="form-select"
                        value={dspConfig.welchAverages}
                        onChange={e => setDspConfig({ ...dspConfig, welchAverages: e.target.value })}
                      >
                        <option value="4">4 Segments (High Speed)</option>
                        <option value="8">8 Segments (Balanced Variance)</option>
                        <option value="16">16 Segments (Smooth Spectral Density)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Carrier Frequency Offset (CFO) Search Band (±kHz):</label>
                      <input 
                        type="number"
                        className="form-input"
                        value={dspConfig.cfoSearchRange}
                        onChange={e => setDspConfig({ ...dspConfig, cfoSearchRange: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Sample Rate Normalizer Target:</label>
                      <select 
                        className="form-select"
                        value={dspConfig.sampleRateNormalizer}
                        onChange={e => setDspConfig({ ...dspConfig, sampleRateNormalizer: e.target.value })}
                      >
                        <option>Preserve Native Baseband Sample Rate</option>
                        <option>4.096 Msps (Standard VHF/UHF IQ)</option>
                        <option>2.048 Msps (Medium Bandwidth)</option>
                        <option>96.0 kHz (Audio Baseband WAV)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Blind Classifier & FEC Matrix */}
                <div className="c">
                  <h3><Sliders size={16} /> Modulation & FEC Candidate Settings</h3>
                  
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Confidence Acceptance Gate (Honesty Gate Threshold):
                      </label>
                      <b style={{ fontSize: 11, color: '#1f9d6b' }}>{dspConfig.confidenceThreshold}%</b>
                    </div>
                    <input 
                      type="range"
                      min="60"
                      max="98"
                      value={dspConfig.confidenceThreshold}
                      onChange={e => setDspConfig({ ...dspConfig, confidenceThreshold: e.target.value })}
                      style={{ width: '100%', accentColor: '#1f9d6b' }}
                    />
                    <small style={{ color: '#6b7280', fontSize: 10 }}>
                      Signals below this threshold engage the DSP Honesty Gate and are flagged as Ambiguous / Low-SNR instead of fabricating a classification.
                    </small>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={dspConfig.viterbiK7}
                        onChange={e => setDspConfig({ ...dspConfig, viterbiK7: e.target.checked })}
                      />
                      <span>Viterbi Decoder (Convolutional K=7 171,133)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={dspConfig.reedSolomon223}
                        onChange={e => setDspConfig({ ...dspConfig, reedSolomon223: e.target.checked })}
                      />
                      <span>Reed-Solomon RS(255,223) CCSDS Space Codec</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={dspConfig.ldpcEnabled}
                        onChange={e => setDspConfig({ ...dspConfig, ldpcEnabled: e.target.checked })}
                      />
                      <span>LDPC Syndrome Iteration Engine (n=648)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={dspConfig.autoDeinterleave}
                        onChange={e => setDspConfig({ ...dspConfig, autoDeinterleave: e.target.checked })}
                      />
                      <span>Automated Matrix Entropy De-Interleaver</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Air-Gap & Security Policy */}
              <div className="r">
                <div className="c">
                  <h3><Shield size={16} /> Host Isolation & Air-Gap Security Policy</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={dspConfig.airGapEnforced}
                        onChange={e => setDspConfig({ ...dspConfig, airGapEnforced: e.target.checked })}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <b>Enforce Strict Air-Gapped Execution</b>
                        <small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>
                          Blocks all outbound telemetry and restricts processing to local machine sandbox.
                        </small>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={dspConfig.zeroizeMemoryOnExit}
                        onChange={e => setDspConfig({ ...dspConfig, zeroizeMemoryOnExit: e.target.checked })}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <b>Purge Temporary Session Memory on Exit</b>
                        <small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>
                          Clears browser memory, session blobs, and temporary upload caches upon teardown.
                        </small>
                      </div>
                    </label>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Default SDR Interface:</span>
                    <select 
                      className="form-select"
                      style={{ marginTop: 4 }}
                      value={dspConfig.sdrDevice}
                      onChange={e => setDspConfig({ ...dspConfig, sdrDevice: e.target.value })}
                    >
                      <option>RTL-SDR v4 (2832U R828D Tuner)</option>
                      <option>HackRF One (1 MHz - 6 GHz)</option>
                      <option>LimeSDR USB (Full-Duplex MIMO)</option>
                      <option>Ettus USRP B210 (Direct USB 3.0)</option>
                      <option>Standard Soundcard (Line-In Baseband)</option>
                    </select>
                  </div>
                </div>

                <div className="c">
                  <h3 style={{ fontSize: 14 }}>Actions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button type="submit" className="btn d" style={{ justifyContent: 'center' }}>
                      <Save size={14} /> Save Configuration
                    </button>
                    <button type="button" className="btn" onClick={handleReset} style={{ justifyContent: 'center' }}>
                      <RefreshCcw size={14} /> Reset to Defaults
                    </button>
                  </div>
                </div>

                <div className="ok">
                  <Lock size={24} color="#1f9d6b" style={{ flexShrink: 0 }} />
                  <div>
                    <b style={{ fontSize: 12 }}>Localhost Air-Gapped Sandbox</b>
                    <small>Operating in isolated local process space with zero external cloud dependencies.</small>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
