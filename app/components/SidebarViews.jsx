'use client';
import { 
  FileText, Activity, Grip, ShieldCheck, LayoutGrid, Link2, 
  CheckCircle2, AlertTriangle, Cpu, Shield, BookOpen, Layers, 
  Terminal, Lock, Zap, Database, Server, RefreshCw, BarChart2
} from 'lucide-react';

export function DocumentationView() {
  return (
    <div className="doc-container" style={{ padding: '36px 48px', maxWidth: 1060, margin: '0 auto', color: '#1b1f27' }}>
      {/* Header Banner */}
      <div style={{ borderBottom: '1px solid #e7e9ee', paddingBottom: 24, marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#eaf7f0', color: '#1f9d6b', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          <Shield size={13} /> NTRO // Signal Intelligence Specification
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#131a26', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
          SIG-SCOPE Mathematical & Algorithmic Approach
        </h1>
        <p style={{ fontSize: 15, color: '#5f6775', lineHeight: 1.6, margin: 0, maxWidth: 840 }}>
          Deterministic, explainable Signal Intelligence and blind demodulation. Designed specifically to eliminate the fragility, hallucinations, and computational overhead of black-box neural networks in contested electromagnetic environments.
        </p>
      </div>

      {/* Comparison Grid: AI vs Deterministic DSP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 36 }}>
        <div style={{ background: '#fdf3f3', border: '1px solid #f9d6d6', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c53030', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            <AlertTriangle size={18} /> The Black-Box Deep Learning Problem (RadioML)
          </div>
          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
            Current academic trends favor Convolutional Neural Networks (CNNs) for blind AMC. However, in military SIGINT contexts, deep learning models frequently hallucinate high-confidence classifications on out-of-distribution noise, require massive GPU compute, and cannot mathematically explain <i>why</i> a decision was made. A confident false positive is disastrous.
          </p>
        </div>

        <div style={{ background: '#f0f9f5', border: '1px solid #c7ebd8', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1f9d6b', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            <CheckCircle2 size={18} /> The SIG-SCOPE Deterministic Approach
          </div>
          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
            SIG-SCOPE relies entirely on proven physical RF principles, nonlinear cyclic statistics, and statistical moments. Every parameter derivation—from symbol rate to carrier offset—is mathematically provable and auditable. When a signal is ambiguous, the system triggers an explicit <b>Honesty Gate</b> and withholds confidence rather than fabricating a guess.
          </p>
        </div>
      </div>

      {/* Section 1: Parameter Estimation */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#131a26', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: '#eaf7f0', color: '#1f9d6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>1</span>
          Blind Symbol Rate & Bandwidth Estimation
        </h2>
        <p style={{ fontSize: 14.5, color: '#4b5563', lineHeight: 1.7, marginBottom: 14 }}>
          Traditional delay-and-multiply methods collapse under unknown timing phase and arbitrary pulse-shaping. SIG-SCOPE exploits <b>nonlinear spectral-line extraction</b> across multiple nonlinear orders:
        </p>

        {/* Formula Box */}
        <div style={{ background: '#131a26', color: '#e5e9f0', padding: '18px 24px', borderRadius: 8, fontFamily: 'monospace', fontSize: 13.5, lineHeight: 1.7, marginBottom: 16, borderLeft: '4px solid #1f9d6b' }}>
          <div style={{ color: '#8892b0', fontSize: 11, marginBottom: 6 }}>{'// NONLINEAR SPECTRAL-LINE EXPANSION'}</div>
          {'S_k(f) = FFT(|x(t)|^k),  where k ∈ {2, 4, 8}'}<br />
          {'R_s = arg max |S_k(f)|  => snap to integer SPS = round(fs / Rs)'}
        </div>

        <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
          By isolating the strongest non-DC spectral spike in the nonlinearly transformed signal, SIG-SCOPE locks the symbol rate $R_s$ with sub-hertz precision without prior knowledge of the modulation order. Concurrently, the Occupied Bandwidth (OBW) is calculated using the 99% cumulative energy threshold of Welch&apos;s power spectral density:
        </p>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13, color: '#334155' }}>
          {'∫[-BW99/2, +BW99/2] P_xx(f) df = 0.99 × ∫[-fs/2, +fs/2] P_xx(f) df'}
        </div>
      </div>

      {/* Section 2: Higher Order Cumulants */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#131a26', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: '#eaf7f0', color: '#1f9d6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>2</span>
          Higher-Order Cumulants (HOCS) Modulation Classification
        </h2>
        <p style={{ fontSize: 14.5, color: '#4b5563', lineHeight: 1.7, marginBottom: 14 }}>
          Rather than relying on neural feature extractors, SIG-SCOPE employs 4th and 6th-order cumulants of zero-mean normalized baseband samples $x(n)$. Cumulants possess the critical property of being theoretically <b>blind to additive white Gaussian noise</b>:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#131a26', color: '#e5e9f0', padding: '16px 20px', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, borderLeft: '4px solid #22b8e6' }}>
            <div style={{ color: '#8892b0', fontSize: 11, marginBottom: 6 }}>{'// FOURTH-ORDER CUMULANT (C42)'}</div>
            {'C42 = Cum(x, x, x*, x*)'}<br />
            {'    = E[|x|^4] - |E[x^2]|^2 - 2·E[|x|^2]^2'}
          </div>

          <div style={{ background: '#131a26', color: '#e5e9f0', padding: '16px 20px', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, borderLeft: '4px solid #c9b48f' }}>
            <div style={{ color: '#8892b0', fontSize: 11, marginBottom: 6 }}>{'// SIXTH-ORDER CUMULANT (C63)'}</div>
            {'C63 = Cum(x, x, x, x*, x*, x*)'}<br />
            {'    = E[|x|^6] - 9·E[|x|^4]·E[|x|^2] + 12·E[|x|^2]^3'}
          </div>
        </div>

        {/* Modulation Decision Table */}
        <div style={{ border: '1px solid #e7e9ee', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e7e9ee', color: '#131a26' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Modulation Scheme</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Theoretical |C40|</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Theoretical |C42|</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Constellation Characteristics</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f2f5' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#22b8e6' }}>BPSK</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>2.00</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>-2.00</td>
                <td style={{ padding: '10px 16px', color: '#6b7280' }}>Strict 1D axis, high phase variance across 180°</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f2f5' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0f6b4a' }}>QPSK</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>1.00</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>-1.00</td>
                <td style={{ padding: '10px 16px', color: '#6b7280' }}>Constant modulus circle, 4 symmetric quadrants</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f2f5' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#f08a1c' }}>16-QAM</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>0.00</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>-0.68</td>
                <td style={{ padding: '10px 16px', color: '#6b7280' }}>Multi-amplitude rings (3 distinct power radii)</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#d6409f' }}>64-QAM</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>0.00</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>-0.62</td>
                <td style={{ padding: '10px 16px', color: '#6b7280' }}>9 concentric power rings, dense grid structure</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Synchronization & Recovery */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#131a26', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: '#eaf7f0', color: '#1f9d6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>3</span>
          Carrier Tracking & Oerder-Meyr Timing Recovery
        </h2>
        <p style={{ fontSize: 14.5, color: '#4b5563', lineHeight: 1.7, marginBottom: 14 }}>
          Once the symbol rate and modulation candidate are established, SIG-SCOPE executes blind timing and frequency synchronization:
        </p>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#131a26', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="#1f9d6b" /> Oerder-Meyr Feedforward Timing Estimator
          </h4>
          <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.6, margin: '0 0 12px 0' }}>
            Rather than closed feedback loops (e.g. Gardner TED) which can suffer from cycle slips and hang-ups, SIG-SCOPE employs the feedforward <b>Oerder-Meyr</b> algorithm. It extracts fractional timing offset $\tau$ directly from the nonlinear signal energy:
          </p>
          <div style={{ background: '#131a26', color: '#e5e9f0', padding: '12px 18px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13 }}>
            {'τ = -1 / (2π) · arg( ∑_{m=0}^{L-1} |x(m)|^2 · e^(-j 2π m / Ns) )'}
          </div>
          <p style={{ fontSize: 12.5, color: '#6b7280', margin: '8px 0 0 0' }}>
            Because $|x(m)|^2$ is purely magnitude-dependent, the timing detector is completely modulation-order agnostic.
          </p>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#131a26', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={16} color="#22b8e6" /> Carrier Frequency Offset (CFO) & Phase Lock
          </h4>
          <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.6, margin: '0 0 12px 0' }}>
            Carrier Frequency Offset (CFO) caused by local oscillator drift is removed via $M$-th power non-linear phase exponentiation:
          </p>
          <div style={{ background: '#131a26', color: '#e5e9f0', padding: '12px 18px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13 }}>
            {'Δf_CFO = 1 / (2π·M) · arg( E[ x(t)^M ] ),  where M ∈ {2, 4}'}
          </div>
        </div>
      </div>

      {/* Section 4: FEC & Joint Search */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#131a26', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: '#eaf7f0', color: '#1f9d6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>4</span>
          Joint Viterbi Trellis Decoding & De-Interleaver Search
        </h2>
        <p style={{ fontSize: 14.5, color: '#4b5563', lineHeight: 1.7, margin: 0 }}>
          Convolutionally encoded signals ($r=1/2$, polynomials $[133_8, 171_8]$) present a severe blind interception challenge: unknown interleaving patterns combined with $M$-fold constellation rotation ambiguities. SIG-SCOPE performs a joint multi-hypothesis search through a vectorized CommPy Viterbi decoder across all candidate rotation angles ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) and interleaver geometries ($4\times 4, 8\times 2$). The correct branch is confirmed when valid sync preambles or low path metrics emerge.
        </p>
      </div>
    </div>
  );
}

export function DspPipelineView() {
  return (
    <div className="doc-container" style={{ padding: '36px 48px', maxWidth: 1060, margin: '0 auto', color: '#1b1f27' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e7e9ee', paddingBottom: 24, marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#eaf7f0', color: '#1f9d6b', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          <Cpu size={13} /> End-to-End Pipeline Architecture
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#131a26', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
          SIG-SCOPE Signal Processing Pipeline
        </h1>
        <p style={{ fontSize: 15, color: '#5f6775', lineHeight: 1.6, margin: 0, maxWidth: 840 }}>
          Every intercepted waveform passes through a strictly modular, 6-stage offline DSP pipeline in Python. Below is the visual dataflow and deep-dive technical specification.
        </p>
      </div>

      {/* High-Resolution SVG Architecture Flowchart */}
      <div style={{ background: '#0e1420', borderRadius: 12, padding: '32px 24px', marginBottom: 36, border: '1px solid #1a2333', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #1d273a', paddingBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e9f0', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="#1f9d6b" /> SIG-SCOPE Real-Time Execution Flowchart
          </span>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} /> Ingest &amp; Characterization</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /> Pure DSP Compute</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fbbf24' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} /> Honesty Gate</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#a855f7' }} /> Next.js Client UI</span>
          </div>
        </div>

        {/* SVG Flowchart */}
        <svg viewBox="0 0 980 440" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="gBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#064e3b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#022c22" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gAmber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#78350f" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#451a03" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gPurple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#581c87" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b0764" stopOpacity="0.9" />
            </linearGradient>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
            <marker id="arrowGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
            <marker id="arrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Connectors */}
          <line x1="160" y1="80" x2="220" y2="80" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="380" y1="80" x2="440" y2="80" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="600" y1="80" x2="660" y2="80" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
          
          {/* Decision Branch */}
          <line x1="770" y1="120" x2="770" y2="180" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowGreen)" />
          <line x1="880" y1="80" x2="920" y2="80" stroke="#f59e0b" strokeWidth="2" />
          <line x1="920" y1="80" x2="920" y2="300" stroke="#f59e0b" strokeWidth="2" />
          <line x1="920" y1="300" x2="880" y2="300" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrowAmber)" />

          {/* Row 2: Synchronization & Demod */}
          <line x1="660" y1="220" x2="600" y2="220" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="380" y1="220" x2="320" y2="220" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />

          {/* To Next.js Client */}
          <line x1="220" y1="260" x2="220" y2="320" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="330" y1="360" x2="400" y2="360" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="560" y1="360" x2="620" y2="360" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />

          {/* Nodes */}
          {/* 1. Raw Ingest */}
          <rect x="20" y="45" width="140" height="70" rx="8" fill="url(#gBlue)" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="90" y="75" fill="#93c5fd" fontSize="12" fontWeight="700" textAnchor="middle">1. RAW RF INGEST</text>
          <text x="90" y="95" fill="#e2e8f0" fontSize="11" textAnchor="middle">.iq / .wav / Complex64</text>

          {/* 2. Characterization */}
          <rect x="220" y="45" width="160" height="70" rx="8" fill="url(#gGreen)" stroke="#10b981" strokeWidth="1.5" />
          <text x="300" y="75" fill="#a7f3d0" fontSize="12" fontWeight="700" textAnchor="middle">2. CHARACTERIZATION</text>
          <text x="300" y="95" fill="#e2e8f0" fontSize="11" textAnchor="middle">-3dB BW, SNR, Welch PSD</text>

          {/* 3. Parameter Estimation */}
          <rect x="440" y="45" width="160" height="70" rx="8" fill="url(#gGreen)" stroke="#10b981" strokeWidth="1.5" />
          <text x="520" y="75" fill="#a7f3d0" fontSize="12" fontWeight="700" textAnchor="middle">3. BLIND AMC &amp; Rs</text>
          <text x="520" y="95" fill="#e2e8f0" fontSize="11" textAnchor="middle">x^k Spectral Lines &amp; HOCS</text>

          {/* Decision: Honesty Gate */}
          <polygon points="770,40 880,80 770,120 660,80" fill="url(#gAmber)" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="770" y="77" fill="#fde68a" fontSize="11" fontWeight="700" textAnchor="middle">HONESTY GATE</text>
          <text x="770" y="92" fill="#fff" fontSize="10" textAnchor="middle">Margin &gt; 0.10?</text>

          {/* Abstention Branch */}
          <rect x="740" y="270" width="140" height="60" rx="8" fill="#2d1515" stroke="#ef4444" strokeWidth="1.5" />
          <text x="810" y="295" fill="#fca5a5" fontSize="11" fontWeight="700" textAnchor="middle">ABSTAIN / WITHHOLD</text>
          <text x="810" y="313" fill="#cbd5e1" fontSize="10" textAnchor="middle">Report exact reason</text>

          {/* 4. Carrier & Timing Recovery */}
          <rect x="660" y="185" width="160" height="70" rx="8" fill="url(#gGreen)" stroke="#10b981" strokeWidth="1.5" />
          <text x="740" y="215" fill="#a7f3d0" fontSize="12" fontWeight="700" textAnchor="middle">4. SYNCHRONIZATION</text>
          <text x="740" y="235" fill="#e2e8f0" fontSize="11" textAnchor="middle">M-th CFO &amp; Oerder-Meyr</text>

          {/* 5. FEC & De-Interleave */}
          <rect x="440" y="185" width="160" height="70" rx="8" fill="url(#gGreen)" stroke="#10b981" strokeWidth="1.5" />
          <text x="520" y="215" fill="#a7f3d0" fontSize="12" fontWeight="700" textAnchor="middle">5. FEC / VITERBI</text>
          <text x="520" y="235" fill="#e2e8f0" fontSize="11" textAnchor="middle">Joint Rotation &amp; Block De-int</text>

          {/* 6. Static Serialization */}
          <rect x="120" y="185" width="200" height="70" rx="8" fill="url(#gPurple)" stroke="#a855f7" strokeWidth="1.5" />
          <text x="220" y="215" fill="#e9d5ff" fontSize="12" fontWeight="700" textAnchor="middle">6. STATIC SERIALIZATION</text>
          <text x="220" y="235" fill="#e2e8f0" fontSize="11" textAnchor="middle">JSON Payload (public/runs/)</text>

          {/* Presentation Layer */}
          <rect x="120" y="325" width="210" height="70" rx="8" fill="#131c2e" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="225" y="355" fill="#93c5fd" fontSize="12" fontWeight="700" textAnchor="middle">NEXT.JS 15 CLIENT</text>
          <text x="225" y="375" fill="#cbd5e1" fontSize="11" textAnchor="middle">Decoupled UI &amp; State Engine</text>

          <rect x="400" y="325" width="160" height="70" rx="8" fill="#131c2e" stroke="#10b981" strokeWidth="1.5" />
          <text x="480" y="355" fill="#a7f3d0" fontSize="12" fontWeight="700" textAnchor="middle">CANVAS VIZ ENGINE</text>
          <text x="480" y="375" fill="#cbd5e1" fontSize="11" textAnchor="middle">Eye, STFT, Spectrum</text>

          <rect x="620" y="325" width="160" height="70" rx="8" fill="#131c2e" stroke="#c084fc" strokeWidth="1.5" />
          <text x="700" y="355" fill="#e9d5ff" fontSize="12" fontWeight="700" textAnchor="middle">FORENSIC BITSTREAM</text>
          <text x="700" y="375" fill="#cbd5e1" fontSize="11" textAnchor="middle">Binary, Hex, ASCII Dump</text>
        </svg>
      </div>

      {/* Stage Breakdown Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          {
            num: 1, title: 'Raw Ingest & RF Conditioning',
            tags: ['Complex64', 'DC-Offset Suppress', 'RMS AGC'],
            desc: 'Parses binary IQ captures or stereo/mono audio WAV files into normalized NumPy complex64 arrays. Removes high-pass DC bias spikes caused by direct-conversion receiver local oscillator leakage, then normalizes signal variance to unity for invariant statistical estimation.'
          },
          {
            num: 2, title: 'Spectral Characterization & Occupied Bandwidth',
            tags: ['Welch PSD', '-3dB Cutoff', '99% OBW', 'In-Band SNR'],
            desc: 'Computes averaged periodogram (FFT size 2048 with 50% overlap). Determines the precise -3dB bandwidth boundaries and integrates cumulative energy to pin the 99% Occupied Bandwidth (OBW), isolating the signal channel from out-of-band emissions.'
          },
          {
            num: 3, title: 'Blind AMC & Nonlinear Symbol Snapping',
            tags: ['x^k Spectral Line', 'Cumulants C42/C63', 'Honesty Gate'],
            desc: 'Passes baseband data through nonlinear channels (x^2, x^4, x^8) to reveal discrete spectral spikes corresponding to the symbol rate Rs. Snaps to the nearest integer SPS. Higher-order cumulants (C40, C42, C63) are calculated to classify PSK vs QAM. If the margin between top candidates is under 0.10, the system triggers the Honesty Gate and abstains.'
          },
          {
            num: 4, title: 'Carrier Frequency Offset & Timing Recovery',
            tags: ['M-th Power CFO', 'Oerder-Meyr TED', 'Cubic Spline Resampling'],
            desc: 'Coarse and fine CFO are estimated via M-th power FFT and removed via complex frequency shift. The Oerder-Meyr timing error detector calculates fractional delay from energy pulses, feeding an anti-aliased cubic interpolator to sample directly at the maximum eye opening.'
          },
          {
            num: 5, title: 'FEC Trellis Decoding & De-Interleaving',
            tags: ['CommPy Viterbi', 'Rate 1/2', 'Joint Rotation Search'],
            desc: 'For forward error corrected signals, a joint hypothesis search is run through a Viterbi decoder across 4 rotation states (0°, 90°, 180°, 270°) and rectangular interleaver permutations (e.g. 4x4, 8x2) to locate the valid code trellis.'
          },
          {
            num: 6, title: 'Preamble Lock & Forensic Bitstream Serialization',
            tags: ['Barker Sync', 'BER Validation', 'Immutable JSON'],
            desc: 'Correlates the output stream against known protocol preambles to pin absolute quadrant phase. If ground truth is provided, BER is measured directly. Telemetry, STFT matrices, and decoded bits are written to immutable JSON files for static client rendering.'
          }
        ].map(s => (
          <div key={s.num} style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 10, padding: '20px 24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#131a26', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: 5, background: '#eaf7f0', color: '#1f9d6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{s.num}</span>
                {s.title}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {s.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, background: '#f1f2f5', color: '#4b5563', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{t}</span>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArchitectureView() {
  return (
    <div className="doc-container" style={{ padding: '36px 48px', maxWidth: 1060, margin: '0 auto', color: '#1b1f27' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e7e9ee', paddingBottom: 24, marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#eaf7f0', color: '#1f9d6b', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          <ShieldCheck size={13} /> Defense Grade // Air-Gapped Deployment
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#131a26', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
          SIG-SCOPE System Architecture
        </h1>
        <p style={{ fontSize: 15, color: '#5f6775', lineHeight: 1.6, margin: 0, maxWidth: 840 }}>
          Completely decoupled hybrid stack designed for edge signal processing in classified, disconnected environments. Zero live Python server required at web request time.
        </p>
      </div>

      {/* SVG Decoupled System Diagram */}
      <div style={{ background: '#0e1420', borderRadius: 12, padding: '32px 24px', marginBottom: 36, border: '1px solid #1a2333', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e9f0', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 20, borderBottom: '1px solid #1d273a', paddingBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={16} color="#22b8e6" /> Decoupled Edge Compute &amp; Client Presentation
        </div>

        <svg viewBox="0 0 920 300" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="edgeG1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <marker id="archArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Connectors */}
          <line x1="200" y1="140" x2="260" y2="140" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#archArrow)" />
          <line x1="470" y1="140" x2="530" y2="140" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#archArrow)" />
          <line x1="680" y1="140" x2="740" y2="140" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#archArrow)" />

          {/* Box 1: RF Hardware */}
          <rect x="20" y="70" width="180" height="140" rx="10" fill="url(#edgeG1)" stroke="#334155" strokeWidth="1.5" />
          <text x="110" y="105" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">RF SENSORS &amp; SDR</text>
          <text x="110" y="130" fill="#f8fafc" fontSize="13" fontWeight="700" textAnchor="middle">Raw Ingestion</text>
          <text x="110" y="155" fill="#64748b" fontSize="11" textAnchor="middle">HackRF / RTL-SDR / WAV</text>
          <text x="110" y="175" fill="#64748b" fontSize="10" textAnchor="middle">Complex64 Binary Dump</text>

          {/* Box 2: Python DSP Backend */}
          <rect x="260" y="50" width="210" height="180" rx="10" fill="url(#edgeG1)" stroke="#10b981" strokeWidth="2" />
          <rect x="280" y="65" width="170" height="24" rx="4" fill="#064e3b" />
          <text x="365" y="81" fill="#a7f3d0" fontSize="11" fontWeight="700" textAnchor="middle">DETACHED / OFFLINE</text>
          <text x="365" y="118" fill="#f8fafc" fontSize="14" fontWeight="700" textAnchor="middle">Python DSP Core</text>
          <text x="365" y="142" fill="#94a3b8" fontSize="11" textAnchor="middle">NumPy · SciPy · CommPy</text>
          <text x="365" y="166" fill="#64748b" fontSize="10" textAnchor="middle">• Cyclic Spectral Snap (Rs)</text>
          <text x="365" y="184" fill="#64748b" fontSize="10" textAnchor="middle">• Cumulants C42/C63 AMC</text>
          <text x="365" y="202" fill="#64748b" fontSize="10" textAnchor="middle">• Viterbi Trellis Search</text>

          {/* Box 3: Immutable JSON Layer */}
          <rect x="530" y="80" width="150" height="120" rx="10" fill="url(#edgeG1)" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="605" y="115" fill="#fde68a" fontSize="11" fontWeight="700" textAnchor="middle">STATIC TELEMETRY</text>
          <text x="605" y="140" fill="#f8fafc" fontSize="13" fontWeight="700" textAnchor="middle">Immutable JSON</text>
          <text x="605" y="165" fill="#94a3b8" fontSize="11" textAnchor="middle">public/runs/*.json</text>
          <text x="605" y="182" fill="#64748b" fontSize="10" textAnchor="middle">Zero DB dependency</text>

          {/* Box 4: Next.js Client */}
          <rect x="740" y="50" width="160" height="180" rx="10" fill="url(#edgeG1)" stroke="#38bdf8" strokeWidth="2" />
          <rect x="755" y="65" width="130" height="24" rx="4" fill="#0c4a6e" />
          <text x="820" y="81" fill="#bae6fd" fontSize="11" fontWeight="700" textAnchor="middle">AIR-GAPPED UI</text>
          <text x="820" y="118" fill="#f8fafc" fontSize="14" fontWeight="700" textAnchor="middle">Next.js 15 Client</text>
          <text x="820" y="142" fill="#94a3b8" fontSize="11" textAnchor="middle">HTML5 Canvas Graphics</text>
          <text x="820" y="166" fill="#64748b" fontSize="10" textAnchor="middle">• 60 FPS STFT Waterfall</text>
          <text x="820" y="184" fill="#64748b" fontSize="10" textAnchor="middle">• Dynamic Eye Overlays</text>
          <text x="820" y="202" fill="#64748b" fontSize="10" textAnchor="middle">• Forensic Bitstream</text>
        </svg>
      </div>

      {/* 4 Pillars Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1f9d6b', marginBottom: 12 }}>
            <Lock size={20} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#131a26' }}>Air-Gapped &amp; Classified Security</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>
            In tactical intelligence operations, analytical systems cannot touch live external networks or execute user-supplied code on core computing clusters. SIG-SCOPE eliminates all Remote Code Execution (RCE) attack vectors: the Next.js frontend only consumes sanitized, static JSON artifacts. The entire application can be hosted on isolated, air-gapped intranet networks.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#22b8e6', marginBottom: 12 }}>
            <Zap size={20} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#131a26' }}>Client-Side Canvas Performance</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>
            Traditional web SDR applications suffer from server-side rendering bottlenecks when generating hundreds of FFT waterfall rows. SIG-SCOPE offloads all visual rendering to the operator&apos;s browser using optimized HTML5 Canvas APIs, rendering 200,000 samples and high-density eye diagrams at native display refresh rates without consuming server resources.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f08a1c', marginBottom: 12 }}>
            <Terminal size={20} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#131a26' }}>Sub-5-Second Compute Time</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>
            By leveraging vectorized NumPy C-extensions and SciPy signal routines, the entire DSP analysis—ingestion, spectral estimation, Oerder-Meyr timing recovery, Viterbi search, and preamble verification—executes in under 5 seconds on standard commercial off-the-shelf (COTS) x86 processors without needing high-power GPU accelerators.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7a3fc0', marginBottom: 12 }}>
            <Database size={20} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#131a26' }}>Zero Database Footprint</h3>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>
            No PostgreSQL, MongoDB, or Redis instances to configure, maintain, or migrate. Every analyzed capture is stored as a self-contained, portable JSON telemetry bundle. This allows instant archival, offline forensic reproduction, and lightweight data transmission over low-bandwidth tactical radio links.
          </p>
        </div>
      </div>
    </div>
  );
}
