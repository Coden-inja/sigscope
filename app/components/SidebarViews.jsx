'use client';
import { useState } from 'react';
import { 
  FileText, Activity, Grip, ShieldCheck, LayoutGrid, Link2, 
  CheckCircle2, AlertTriangle, Cpu, Shield, BookOpen, Layers, 
  Terminal, Lock, Zap, Database, Server, RefreshCw, BarChart2
} from 'lucide-react';

export function DocumentationView() {
  return (
    <div style={{ padding: '24px', maxWidth: 1060, margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Header Banner */}
      <div style={{ borderBottom: '1px solid var(--border-hairline)', paddingBottom: 20, marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(109, 58, 232, 0.12)', color: 'var(--accent-purple)', borderRadius: 999, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
          <Shield size={13} /> Mathematical Specification
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
          Deterministic Signal Reconstruction
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: 840 }}>
          Deterministic signal intelligence and blind demodulation based on physical RF principles, cyclic statistics, and statistical moments.
        </p>
      </div>

      {/* Comparison Grid: AI vs Deterministic DSP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div className="c" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
            <AlertTriangle size={16} /> Deep Learning Limitations
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Convolutional neural networks frequently hallucinate high-confidence classifications on out-of-distribution noise, require heavy GPU compute, and cannot provide verifiable physical explanations.
          </p>
        </div>

        <div className="c" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-lime)', fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
            <CheckCircle2 size={16} /> Deterministic Pipeline
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Every parameter derivation is mathematically verifiable. When ambiguity exists, the Honesty Gate explicitly withholds confidence rather than fabricating measurements.
          </p>
        </div>
      </div>

      {/* Section 1: Parameter Estimation */}
      <div className="c" style={{ marginBottom: 24, padding: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px 0' }}>
          <span style={{ width: 24, height: 24, borderRadius: 999, background: 'var(--bg-tile)', color: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>1</span>
          Blind Symbol Rate &amp; Bandwidth Estimation
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
          Nonlinear spectral-line extraction reveals discrete spectral spikes corresponding to the symbol rate Rs across multiple nonlinear orders:
        </p>

        {/* Formula Box */}
        <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-hairline)', padding: '16px 20px', borderRadius: 16, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, marginBottom: 14, color: '#C6F432' }}>
          <span style={{ color: '#8B5CF6' }}>S_k(f)</span> = FFT(|x(t)|^k), where k ∈ &#123;2, 4, 8&#125;<br />
          <span style={{ color: '#35C9FF' }}>R_s</span> = arg max |S_k(f)| → Snap integer SPS = round(fs / Rs)
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Occupied Bandwidth is calculated using the 99% cumulative energy threshold of Welch&apos;s power spectral density.
        </p>
      </div>

      {/* Section 2: Higher Order Cumulants */}
      <div className="c" style={{ marginBottom: 24, padding: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px 0' }}>
          <span style={{ width: 24, height: 24, borderRadius: 999, background: 'var(--bg-tile)', color: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>2</span>
          Higher-Order Cumulants (HOCS) Modulation Classification
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
          4th and 6th-order cumulants of zero-mean normalized baseband samples are theoretically invariant to additive white Gaussian noise:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-hairline)', padding: '14px 18px', borderRadius: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#FFFFFF' }}>
            <div style={{ color: '#8B5CF6', fontSize: 11, marginBottom: 4 }}>Fourth-Order Cumulant (C42)</div>
            C42 = Cum(x, x, x*, x*)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;= E[|x|^4] - |E[x^2]|^2 - 2·E[|x|^2]^2
          </div>

          <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-hairline)', padding: '14px 18px', borderRadius: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C6F432' }}>
            <div style={{ color: '#C6F432', fontSize: 11, marginBottom: 4 }}>Sixth-Order Cumulant (C63)</div>
            C63 = Cum(x, x, x, x*, x*, x*)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;= E[|x|^6] - 9·E[|x|^4]·E[|x|^2] + 12·E[|x|^2]^3
          </div>
        </div>

        {/* Modulation Decision Table */}
        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tile)', color: 'var(--text-main)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Modulation Scheme</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>|C40|</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>|C42|</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>C63</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Decision Boundary</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-main)' }}>BPSK</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>2.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>-2.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>16.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--accent-lime)' }}>|C40| &gt; 1.50</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-main)' }}>QPSK</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>0.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>-1.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>4.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--accent-lime)' }}>|C40| ≈ 0 &amp; C42 ≈ -1.0</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-main)' }}>8PSK</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>0.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>0.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>0.00</td>
                <td style={{ padding: '10px 16px', color: 'var(--accent-lime)' }}>C42 ≈ 0 &amp; Phase histogram</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-main)' }}>16QAM</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>0.68</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>-0.68</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>2.08</td>
                <td style={{ padding: '10px 16px', color: 'var(--accent-lime)' }}>C42 ∈ [-0.85, -0.50]</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DspPipelineView() {
  return (
    <div style={{ padding: '24px', maxWidth: 1060, margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-hairline)', paddingBottom: 20, marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(109, 58, 232, 0.12)', color: 'var(--accent-purple)', borderRadius: 999, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
          <Cpu size={13} /> Python DSP Core
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
          DSP Mathematical Pipeline
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: 840 }}>
          Modular 6-stage offline DSP architecture executing physical signal transformations.
        </p>
      </div>

      {/* High-Resolution SVG Architecture Flowchart with Purple lines and Lime highlights */}
      <div className="c" style={{ padding: '28px 24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-hairline)', paddingBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--accent-lime)" /> Execution Flowchart
          </span>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#6D3AE8' }} /> Ingest &amp; Spectral</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#16A34A' }} /> Pure DSP</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#D97706' }} /> Honesty Gate</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#8B5CF6' }} /> Client UI</span>
          </div>
        </div>

        {/* SVG Flowchart */}
        <svg viewBox="0 0 980 440" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <marker id="arrowPurple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6D3AE8" />
            </marker>
            <marker id="arrowLime" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#16A34A" />
            </marker>
            <marker id="arrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
            </marker>
          </defs>

          {/* Connectors */}
          <line x1="160" y1="80" x2="220" y2="80" stroke="#6D3AE8" strokeWidth="2" markerEnd="url(#arrowPurple)" />
          <line x1="380" y1="80" x2="440" y2="80" stroke="#6D3AE8" strokeWidth="2" markerEnd="url(#arrowPurple)" />
          <line x1="600" y1="80" x2="660" y2="80" stroke="#6D3AE8" strokeWidth="2" markerEnd="url(#arrowPurple)" />
          
          {/* Decision Branch */}
          <line x1="770" y1="120" x2="770" y2="180" stroke="#16A34A" strokeWidth="2" markerEnd="url(#arrowLime)" />
          <line x1="880" y1="80" x2="920" y2="80" stroke="#D97706" strokeWidth="2" />
          <line x1="920" y1="80" x2="920" y2="300" stroke="#D97706" strokeWidth="2" />
          <line x1="920" y1="300" x2="880" y2="300" stroke="#D97706" strokeWidth="2" markerEnd="url(#arrowAmber)" />

          {/* Row 2 */}
          <line x1="660" y1="220" x2="600" y2="220" stroke="#6D3AE8" strokeWidth="2" markerEnd="url(#arrowPurple)" />
          <line x1="380" y1="220" x2="320" y2="220" stroke="#6D3AE8" strokeWidth="2" markerEnd="url(#arrowPurple)" />

          {/* To Client */}
          <line x1="220" y1="260" x2="220" y2="320" stroke="#8B5CF6" strokeWidth="2" markerEnd="url(#arrowPurple)" />
          <line x1="330" y1="360" x2="400" y2="360" stroke="#8B5CF6" strokeWidth="2" markerEnd="url(#arrowPurple)" />
          <line x1="560" y1="360" x2="620" y2="360" stroke="#8B5CF6" strokeWidth="2" markerEnd="url(#arrowPurple)" />

          {/* Nodes */}
          {/* 1. Raw Ingest */}
          <rect x="20" y="45" width="140" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#6D3AE8" strokeWidth="1.5" />
          <text x="90" y="75" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">1. RAW RF INGEST</text>
          <text x="90" y="95" fill="#64748B" fontSize="11" textAnchor="middle">.iq / .wav / Complex64</text>

          {/* 2. Characterization */}
          <rect x="220" y="45" width="160" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#16A34A" strokeWidth="1.5" />
          <text x="300" y="75" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">2. CHARACTERIZATION</text>
          <text x="300" y="95" fill="#64748B" fontSize="11" textAnchor="middle">Welch PSD &amp; 99% OBW</text>

          {/* 3. Parameter Estimation */}
          <rect x="440" y="45" width="160" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#6D3AE8" strokeWidth="1.5" />
          <text x="520" y="75" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">3. PARAMETER ESTIMATION</text>
          <text x="520" y="95" fill="#64748B" fontSize="11" textAnchor="middle">Spectral Line Rs &amp; HOCS</text>

          {/* Decision: Honesty Gate */}
          <polygon points="770,40 880,80 770,120 660,80" fill="rgba(255, 255, 255, 0.9)" stroke="#D97706" strokeWidth="1.5" />
          <text x="770" y="77" fill="#D97706" fontSize="11" fontWeight="700" textAnchor="middle">HONESTY GATE</text>
          <text x="770" y="92" fill="#475569" fontSize="10" textAnchor="middle">Margin &gt; 0.10?</text>

          {/* Abstention Branch */}
          <rect x="740" y="270" width="140" height="60" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#DC2626" strokeWidth="1.5" />
          <text x="810" y="295" fill="#DC2626" fontSize="11" fontWeight="600" textAnchor="middle">ABSTAIN / WITHHOLD</text>
          <text x="810" y="313" fill="#64748B" fontSize="10" textAnchor="middle">Report exact reason</text>

          {/* 4. Carrier & Timing Recovery */}
          <rect x="660" y="185" width="160" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#16A34A" strokeWidth="1.5" />
          <text x="740" y="215" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">4. SYNCHRONIZATION</text>
          <text x="740" y="235" fill="#64748B" fontSize="11" textAnchor="middle">M-th CFO &amp; Oerder-Meyr</text>

          {/* 5. FEC & De-Interleave */}
          <rect x="440" y="185" width="160" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#6D3AE8" strokeWidth="1.5" />
          <text x="520" y="215" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">5. FEC / VITERBI</text>
          <text x="520" y="235" fill="#64748B" fontSize="11" textAnchor="middle">Trellis Search</text>

          {/* 6. Static Serialization */}
          <rect x="120" y="185" width="200" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="220" y="215" fill="#6D3AE8" fontSize="12" fontWeight="600" textAnchor="middle">6. STATIC SERIALIZATION</text>
          <text x="220" y="235" fill="#64748B" fontSize="11" textAnchor="middle">Immutable JSON Telemetry</text>

          {/* Presentation Layer */}
          <rect x="120" y="325" width="210" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#64748B" strokeWidth="1.5" />
          <text x="225" y="355" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">NEXT.JS 15 CLIENT</text>
          <text x="225" y="375" fill="#64748B" fontSize="11" textAnchor="middle">Decoupled UI Engine</text>

          <rect x="400" y="325" width="160" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#16A34A" strokeWidth="1.5" />
          <text x="480" y="355" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">CANVAS VIZ ENGINE</text>
          <text x="480" y="375" fill="#64748B" fontSize="11" textAnchor="middle">Spectrum, Waterfall, Eye</text>

          <rect x="620" y="325" width="160" height="70" rx="14" fill="rgba(255, 255, 255, 0.85)" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="700" y="355" fill="#0F172A" fontSize="12" fontWeight="600" textAnchor="middle">FORENSIC BITSTREAM</text>
          <text x="700" y="375" fill="#64748B" fontSize="11" textAnchor="middle">Binary, Hex, ASCII</text>
        </svg>
      </div>

      {/* Stage Breakdown Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          {
            num: 1, title: 'Raw Ingest & RF Conditioning',
            tags: ['Complex64', 'DC-Offset Suppress', 'RMS AGC'],
            desc: 'Parses binary IQ captures or stereo/mono audio WAV files into normalized NumPy complex64 arrays. Suppresses DC bias spikes caused by local oscillator leakage.'
          },
          {
            num: 2, title: 'Spectral Characterization & Occupied Bandwidth',
            tags: ['Welch PSD', '-3dB Cutoff', '99% OBW'],
            desc: 'Computes periodogram (FFT 2048, 50% overlap). Determines the precise -3dB bandwidth boundaries and integrates cumulative energy for the 99% Occupied Bandwidth.'
          },
          {
            num: 3, title: 'Parameter Estimation & Blind AMC',
            tags: ['x^k Spectral Line', 'Cumulants C42/C63', 'Honesty Gate'],
            desc: 'Passes baseband data through nonlinear transformations to reveal discrete spectral spikes for symbol rate Rs. Higher-order cumulants classify modulation. If margin is under 0.10, the Honesty Gate withholds confidence.'
          },
          {
            num: 4, title: 'Carrier Frequency Offset & Timing Recovery',
            tags: ['M-th Power CFO', 'Oerder-Meyr TED'],
            desc: 'Coarse and fine CFO are estimated via M-th power FFT and removed via complex frequency shift. Oerder-Meyr timing error detector calculates fractional delay.'
          },
          {
            num: 5, title: 'FEC Trellis Decoding & De-Interleaving',
            tags: ['CommPy Viterbi', 'Rate 1/2', 'Joint Rotation Search'],
            desc: 'A joint hypothesis search is run through a Viterbi decoder across 4 rotation states (0°, 90°, 180°, 270°) and rectangular interleaver permutations.'
          },
          {
            num: 6, title: 'Preamble Lock & Bitstream Serialization',
            tags: ['Barker Sync', 'BER Validation', 'Immutable JSON'],
            desc: 'Correlates the output stream against known preambles to pin absolute quadrant phase. Telemetry and decoded bits are written to immutable JSON files.'
          }
        ].map(s => (
          <div key={s.num} className="c" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--bg-tile)', color: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{s.num}</span>
                {s.title}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {s.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, background: 'var(--bg-tile)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 999, fontFamily: 'var(--font-mono)' }}>{t}</span>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArchitectureView() {
  return (
    <div style={{ padding: '24px', maxWidth: 1060, margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-hairline)', paddingBottom: 20, marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(22, 163, 74, 0.12)', color: 'var(--accent-lime)', borderRadius: 999, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
          <ShieldCheck size={13} /> Air-Gapped Deployment
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
          Space &amp; Edge Architecture
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: 840 }}>
          Decoupled hybrid stack designed for edge signal processing in disconnected, air-gapped environments.
        </p>
      </div>

      {/* SVG Decoupled System Diagram with Air-Gap Boundary Visible */}
      <div className="c" style={{ padding: '28px 24px', marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 20, borderBottom: '1px solid var(--border-hairline)', paddingBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={16} color="var(--accent-purple)" /> Decoupled Edge Compute &amp; Client Presentation
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent-lime)', background: 'rgba(22, 163, 74, 0.12)', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
            <Lock size={12} /> Air-Gap Boundary Active
          </span>
        </div>

        <svg viewBox="0 0 920 300" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <marker id="archArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6D3AE8" />
            </marker>
          </defs>

          {/* Air-Gap Boundary Box */}
          <rect x="5" y="25" width="700" height="250" rx="18" fill="none" stroke="#6D3AE8" strokeWidth="1.8" strokeDasharray="6 6" />
          <text x="20" y="45" fill="#6D3AE8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">SECURE AIR-GAPPED ENVIRONMENT</text>

          {/* Connectors */}
          <line x1="200" y1="140" x2="260" y2="140" stroke="#6D3AE8" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#archArrow)" />
          <line x1="470" y1="140" x2="530" y2="140" stroke="#6D3AE8" strokeWidth="2" markerEnd="url(#archArrow)" />
          <line x1="680" y1="140" x2="740" y2="140" stroke="#16A34A" strokeWidth="2" markerEnd="url(#archArrow)" />

          {/* Box 1: RF Hardware */}
          <rect x="20" y="70" width="180" height="140" rx="16" fill="rgba(255, 255, 255, 0.85)" stroke="#334155" strokeWidth="1.5" />
          <text x="110" y="105" fill="#64748B" fontSize="11" fontWeight="600" textAnchor="middle">RF SENSORS &amp; SDR</text>
          <text x="110" y="130" fill="#0F172A" fontSize="13" fontWeight="600" textAnchor="middle">Raw Ingestion</text>
          <text x="110" y="155" fill="#64748B" fontSize="11" textAnchor="middle">HackRF / RTL-SDR / WAV</text>
          <text x="110" y="175" fill="#94A3B8" fontSize="10" textAnchor="middle">Complex64 Binary Dump</text>

          {/* Box 2: Python DSP Backend */}
          <rect x="260" y="50" width="210" height="180" rx="16" fill="rgba(255, 255, 255, 0.85)" stroke="#6D3AE8" strokeWidth="1.5" />
          <rect x="280" y="65" width="170" height="24" rx="999" fill="rgba(109, 58, 232, 0.12)" />
          <text x="365" y="81" fill="#6D3AE8" fontSize="10.5" fontWeight="700" textAnchor="middle">OFFLINE COMPUTE</text>
          <text x="365" y="118" fill="#0F172A" fontSize="14" fontWeight="600" textAnchor="middle">Python DSP Core</text>
          <text x="365" y="142" fill="#64748B" fontSize="11" textAnchor="middle">NumPy · SciPy · CommPy</text>
          <text x="365" y="166" fill="#64748B" fontSize="10" textAnchor="middle">• Cyclic Spectral Snap (Rs)</text>
          <text x="365" y="184" fill="#64748B" fontSize="10" textAnchor="middle">• Cumulants C42/C63 AMC</text>
          <text x="365" y="202" fill="#64748B" fontSize="10" textAnchor="middle">• Viterbi Trellis Search</text>

          {/* Box 3: Immutable JSON Layer */}
          <rect x="530" y="80" width="150" height="120" rx="16" fill="rgba(255, 255, 255, 0.85)" stroke="#D97706" strokeWidth="1.5" />
          <text x="605" y="115" fill="#D97706" fontSize="11" fontWeight="700" textAnchor="middle">STATIC TELEMETRY</text>
          <text x="605" y="140" fill="#0F172A" fontSize="13" fontWeight="600" textAnchor="middle">Immutable JSON</text>
          <text x="605" y="165" fill="#64748B" fontSize="11" textAnchor="middle">public/runs/*.json</text>
          <text x="605" y="182" fill="#94A3B8" fontSize="10" textAnchor="middle">Zero DB dependency</text>

          {/* Box 4: Next.js Client (Presentation) */}
          <rect x="740" y="50" width="160" height="180" rx="16" fill="rgba(255, 255, 255, 0.85)" stroke="#16A34A" strokeWidth="1.5" />
          <rect x="755" y="65" width="130" height="24" rx="999" fill="rgba(22, 163, 74, 0.12)" />
          <text x="820" y="81" fill="#16A34A" fontSize="10.5" fontWeight="700" textAnchor="middle">AIR-GAPPED UI</text>
          <text x="820" y="118" fill="#0F172A" fontSize="14" fontWeight="600" textAnchor="middle">Next.js 15 Client</text>
          <text x="820" y="142" fill="#64748B" fontSize="11" textAnchor="middle">HTML5 Canvas</text>
          <text x="820" y="166" fill="#64748B" fontSize="10" textAnchor="middle">• 60 FPS STFT Waterfall</text>
          <text x="820" y="184" fill="#64748B" fontSize="10" textAnchor="middle">• Dynamic Eye Overlays</text>
          <text x="820" y="202" fill="#64748B" fontSize="10" textAnchor="middle">• Forensic Bitstream</text>
        </svg>
      </div>

      {/* 4 Pillars Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="c" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-lime)', marginBottom: 10 }}>
            <Lock size={18} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>Air-Gapped Operation</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Eliminates all network-egress attack vectors. The client only consumes local, static JSON artifacts with zero remote code execution risk.
          </p>
        </div>

        <div className="c" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-purple)', marginBottom: 10 }}>
            <Zap size={18} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>Client Canvas Graphics</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Offloads all visual rendering to the operator&apos;s browser using optimized HTML5 Canvas APIs, rendering 200,000 samples at display refresh rates.
          </p>
        </div>

        <div className="c" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-lime)', marginBottom: 10 }}>
            <Terminal size={18} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>Fast Offline Compute</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Vectorized NumPy C-extensions and SciPy signal routines run spectral estimation, timing recovery, and Viterbi decoding in under 5 seconds.
          </p>
        </div>

        <div className="c" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-purple)', marginBottom: 10 }}>
            <Database size={18} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>Zero Database Dependency</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            No database instances to maintain. Every analyzed capture is stored as a self-contained, portable JSON telemetry bundle.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SystemBlueprintView({ initialTab = 'DSP Pipeline' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    { id: 'DSP Pipeline', label: 'DSP Pipeline', icon: Cpu, badge: '6 Stages' },
    { id: 'Architecture', label: 'Space & Edge Architecture', icon: Shield, badge: 'Air-Gap' },
    { id: 'Documentation', label: 'Engineering Specifications', icon: BookOpen, badge: 'Proofs' },
  ];

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Sub-navigation pill tab bar */}
      <div className="c" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: '14px 20px', 
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            System Blueprint:
          </span>
        </div>
        <div className="tabs-pill">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={isActive ? 'a' : ''}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: isActive ? 'var(--bg-pill)' : 'var(--bg-tile-hover)',
                  color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render selected view */}
      <div>
        {activeTab === 'DSP Pipeline' && <DspPipelineView />}
        {activeTab === 'Architecture' && <ArchitectureView />}
        {activeTab === 'Documentation' && <DocumentationView />}
      </div>
    </div>
  );
}
