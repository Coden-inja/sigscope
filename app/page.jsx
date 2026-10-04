'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  FileText, Activity, BarChart3, Grip, ShieldCheck, LayoutGrid, 
  Link2, Upload, Download, MoreHorizontal, ChevronDown, CheckCircle2, 
  ChevronLeft, ChevronRight, ArrowRight, Timer, Layers, Waves, 
  Signal, Clock, X, RefreshCw, AlertCircle, Radio
} from 'lucide-react';
import { rng, gauss } from '../lib/sim';

const G = '#1b7f5c', cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const jet = t => `rgb(${[1.5 - Math.abs(4 * t - 3), 1.5 - Math.abs(4 * t - 2), 1.5 - Math.abs(4 * t - 1)].map(v => Math.round(cl(v) * 255))})`;
const bin = b => b.toString(2).padStart(8, '0'), hx = b => b.toString(16).padStart(2, '0').toUpperCase(), asc = b => b > 31 && b < 127 ? String.fromCharCode(b) : '.';

function ax(x, w, h, o) {
  const L = o.l ?? 40, B = 30, T = 8, R = 14, pw = Math.max(10, w - L - R), ph = Math.max(10, h - T - B), [x0, x1, xs] = o.x, [y0, y1, ys] = o.y, X = v => L + (v - x0) / (x1 - x0) * pw, Y = v => T + (1 - (v - y0) / (y1 - y0)) * ph;
  x.strokeStyle = '#d5d9e0'; x.lineWidth = 1; x.strokeRect(L + .5, T + .5, pw, ph); x.fillStyle = '#6b7280'; x.font = '10px Inter,sans-serif'; x.textAlign = 'center';
  for (let v = x0; v <= x1 + 1e-9; v += xs) x.fillText(o.fx ? o.fx(v) : v.toFixed(1), X(v), h - B + 13);
  x.textAlign = 'right'; for (let v = y0; v <= y1 + 1e-9; v += ys) x.fillText(o.fy ? o.fy(v) : v.toFixed(0), L - 6, Y(v) + 3);
  x.textAlign = 'center'; x.fillText(o.xl, L + pw / 2, h - 4); x.save(); x.translate(10, T + ph / 2); x.rotate(-Math.PI / 2); x.fillText(o.yl, 0, 0); x.restore();
  x.save(); x.beginPath(); x.rect(L, T, pw, ph); x.clip(); return { X, Y, L, T, pw, ph };
}

function Cv({ w: defaultW = 300, h = 230, draw }) { 
  const r = useRef(); 
  const [width, setWidth] = useState(defaultW);

  useEffect(() => { 
    const c = r.current;
    if (!c) return;
    const update = () => {
      if (c.parentElement) {
        const curW = c.parentElement.clientWidth;
        if (curW > 0) setWidth(curW);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (c.parentElement) ro.observe(c.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { 
    const c = r.current;
    if (!c) return;
    const w = width || defaultW;
    const x = c.getContext('2d'), d = window.devicePixelRatio || 1; 
    c.width = w * d; 
    c.height = h * d; 
    x.setTransform(d, 0, 0, d, 0, 0); 
    draw(x, w, h);
  }, [width, h, draw, defaultW]); 

  return <canvas ref={r} style={{ width: '100%', height: h, display: 'block', maxWidth: '100%' }} />;
}

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [done, setDone] = useState(6);
  const [tab, setTab] = useState('Spectrum');
  const [out, setOut] = useState('Bitstream');
  const [fmt, setFmt] = useState('Binary');
  const [pg, setPg] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Active Signal State
  const [signalData, setSignalData] = useState({
    fileName: 'capture_20260917_124530.iq',
    subTitle: 'IQ File • 256 MB • 4.096 Msps • Complex64',
    format: 'Complex64 (IQ)',
    processingTime: '42.6',
    samplingRate: '4.096 Msps',
    bandwidth: '1.024 MHz',
    modulation: 'QPSK',
    symbolRate: '512 ksps',
    fecType: 'Convolutional',
    fecSub: '(Viterbi)',
    interleaving: 'Block',
    confidence: {
      sr: '99.2%',
      bw: '98.7%',
      mod: '98.7%',
      sym: '97.9%',
      fec: '96.3%',
      il: '98.1%'
    },
    signalSummary: {
      duration: '30.00 s',
      samples: '122,880,000',
      sourceBand: 'VHF (Estimated)',
      snr: '18.4 dB'
    },
    dataSummary: {
      syncWord: '0xA5F3C7D2',
      payloadLen: '8,192 bytes',
      crcCheck: 'Pass'
    },
    bytes: (() => {
      const r = rng(9), b = Array.from({ length: 1024 }, () => Math.floor(r() * 256));
      [0xA5, 0xF3, 0xC7, 0xD2].forEach((v, i) => b[i] = v);
      return b;
    })(),
    psdCurve: (() => {
      const r = rng(4);
      return Array.from({ length: 420 }, (_, i) => {
        const f = -2 + i / 419 * 4, a = Math.abs(f);
        const s = a < .5 ? -38 - 20 * (a / .5) ** 2 : -58 - 30 * (1 - Math.exp(-(a - .5) * 1.3));
        return s + (r() - .5) * (a < .5 ? 7 : 5);
      });
    })()
  });

  // Pipeline animation
  useEffect(() => { 
    if (done >= 6) return; 
    const t = setTimeout(() => setDone(d => d + 1), 500); 
    return () => clearTimeout(t);
  }, [done]);

  // Real API call to analyze file or preset
  const handleAnalyze = async (sampleId = null, file = null) => {
    try {
      setLoading(true);
      setUploadError(null);
      setDone(0);

      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/analyze', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleId: sampleId || '0412' })
        });
      }

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Signal analysis request failed');
      }

      const data = await res.json();
      
      // Update state with genuine calculated parameters
      setSignalData({
        fileName: data.fileName,
        subTitle: `${data.format} • ${data.fileSizeFormatted} • ${data.parameters.samplingRateFormatted}`,
        format: data.format,
        processingTime: data.processingTimeSec.toFixed(1),
        samplingRate: data.parameters.samplingRateFormatted,
        bandwidth: data.parameters.bandwidthFormatted,
        modulation: data.parameters.modulation,
        symbolRate: data.parameters.symbolRateFormatted,
        fecType: data.parameters.fecType.split(' ')[0],
        fecSub: data.parameters.fecType.includes('(') ? `(${data.parameters.fecType.split('(')[1]}` : '(Auto)',
        interleaving: data.parameters.interleaving,
        confidence: {
          sr: `${(data.confidence.samplingRate * 100).toFixed(1)}%`,
          bw: `${(data.confidence.bandwidth * 100).toFixed(1)}%`,
          mod: `${(data.confidence.modulation * 100).toFixed(1)}%`,
          sym: `${(data.confidence.symbolRate * 100).toFixed(1)}%`,
          fec: `${(data.confidence.fec * 100).toFixed(1)}%`,
          il: `${(data.confidence.interleaving * 100).toFixed(1)}%`
        },
        signalSummary: {
          duration: `${data.durationSec} s`,
          samples: data.sampleCount.toLocaleString(),
          sourceBand: data.sourceBand,
          snr: data.parameters.snrFormatted
        },
        dataSummary: {
          syncWord: data.decoding.syncWordHex,
          payloadLen: `${data.decoding.payloadLength.toLocaleString()} bytes`,
          crcCheck: data.decoding.crcPassed ? 'Pass' : 'Fail'
        },
        bytes: data.decoding.bytes || [],
        psdCurve: data.visualizations.psd
      });

      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setUploadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export Intelligence Report download
  const handleExportReport = () => {
    const report = {
      agency: 'NTRO - National Technical Research Organisation',
      classification: 'RESTRICTED // SPACE-SIGINT',
      timestamp: new Date().toISOString(),
      platform: 'SIG-SCOPE v1.0 (Air-Gapped Workstation)',
      missionId: 'SIH26147 - Space Technology (Team Toll Tax)',
      interceptFile: signalData.fileName,
      format: signalData.format,
      parameters: {
        samplingRate: signalData.samplingRate,
        bandwidth: signalData.bandwidth,
        modulation: signalData.modulation,
        symbolRate: signalData.symbolRate,
        fec: `${signalData.fecType} ${signalData.fecSub}`,
        interleaving: signalData.interleaving,
        snr: signalData.signalSummary.snr,
        syncWord: signalData.dataSummary.syncWord,
        crc: signalData.dataSummary.crcCheck
      },
      confidence: signalData.confidence,
      decodedPayloadSummary: signalData.bytes.slice(0, 32).map(hx).join(' ')
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGINT_REPORT_${signalData.fileName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Canvas Draw Functions
  const dSpec = (x, w, h) => {
    const a = ax(x, w, h, { x: [-2, 2, .5], y: [-100, -20, 20], xl: 'Frequency (MHz)', yl: 'Power (dB)' }), { X, Y } = a;
    x.fillStyle = 'rgba(31,157,107,.16)'; 
    x.fillRect(X(-.5), a.T, X(.5) - X(-.5), a.ph);
    x.beginPath(); 
    const pts = signalData.psdCurve;
    pts.forEach((d, i) => { 
      const f = -2 + i / (pts.length - 1) * 4; 
      i ? x.lineTo(X(f), Y(d)) : x.moveTo(X(f), Y(d)); 
    }); 
    x.strokeStyle = G; 
    x.lineWidth = 1.2; 
    x.stroke();
    x.lineTo(X(2), Y(-100)); 
    x.lineTo(X(-2), Y(-100)); 
    x.fillStyle = 'rgba(31,157,107,.12)'; 
    x.fill(); 
    x.restore();
    x.fillStyle = '#2a2d33'; 
    x.fillRect(X(0) - 30, a.T - 2, 60, 16); 
    x.fillStyle = '#fff'; 
    x.font = '9.5px Inter,sans-serif'; 
    x.textAlign = 'center'; 
    x.fillText(signalData.bandwidth, X(0), a.T + 10);
  };

  const dWf = (x, w, h) => {
    const a = ax(x, w, h, { x: [0, 30, 5], y: [-2, 2, 1], fx: v => v.toFixed(0), xl: 'Time (s)', yl: 'Frequency (MHz)' }), r = rng(2), N = 90, M = 70;
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const t = i / N * 30, f = 2 - j / M * 4;
      const v = .3 + .32 * Math.exp(-((f / .7) ** 2)) + .16 * Math.exp(-(((t - 15) / 2.6) ** 2)) * (.5 + .5 * Math.exp(-((f / 1.4) ** 2))) + .28 * Math.exp(-((f / .12) ** 2) - (((t - 15) / 1.3) ** 2)) + .09 * (r() - .5) * 2;
      x.fillStyle = jet(cl(v)); 
      x.fillRect(a.L + i * a.pw / N, a.T + j * a.ph / M, a.pw / N + .6, a.ph / M + .6);
    } 
    x.restore();
  };

  const CC = [[-.6, .6, '#0f6b4a'], [.6, .6, '#22b8e6'], [-.6, -.6, '#f08a1c'], [.6, -.6, '#7a3fc0']];
  const dCon = (x, w, h) => {
    const a = ax(x, w, h, { x: [-1, 1, .5], y: [-1, 1, .5], xl: 'I', yl: 'Q', l: 40 }), r = rng(6);
    x.strokeStyle = '#d5d9e0'; 
    x.beginPath(); 
    x.moveTo(a.X(0), a.T); 
    x.lineTo(a.X(0), a.T + a.ph); 
    x.moveTo(a.L, a.Y(0)); 
    x.lineTo(a.L + a.pw, a.Y(0)); 
    x.stroke();
    CC.forEach(([cx, cy, c]) => { 
      x.fillStyle = c; 
      for (let i = 0; i < 220; i++) x.fillRect(a.X(cx + gauss(r) * .09), a.Y(cy + gauss(r) * .09), 2, 2);
    }); 
    x.restore();
  };

  const dIQ = (x, w, h) => {
    const a = ax(x, w, h, { x: [0, 200, 50], y: [-1, 1, .5], fx: v => v, xl: 'Sample', yl: 'Amplitude' }), r = rng(8);
    [['#1b7f5c', 0], ['#e08a1c', 1.4]].forEach(([c, p]) => { 
      x.beginPath(); 
      for (let i = 0; i <= 200; i++) { 
        const y = Math.sin(i * .31 + p) * .7 * (.9 + .1 * Math.sin(i * .05)) + (r() - .5) * .12; 
        i ? x.lineTo(a.X(i), a.Y(y)) : x.moveTo(a.X(i), a.Y(y));
      } 
      x.strokeStyle = c; 
      x.lineWidth = 1.2; 
      x.stroke();
    }); 
    x.restore();
  };

  const V = { Spectrum: [dSpec, 220], Waterfall: [dWf, 220], Constellation: [dCon, 220], 'IQ Plot': [dIQ, 220] };

  // Bitstream slicing
  const bytes = signalData.bytes.slice(pg * 128, pg * 128 + 128);
  const lines = useMemo(() => { 
    const n = fmt === 'Binary' ? 4 : 16, o = []; 
    for (let i = 0; i < bytes.length; i += n) { 
      const s = bytes.slice(i, i + n); 
      o.push(fmt === 'Binary' ? s.map(bin).join('') : fmt === 'Hex' ? s.map(hx).join(' ') : s.map(asc).join(''));
    } 
    return o;
  }, [bytes, fmt]);

  const outL = out === 'Bitstream' 
    ? signalData.bytes.slice(0, 24).reduce((a, b, i) => (i % 4 ? a[a.length - 1] += bin(b) : a.push(bin(b)), a), []) 
    : out === 'Header' 
      ? [`Sync Word   ${signalData.dataSummary.syncWord.replace('0x', '')}`, `Frame Len   ${signalData.dataSummary.payloadLen}`, 'Frame ID    0x0412', 'Flags       0x40', 'Version     1', `Header CRC  ${signalData.dataSummary.crcCheck === 'Pass' ? 'Valid' : 'Invalid'}`] 
      : [0, 1, 2, 3, 4, 5].map(i => signalData.bytes.slice(4 + i * 16, 20 + i * 16).map(asc).join(''));

  const [draw, hh] = V[tab];
  const complete = done >= 6;
  const pr = signalData.processingTime;

  const PARAMS = [
    [Activity, 'Sampling Rate', signalData.samplingRate, signalData.confidence.sr],
    [BarChart3, 'Bandwidth', signalData.bandwidth, signalData.confidence.bw],
    [Grip, 'Modulation', signalData.modulation, signalData.confidence.mod],
    [Activity, 'Symbol Rate', signalData.symbolRate, signalData.confidence.sym],
    [ShieldCheck, 'FEC Type', signalData.fecType, signalData.confidence.fec, signalData.fecSub],
    [LayoutGrid, 'Interleaving', signalData.interleaving, signalData.confidence.il]
  ];

  const STEPS = [
    [FileText, 'File Ingest', 'IQ / .wav', signalData.samplingRate],
    [Activity, 'Parameter Estimation', 'Sampling, Modulation, FEC, Interleaving'],
    [Grip, 'Demodulation', signalData.modulation, signalData.symbolRate],
    [LayoutGrid, 'De-Interleaving', signalData.interleaving, '(Auto-selected)'],
    [ShieldCheck, 'FEC Decoding', `${signalData.fecType} ${signalData.fecSub}`, '(BER: 1.2e-5)'],
    [Link2, 'Bitstream Correlation', 'Header / Payload', `(Sync Word: ${signalData.dataSummary.syncWord})`]
  ];

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <div className="content-area">
        <Header subtitle="From Raw Waveforms to Decoded Intelligence" />

        <div className="main">
          {/* Active File Bar */}
          <div className="c fh">
            <span className="fic"><FileText size={24} /></span>
            <div>
              <h2>{signalData.fileName}</h2>
              <small>{signalData.subTitle}</small>
            </div>
            <span className="sp" />
            <span className={'pill' + (complete ? '' : ' w')}>
              <CheckCircle2 size={14} />
              {complete ? 'Analysis Complete' : 'Analyzing…'}
            </span>
            <span>Processing Time: <b>{pr}s</b></span>
            <span className="sp" />
            <button className="btn d" onClick={() => setModalOpen(true)}>
              <Upload size={15} />Load File
            </button>
            <button className="btn" disabled={!complete} onClick={handleExportReport}>
              <Download size={15} />Export Report
            </button>
            <button className="btn sq" onClick={() => setDone(0)} title="Re-run DSP Pipeline">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="grid">
            <div className="l">
              {/* Detected Parameters 6 Tiles */}
              <div className="c">
                <h3 style={{ fontSize: 15 }}>Detected Parameters</h3>
                <div className="tiles">
                  {PARAMS.map(([I, k, v, c, sub], i) => (
                    <div className="tile" key={k} style={{ opacity: done >= Math.min(i + 1, 2) ? 1 : .35 }}>
                      <div className="tile-top">
                        <span className="tile-ic"><I size={14} /></span>
                        <span className="tile-lbl">{k}</span>
                      </div>
                      <div className="tile-val">
                        <b>{v}</b>
                        {sub && <span className="tile-sub">{sub}</span>}
                      </div>
                      <div className="tile-ftr">Confidence: {c}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Charts Row: Spectrum, Waterfall, Constellation */}
              <div className="cs">
                <div className="c">
                  <h3>
                    <Activity size={16} />
                    <span>Spectrum</span>
                    <span className="sp" />
                    <select className="sel" defaultValue="Live">
                      <option>Live</option>
                      <option>Peak Hold</option>
                      <option>Average</option>
                    </select>
                  </h3>
                  <Cv w={330} h={230} draw={dSpec} />
                </div>

                <div className="c">
                  <h3>
                    <Grip size={16} />
                    <span>Waterfall</span> <em>(Time-Freq)</em>
                    <span className="sp" />
                    <select className="sel" defaultValue="Live">
                      <option>Live</option>
                      <option>Paused</option>
                    </select>
                  </h3>
                  <div className="cb">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Cv w={290} h={230} draw={dWf} />
                    </div>
                    <div className="bar" />
                    <div className="cbl">
                      {[-20, -40, -60, -80, -100].map(v => <span key={v}>{v} dB</span>)}
                    </div>
                  </div>
                </div>

                <div className="c">
                  <h3>
                    <Grip size={16} />
                    <span>Constellation</span>
                    <span className="sp" />
                    <select className="sel" defaultValue={signalData.modulation}>
                      <option>{signalData.modulation}</option>
                      <option>BPSK</option>
                      <option>8PSK</option>
                      <option>16QAM</option>
                    </select>
                  </h3>
                  <Cv w={330} h={230} draw={dCon} />
                </div>
              </div>

              {/* Analysis Pipeline */}
              <div className="c">
                <h3>
                  <Activity size={16} />
                  Analysis Pipeline
                  <span className="sp" />
                  <span 
                    className="pill" 
                    style={{ 
                      padding: '3px 10px', 
                      fontSize: 11, 
                      background: complete ? '#e3f6ec' : '#fdf1dc', 
                      color: complete ? '#1f9d6b' : '#d98a0b' 
                    }}
                  >
                    {complete ? 'Completed' : 'Running'}
                  </span>
                </h3>
                <div className="pl">
                  {STEPS.map(([I, t, a, b], i) => (
                    <div key={t} className={'st' + (i < done ? '' : ' p')}>
                      <span className="st-ic"><I size={15} /></span>
                      <h4>{i + 1}. {t}</h4>
                      <small>{a}</small>
                      {b && <small>{b}</small>}
                      {i < done && <CheckCircle2 className="ck" size={15} />}
                      {i < 5 && <ArrowRight className="ar" size={13} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom 3 Columns */}
              <div className="b3">
                <div className="c">
                  <h3><Layers size={16} />Visualizations</h3>
                  <div className="tabs">
                    {Object.keys(V).map(k => (
                      <button key={k} className={tab === k ? 'a' : ''} onClick={() => setTab(k)}>
                        {k}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Cv w={340} h={hh} draw={draw} />
                    </div>
                    <div className="inf">
                      Center:<b>0.000 MHz</b><br />
                      Span:<b>{signalData.samplingRate}</b><br />
                      RBW:<b>10 kHz</b>
                    </div>
                  </div>
                </div>

                <div className="c">
                  <h3><Waves size={16} />Decoded Bitstream View</h3>
                  <div className="tabs">
                    {['Binary', 'Hex', 'ASCII'].map(k => (
                      <button key={k} className={fmt === k ? 'a' : ''} onClick={() => setFmt(k)}>
                        {k}
                      </button>
                    ))}
                  </div>
                  <div className="term">
                    {lines.map((l, i) => (
                      <div key={i}>
                        <i>{String(pg * 32 + i + 1).padStart(4, '0')}</i>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div className="pg">
                    Showing 1,024 bits (of 8,192)
                    <span className="sp" />
                    Page <b>{pg + 1} / 8</b>
                    <button aria-label="Previous page" onClick={() => setPg(p => Math.max(0, p - 1))}>
                      <ChevronLeft size={13} />
                    </button>
                    <button aria-label="Next page" onClick={() => setPg(p => Math.min(7, p + 1))}>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                <div className="c sm">
                  <h3><Signal size={16} />Signal Summary</h3>
                  {[
                    [FileText, 'File Name', signalData.fileName],
                    [Clock, 'Duration', signalData.signalSummary.duration],
                    [Grip, 'Samples', signalData.signalSummary.samples],
                    [Layers, 'Format', signalData.format],
                    [Radio, 'Source Band', signalData.signalSummary.sourceBand],
                    [Activity, 'SNR (Estimated)', signalData.signalSummary.snr]
                  ].map(([I, k, v]) => (
                    <div key={k}>
                      <I size={15} />
                      <span>{k}</span>
                      <b style={{ fontSize: 11 }}>{v}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side Panel */}
            <div className="r">
              <div className="c">
                <h3 style={{ fontSize: 15 }}>Detected Parameters</h3>
                {PARAMS.map(([I, k, v, , sub], i) => (
                  <div className="pr" key={k}>
                    <span className="ic" style={{ width: 24, height: 24, background: 'none' }}>
                      <I size={15} />
                    </span>
                    <span>{k}</span>
                    <b style={{ fontSize: 11.5 }}>{v}{sub ? ' ' + sub : ''}</b>
                    <i className={'lv' + (i === 5 ? ' w' : '')}>{i === 5 ? 'Medium' : 'High'}</i>
                  </div>
                ))}
              </div>

              <div className="c">
                <h3><Timer size={16} />Decoded Output</h3>
                <div className="tabs f">
                  {['Bitstream', 'Header', 'Payload'].map(k => (
                    <button key={k} className={out === k ? 'a' : ''} onClick={() => setOut(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="term" style={{ height: 'auto', background: '#fff', color: '#1b1f27', border: '1px solid #e7e9ee', fontSize: 10.5 }}>
                  {outL.map((l, i) => (
                    <div key={i}>
                      <i>{i + 1}</i>
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              <div className="c">
                <h3>Data Summary</h3>
                {[
                  ['Header (Sync Word)', signalData.dataSummary.syncWord, 'Detected'],
                  ['Payload Length', signalData.dataSummary.payloadLen, 'Detected'],
                  ['CRC Check', signalData.dataSummary.crcCheck, signalData.dataSummary.crcCheck === 'Pass' ? 'Valid' : 'Failed']
                ].map(([k, v, s]) => (
                  <div className="row2" key={k}>
                    <span>{k}</span>
                    <b style={{ fontWeight: 400 }}>{v}</b>
                    <i className={'lv' + (s === 'Failed' ? ' w' : '')} style={{ fontStyle: 'normal' }}>
                      {s}
                    </i>
                  </div>
                ))}
                <div className="ok" style={{ marginTop: 10, opacity: complete ? 1 : .4 }}>
                  <CheckCircle2 size={30} color="#1f9d6b" />
                  <div>
                    <b>Decoding Successful</b>
                    <small>Signal successfully demodulated, de-interleaved, FEC decoded and correlated.</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog for Loading File */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Upload size={18} color="#1f9d6b" /> Ingest & Analyze Signal Capture</h3>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setModalOpen(false)}
              >
                <X size={18} color="#6b7280" />
              </button>
            </div>

            <div className="modal-body">
              {uploadError && (
                <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 14px', borderRadius: 6, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <AlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Dropzone */}
              <label className="dropzone">
                <input 
                  type="file" 
                  accept=".iq,.wav,.raw,.dat,.bin" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleAnalyze(null, e.target.files[0]);
                    }
                  }}
                />
                <div className="dropzone-icon">
                  <Upload size={24} />
                </div>
                <b style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Upload Raw .IQ or .WAV Recording
                </b>
                <span style={{ color: '#6b7280', fontSize: 11 }}>
                  Supports Complex64 IQ, Int16 IQ, RTL-SDR Uint8 raw, and 8/16/24/32-bit PCM/Float WAV
                </span>
              </label>

              <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 12, color: '#374151' }}>Or Select from SIH Space Tech Library:</b>
                <span style={{ fontSize: 10.5, color: '#1f9d6b', fontWeight: 600 }}>Problem Statement SIH26147</span>
              </div>

              <div className="preset-list">
                {[
                  { id: '0412', name: 'capture_20260917_124530.iq', desc: 'VHF Deep Space Downlink Intercept (QPSK • 4.096 Msps • Complex64)' },
                  { id: 'cubesat', name: 'cubesat_telemetry_beacon.iq', desc: 'LEO CubeSat AX.25 Telemetry (BPSK • 1.000 Msps • 9.6 ksps)' },
                  { id: 'noaa', name: 'noaa_19_apt_weather.wav', desc: 'NOAA-19 APT Satellite Image Subcarrier (16-bit PCM • 48 kHz)' },
                  { id: 'dsn', name: 'deep_space_dsn_carrier.iq', desc: 'Deep Space Network S-Band Telemetry (8PSK • 2.048 Msps • LDPC)' },
                  { id: 'hf', name: 'hf_intercept_maritime.wav', desc: 'HF Maritime STANAG 4285 Tactical Link (Stereo IQ WAV • 48 kHz)' }
                ].map(p => (
                  <div 
                    key={p.id} 
                    className="preset-card"
                    onClick={() => handleAnalyze(p.id)}
                  >
                    <div>
                      <b style={{ fontSize: 12, color: '#1f2937' }}>{p.name}</b>
                      <small style={{ display: 'block', color: '#6b7280', fontSize: 10.5, marginTop: 2 }}>{p.desc}</small>
                    </div>
                    <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }}>
                      Analyze
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
