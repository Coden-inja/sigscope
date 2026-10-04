'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Activity, BarChart3, Grip, ShieldCheck, LayoutGrid, Link2, Upload, MoreHorizontal, Radio, Settings, Home, ChevronDown, User, CheckCircle2, ChevronLeft, ChevronRight, ArrowRight, Timer, Layers, Waves, Signal, Clock, AlertTriangle, PlayCircle, PauseCircle, BookOpen, Cpu, Shield } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { fetchIndex, fetchRun, hz, pct, ber, nInt, conf, bitsToBytes, bin, hx, asc } from '../lib/dataload';
import { SystemBlueprintView } from './components/SidebarViews';

const G = '#1b7f5c';
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const jet = t => `rgb(${[1.5 - Math.abs(4 * t - 3), 1.5 - Math.abs(4 * t - 2), 1.5 - Math.abs(4 * t - 1)].map(v => Math.round(cl(v) * 255))})`;

const dLog = (tag, ...args) => {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams(window.location.search);
  if (p.get(tag) === 'true' || p.get('all') === 'true') {
    console.log(`[DEBUG ${tag}]`, ...args);
  }
};

function ax(x, w, h, o) {
  const L = o.l ?? 46, B = 30, T = 8, R = 8, pw = w - L - R, ph = h - T - B, [x0, x1, xs] = o.x, [y0, y1, ys] = o.y, X = v => L + (v - x0) / (x1 - x0) * pw, Y = v => T + (1 - (v - y0) / (y1 - y0)) * ph;
  x.strokeStyle = '#d5d9e0'; x.lineWidth = 1; x.strokeRect(L + .5, T + .5, pw, ph); x.fillStyle = '#6b7280'; x.font = '10px Inter,sans-serif'; x.textAlign = 'center';
  for (let v = x0; v <= x1 + 1e-9; v += xs) x.fillText(o.fx ? o.fx(v) : v.toFixed(1), X(v), h - B + 13);
  x.textAlign = 'right'; for (let v = y0; v <= y1 + 1e-9; v += ys) x.fillText(o.fy ? o.fy(v) : v.toFixed(1), L - 6, Y(v) + 3);
  x.textAlign = 'center'; x.fillText(o.xl, L + pw / 2, h - 4); x.save(); x.translate(10, T + ph / 2); x.rotate(-Math.PI / 2); x.fillText(o.yl, 0, 0); x.restore();
  x.save(); x.beginPath(); x.rect(L, T, pw, ph); x.clip(); return { X, Y, L, T, pw, ph };
}

const EMPTY = (x, w, h, msg) => {
  x.fillStyle = '#9aa1ad'; x.font = '12px Inter,sans-serif'; x.textAlign = 'center';
  x.fillText(msg, w / 2, h / 2);
};

// ---- real-data renderers ----------------------------------------------

const dSpec = (run, zoom) => (x, w, h) => {
  const s = run?.viz?.spectrum;
  if (!s?.power_db?.length) return EMPTY(x, w, h, 'no spectrum');
  dLog('renderingchart', 'dSpec rendering', { zoom, f_len: s.freq.length, p_len: s.power_db.length });
  const f = s.freq, p = s.power_db, fs = s.fs;
  const f0 = f[0], f1 = f[f.length - 1];
  const span = (f1 - f0) / zoom;
  const zf0 = -span / 2, zf1 = span / 2;
  const lo = Math.min(...p), hi = Math.max(...p);
  const a = ax(x, w, h, { x: [zf0, zf1, span / 4], y: [lo, hi, (hi - lo) / 4], fy: v => v.toFixed(0), xl: 'Frequency (kHz, offset from centre)', yl: 'Power (dB)' });
  const { X, Y } = a;
  
  const bw = run.estimates.bandwidth_hz;
  if (bw) { x.fillStyle = 'rgba(31,157,107,.14)'; x.fillRect(X(-bw / 2000), a.T, X(bw / 2000) - X(-bw / 2000), a.ph); }
  
  x.beginPath();
  x.moveTo(X(f0), Y(lo));
  p.forEach((d, i) => x.lineTo(X(f[i]), Y(d)));
  x.lineTo(X(f1), Y(lo));
  x.fillStyle = 'rgba(31,157,107,.12)';
  x.fill();
  
  x.beginPath();
  p.forEach((d, i) => { i ? x.lineTo(X(f[i]), Y(d)) : x.moveTo(X(f[i]), Y(d)) });
  x.strokeStyle = G; x.lineWidth = 1; x.stroke();
  x.restore();
};

const dWf = (run, contrast = 1, zoom = 1) => (x, w, h) => {
  const d = run?.viz?.waterfall;
  if (!d?.power?.length) return EMPTY(x, w, h, 'no waterfall');
  dLog('renderingchart', 'dWf rendering', { contrast, zoom, rows: d.power.length, cols: d.power[0]?.length });
  const M = d.power, f = d.freq, t = d.time;
  const f0 = f[0], f1 = f[f.length - 1];
  const fullSpan = (f1 - f0);
  const z = Math.max(1, zoom);
  const span = fullSpan / z;
  const zf0 = -span / 2, zf1 = span / 2;
  
  const a = ax(x, w, h, { 
    x: [t[0], t[t.length - 1], (t[t.length - 1] - t[0]) / 4], 
    y: [zf0, zf1, span / 4], 
    fx: v => v.toFixed(0), 
    xl: 'Time (ms)', 
    yl: 'Frequency (kHz)' 
  });
  const N = M.length, Mq = M[0].length;

  for (let i = 0; i < N; i++) {
    const xPos = a.L + i * a.pw / N;
    const colW = a.pw / N + 0.6;
    for (let j = 0; j < Mq; j++) {
      const freqVal = f0 + (j / (Mq - 1)) * fullSpan;
      if (freqVal < zf0 || freqVal > zf1) continue;
      const yNorm = (freqVal - zf0) / span;
      const yPos = a.T + (1 - yNorm) * a.ph;
      const binH = (a.ph / (Mq / z)) + 0.8;
      x.fillStyle = jet(cl((M[i][j] / 127) * contrast));
      x.fillRect(xPos, yPos - binH / 2, colW, binH);
    }
  }
  x.restore();
};

const MODCOLOR = { BPSK: '#22b8e6', QPSK: '#0f6b4a', '8PSK': '#7a3fc0', '16QAM': '#f08a1c', '64QAM': '#d6409f' };

const dCon = (run) => (x, w, h) => {
  const c = run?.viz?.constellation;
  if (!c?.i?.length) return EMPTY(x, w, h, 'no constellation');
  dLog('renderingchart', 'dCon rendering', { points: c.i.length });
  const m = Math.max(...c.i.map(Math.abs), ...c.q.map(Math.abs)) * 1.15 || 1;
  const a = ax(x, w, h, { x: [-m, m, m / 2], y: [-m, m, m / 2], xl: 'In-phase (normalised)', yl: 'Quadrature', l: 40 });
  const col = MODCOLOR[run.demod.modulation_used] || G;
  x.strokeStyle = '#d5d9e0'; x.beginPath(); x.moveTo(a.X(0), a.T); x.lineTo(a.X(0), a.T + a.ph); x.moveTo(a.L, a.Y(0)); x.lineTo(a.L + a.pw, a.Y(0)); x.stroke();
  x.fillStyle = col;
  for (let i = 0; i < c.i.length; i++) {
    x.beginPath();
    x.arc(a.X(c.i[i]), a.Y(c.q[i]), 1.5, 0, 2 * Math.PI);
    x.fill();
  }
  x.restore();
};

const dIQ = (run) => (x, w, h) => {
  const q = run?.viz?.iq;
  if (!q?.i?.length) return EMPTY(x, w, h, 'no IQ samples');
  const n = q.i.length, a = ax(x, w, h, { x: [0, n - 1, n / 4], y: [-1.15, 1.15, .5], fx: v => v.toFixed(0), xl: 'Sample index', yl: 'Amplitude (normalised)' });
  ['i', 'q'].forEach((k, j) => {
    x.beginPath();
    for (let i = 0; i < n; i++) { const y = q[k][i]; i ? x.lineTo(a.X(i), a.Y(y)) : x.moveTo(a.X(i), a.Y(y)) }
    x.strokeStyle = j ? '#e08a1c' : G; x.lineWidth = .8; x.stroke();
  });
  x.restore();
};

const dEye = (run) => (x, w, h) => {
  const e = run?.viz?.eye;
  if (!e?.i?.length) return EMPTY(x, w, h, 'no eye diagram');
  dLog('renderingchart', 'dEye rendering', { traces: e.i.length, samples: e.t.length });
  const nT = e.t.length, nS = e.i.length;
  const a = ax(x, w, h, { x: [0, 1, .25], y: [-1.2, 1.2, .6], fx: v => v.toFixed(2), xl: 'One symbol period (Ts)', yl: 'Amplitude' });
  
  // Center threshold reference line
  x.strokeStyle = '#e7e9ee';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(a.L, a.Y(0));
  x.lineTo(a.L + a.pw, a.Y(0));
  x.stroke();

  for (let s = 0; s < nS; s++) {
    x.beginPath();
    for (let t = 0; t < nT; t++) { const y = e.i[s][t]; t ? x.lineTo(a.X(e.t[t]), a.Y(y)) : x.moveTo(a.X(e.t[t]), a.Y(y)) }
    x.strokeStyle = 'rgba(27,127,92,.42)'; x.lineWidth = .9; x.stroke();
  }
  x.restore();
};

function Cv({ w, h, draw }) {
  const r = useRef();
  useEffect(() => {
    const c = r.current; if (!c) return;
    const x = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0);
    draw(x, w, h);
  }, [w, h, draw]);
  return <canvas ref={r} />;
}

const Sel = ({ v, onChange, children }) => <select className="sel" value={v} onChange={e => onChange?.(e.target.value)}>{children || <option>{v}</option>}</select>;

const STEPS = [[FileText, 'File Ingest', 'IQ / .wav'], [Activity, 'Parameter Estimation', 'Sampling, Modulation'], [Grip, 'Demodulation', 'Carrier + timing'], [LayoutGrid, 'De-Interleaving', 'Searched, abstains if ambiguous'], [ShieldCheck, 'FEC Decoding', 'Conv. code (CommPy)'], [Link2, 'Bitstream Correlation', 'Preamble-locked phase']];

function ClockWidget() {
  const [now, setNow] = useState(null);
  useEffect(() => { const f = () => setNow(new Date()); f(); const i = setInterval(f, 1000); return () => clearInterval(i) }, []);
  return <div className="clk">{now ? now.toLocaleTimeString('en-GB') : '--:--:--'}<small>{now ? now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small></div>;
}

export default function Page() {
  const [idx, setIdx] = useState(null), [err, setErr] = useState(null);
  const [sel, setSel] = useState(null), [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Eye'), [out, setOut] = useState('Metrics');
  const [fmt, setFmt] = useState('Binary'), [pg, setPg] = useState(0);
  const [navTab, setNavTab] = useState('Dashboard');
  const [zoom, setZoom] = useState(1);
  const [wfZoom, setWfZoom] = useState(1);
  const [wfContrast, setWfContrast] = useState(1);
  const [runKey, setRunKey] = useState(0);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('view') === 'blueprint') {
        setNavTab('System Blueprint');
      }
    }
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const i = setInterval(() => setLoadingStep(s => Math.min(s + 1, 5)), 600);
    return () => clearInterval(i);
  }, [loading]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      // Reload index to get the new file
      const i = await fetchIndex();
      setIdx(i);
      setSel(data.case_id);
      setRunKey(k => k + 1);
    } catch (err) {
      setErr("Analysis failed: " + String(err.message || err));
      setLoading(false);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  useEffect(() => { fetchIndex().then(i => { setIdx(i); setSel(i.cases[0]?.id ?? null); }).catch(e => setErr(String(e.message || e))); }, []);
  useEffect(() => { 
    if (sel) { 
      setLoading(true); 
      fetchRun(sel).then(r => { 
        setRun(r); 
        setLoading(false); 
        // Auto-zoom spectrum and waterfall based on bandwidth
        if (r?.estimates?.bandwidth_hz && r?.source?.fs_hz) {
          const target = r.estimates.bandwidth_hz * 4; // Fill 25% of the screen with signal
          setZoom(Math.max(1, Math.min(100, r.source.fs_hz / target)));
          const optWfZoom = Math.max(1, Math.min(25, (r.source.fs_hz / (r.estimates.bandwidth_hz * 2.8))));
          setWfZoom(parseFloat(optWfZoom.toFixed(1)));
        } else {
          setZoom(1);
          setWfZoom(1);
        }
      }).catch(e => { setErr(String(e.message || e)); setLoading(false); }); 
    } 
  }, [sel, runKey]);
  useEffect(() => { setPg(0); setTab('Eye'); }, [sel, runKey]);

  const drawSymbolPlot = useMemo(() => {
    if (tab === 'Eye') return dEye(run);
    if (tab === 'IQ Plot') return dIQ(run);
    return dCon(run);
  }, [tab, run]);

  const drawSpecPlot = useMemo(() => dSpec(run, zoom), [run, zoom]);
  const drawWfPlot = useMemo(() => dWf(run, wfContrast, wfZoom), [run, wfContrast, wfZoom]);

  const bytes = useMemo(() => bitsToBytes(run?.bits), [run]);
  const LPP = 14;
  const lines = useMemo(() => {
    const n = fmt === 'Binary' ? 4 : 16, o = [];
    for (let i = 0; i < bytes.length; i += n) {
      const s = bytes.slice(i, i + n);
      o.push(fmt === 'Binary' ? s.map(bin).join('') : fmt === 'Hex' ? s.map(hx).join(' ') : s.map(asc).join(''));
    }
    return o;
  }, [bytes, fmt]);

  const maxPage = Math.max(0, Math.ceil(lines.length / LPP) - 1);
  const visible = lines.slice(pg * LPP, pg * LPP + LPP);
  useEffect(() => { if (pg > maxPage) setPg(maxPage); }, [pg, maxPage]);

  const est = run?.estimates, dem = run?.demod, src = run?.source;
  const caseMeta = idx?.cases?.find(c => c.id === sel);

  const PARAMS = useMemo(() => {
    if (!run) return [];
    return [
      [Activity, 'Sampling Rate', hz(src.fs_hz), est.symbol_rate_confidence, ''],
      [BarChart3, 'Occupied BW', hz(est.bandwidth_hz), null, ''],
      [Grip, 'Symbol Rate', hz(est.symbol_rate_bps), est.symbol_rate_confidence, `sps ${est.sps ?? 'n/a'}`],
      [Activity, 'Modulation (est.)', est.modulation ?? 'n/a', est.modulation_confidence, est.amc_agrees_with_truth === false ? 'MISC' : ''],
      [ShieldCheck, 'Modulation (used)', dem.modulation_used, dem.confidence_reliable ? dem.confidence : null, dem.assisted ? 'assisted' : 'blind'],
      [LayoutGrid, 'Measured BER', ber(dem.ber), null, ''],
    ];
  }, [run]);

  const STEPDATA = useMemo(() => {
    if (!run) return [];
    const s = Object.fromEntries((run.stages || []).map(x => [x.stage, x.ms]));
    return [
      { i: FileText, t: 'File Ingest', a: `${nInt(src.n_samples)} samples`, ms: s.ingest },
      { i: Activity, t: 'Parameter Estimation', a: `Rs ${hz(est.symbol_rate_bps)} · ${est.modulation ?? 'n/a'}`, ms: s.estimate },
      { i: Grip, t: 'Demodulation', a: `${dem.modulation_used} · ${nInt(dem.n_bits)} bits`, ms: s.demodulate },
      { i: LayoutGrid, t: 'De-Interleaving', a: dem.interleaver ?? (dem.coded ? 'searched, none' : 'n/a'), ms: null },
      { i: ShieldCheck, t: 'FEC Decoding', a: dem.coded ? (dem.decoded ? `conv r=1/2 · BER ${ber(dem.ber)}` : 'unresolved') : 'n/a (uncoded)', ms: null },
      { i: Link2, t: 'Phase / Bitstream', a: dem.phase_resolved ? 'preamble-locked' : 'unresolved', ms: null },
    ];
  }, [run]);

  if (err) return <div className="shell"><div className="main"><div className="c"><h3><AlertTriangle size={16} /> No analysis data</h3><p style={{ fontSize: 12, color: '#6b7280' }}>{err}</p><code style={{ fontSize: 11 }}>python scripts/analyze.py</code></div></div></div>;
  if (!idx) return <div className="shell"><div className="main"><div className="c"><p>Loading…</p></div></div></div>;

  const totalMs = run?.elapsed_ms ?? 0;
  const reliable = dem?.confidence_reliable;

  return <div className="shell">
    <Sidebar activeNavTab={navTab} onSelectTab={setNavTab} />
    <div className="content-area">
      <header className="top"><span className="t">From Raw Waveforms to Decoded Intelligence</span>
        <div className="off"><i /><div><b>Offline Mode</b><small>Local Processing</small></div></div>
        <ClockWidget />
        <div className="usr"><span className="av"><User size={18} /></span><div><b style={{ fontSize: 12 }}>Analyst</b><small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>NTRO</small></div><ChevronDown size={14} /></div></header>
      <div style={{ position: 'relative', overflowY: 'auto' }}>
        <div className="main" style={{ paddingBottom: 60 }}>
          {navTab === 'System Blueprint' ? (
            <div className="c doc" style={{ padding: 0, maxWidth: 1120, margin: '20px auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <SystemBlueprintView />
            </div>
          ) : (
            <>
              <div className="c fh"><span className="fic"><FileText size={24} /></span><div><h2>{sel ?? '—'}</h2><small>{src ? `${src.format} · ${hz(src.fs_hz)} · ${src.duration_s}s · ${nInt(src.n_samples)} samples` : 'loading…'}</small></div>
          <span className="sp" />
          <label className="sel"><select value={sel ?? ''} onChange={e => setSel(e.target.value)}>{idx.cases.map(c => <option key={c.id} value={c.id}>{c.id} — est. {c.modulation ?? 'n/a'}</option>)}</select></label>
          <span className={'pill' + (reliable ? '' : ' w')}>{reliable ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{reliable ? 'Decoded' : 'Decoded (unverified)'}</span>
          
          {src?.file?.endsWith('.wav') && (
            <>
              <button className="btn sq" style={{ width: 'auto', padding: '0 12px', display: 'flex', gap: 6, marginLeft: 10, borderColor: playing ? '#1f9d6b' : '', background: playing ? '#eaf7f0' : '' }} onClick={() => { if (audioRef.current) { if (playing) audioRef.current.pause(); else audioRef.current.play(); setPlaying(!playing); } }}>
                {playing ? <PauseCircle size={14} color="#1f9d6b" /> : <PlayCircle size={14} />} {playing ? 'Pause' : 'Play Audio'}
              </button>
              <audio ref={audioRef} src={`/api/audio?f=${src.file}`} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
            </>
          )}

          <span>Processing: <b>{(totalMs / 1000).toFixed(2)}s</b></span><span className="sp" />
          
          <input type="file" accept=".iq,.wav" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} />
          <button className="btn sq" style={{ width: 'auto', padding: '0 12px', display: 'flex', gap: 6 }} onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Load File</button>
          
          <button className="btn sq" title="Export Report" onClick={() => window.print()}><FileText size={14} /></button>
          <button className="btn sq"><MoreHorizontal size={16} /></button></div>
        <div className="grid"><div className="l">
          <div className="c"><h3 style={{ fontSize: 15 }}>Detected Parameters</h3>
            <div className="tiles">
              {PARAMS.map(([I, k, v, c, sub], i) => <div className="tile" key={k} style={{ opacity: run ? 1 : .35 }}>
                <div className="tile-top"><span className="tile-ic"><I size={14} /></span><span className="tile-lbl">{k}</span></div>
                <div className="tile-val"><b>{v}</b>{sub && <span className="tile-sub">{sub}</span>}</div>
                <div className="tile-ftr">{k === 'Measured BER' ? (run?.truth?.bits ? 'vs ground truth' : 'no ground truth') : `Confidence: ${c == null ? 'n/a' : pct(c)}`}</div>
              </div>)}
            </div>
            {est?.amc_agrees_with_truth === false && <div className="ok" style={{ background: '#fdf1dc', marginTop: 10 }}><AlertTriangle size={26} color="#d98a0b" /><div><b>AMC disagrees with ground truth</b><small>Estimated {est.modulation}, actual {run.truth.modulation}. Modulation for demodulation was taken from ground truth (assisted).</small></div></div>}
          </div>
          <div className="cs">
            <div className="c">
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><Activity size={16} /> Spectrum</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 'normal' }}>
                  Zoom: <input type="range" min="1" max="100" value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: 80 }} />
                </div>
              </h3>
              <Cv w={330} h={230} draw={drawSpecPlot} />
            </div>
            <div className="c">
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span><Grip size={16} /> <span>Waterfall</span> <em>(STFT)</em></span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 'normal' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Zoom: <input type="range" min="1" max="25" step="0.5" value={wfZoom} onChange={e => setWfZoom(Number(e.target.value))} style={{ width: 55 }} title={`Waterfall Zoom: ${wfZoom.toFixed(1)}x`} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Contrast: <input type="range" min="0.4" max="2.5" step="0.1" value={wfContrast} onChange={e => setWfContrast(Number(e.target.value))} style={{ width: 55 }} title={`Waterfall Contrast: ${wfContrast.toFixed(1)}x`} />
                  </div>
                </div>
              </h3>
              <div className="cb"><div style={{ flex: 1, minWidth: 0 }}><Cv w={290} h={230} draw={drawWfPlot} /></div><div className="bar" /><div className="cbl">{[0, -25, -50, -75, -100].map(v => <span key={v}>{v} dB</span>)}</div></div>
            </div>
            <div className="c">
              <h3>
                <div className="tabs f" style={{ margin: '-4px 0' }}>
                  {['Eye', 'Constellation', 'IQ Plot'].map(k => <button key={k} className={tab === k ? 'a' : ''} onClick={() => setTab(k)}>{k}</button>)}
                </div>
                <span className="sp" />
                <Sel v={dem?.modulation_used ?? '—'} />
              </h3>
              <Cv w={330} h={230} draw={drawSymbolPlot} />
            </div>
          </div>
          <div className="c"><h3><Activity size={16} />Analysis Pipeline<span className="sp" /><span className="pill" style={{ padding: '3px 10px', fontSize: 11, background: '#e3f6ec', color: '#1f9d6b' }}>{loading ? 'Analyzing...' : 'Measured'}</span></h3>
            <div className="pl">
              {STEPDATA.map((s, i) => {
                const isActive = loading && loadingStep === i;
                const isPast = loading && i < loadingStep;
                return (
                  <div key={s.t} className={'st' + (!run && !loading ? ' p' : '')} style={{
                    borderColor: isActive ? '#1f9d6b' : '',
                    boxShadow: isActive ? '0 0 0 1px #1f9d6b' : '',
                    opacity: (loading && !isActive && !isPast) ? 0.4 : 1,
                    transition: 'all 0.3s ease'
                  }}>
                    <span className="st-ic" style={{ background: isActive ? '#eaf7f0' : '', color: isActive ? '#1f9d6b' : '' }}>
                      <s.i size={15} style={{ animation: isActive ? 'pulse 1s infinite' : 'none' }} />
                    </span>
                    <h4>{i + 1}. {s.t}</h4>
                    <small>{loading ? (isActive ? 'Processing...' : (isPast ? 'Done' : 'Waiting')) : s.a}</small>
                    {s.ms != null && !loading && <small>{s.ms} ms</small>}
                    {run && s.ms != null && !loading && <CheckCircle2 className="ck" size={15} />}
                    {isPast && <CheckCircle2 className="ck" size={15} color="#1f9d6b" />}
                    {i < 5 && <ArrowRight className="ar" size={13} />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="b3">
            <div className="c" style={{ flex: 1 }}><h3><Waves size={16} />Decoded Bitstream</h3><div className="tabs">{['Binary', 'Hex', 'ASCII'].map(k => <button key={k} className={fmt === k ? 'a' : ''} onClick={() => setFmt(k)}>{k}</button>)}</div>
              <div className="term">{visible.length ? visible.map((l, i) => <div key={pg * LPP + i}><i>{String(pg * LPP + i + 1).padStart(4, '0')}</i>{l}</div>) : <div><i>----</i>no bits</div>}</div>
              <div className="pg">Showing {nInt(visible.length)} lines of {nInt(lines.length)}<span className="sp" />Page <b>{pg + 1}</b> / {maxPage + 1}<button aria-label="Previous page" disabled={pg === 0} onClick={() => setPg(p => Math.max(0, p - 1))}><ChevronLeft size={13} /></button><button aria-label="Next page" disabled={pg >= maxPage} onClick={() => setPg(p => Math.min(maxPage, p + 1))}><ChevronRight size={13} /></button></div></div>
            <div className="c sm"><h3><Signal size={16} />Signal Summary</h3>{[
              [FileText, 'Case', sel ?? '—'], [Clock, 'Duration', src ? src.duration_s + ' s' : 'n/a'],
              [Grip, 'Samples', nInt(src?.n_samples)], [Layers, 'Format', 'Complex64 (IQ)'],
              [Activity, 'Measured SNR', src?.measured_snr_db != null ? src.measured_snr_db + ' dB' : 'n/a'],
              [Radio, 'True SNR (synthetic)', run?.truth?.snr_db != null ? run.truth.snr_db + ' dB' : 'n/a'],
            ].map(([I, k, v]) => <div key={k}><I size={15} /><span>{k}</span><b style={{ fontSize: 11 }}>{v}</b></div>)}</div></div>
        </div>
          <div className="r">
            <div className="c"><h3 style={{ fontSize: 15 }}>Detected Parameters</h3>{PARAMS.map(([I, k, v, c, sub], i) => <div className="pr" key={k}><span className="ic" style={{ width: 24, height: 24, background: 'none' }}><I size={15} /></span><span>{k}</span><b style={{ fontSize: 11.5 }}>{v}{sub ? ' ' + sub : ''}</b><i className={'lv' + (c != null && c < 0.5 ? ' w' : '')}>{c == null ? 'n/a' : c >= 0.9 ? 'High' : c >= 0.5 ? 'Medium' : 'Low'}</i></div>)}</div>
            <div className="c"><h3><Timer size={16} />Demodulation Details</h3><div className="tabs f">{['Metrics', 'Notes'].map(k => <button key={k} className={out === k ? 'a' : ''} onClick={() => setOut(k)}>{k}</button>)}</div>
              <div className="term" style={{ height: 'auto', background: '#fff', color: '#1b1f27', border: '1px solid #e7e9ee', fontSize: 10.5 }}>
                {out === 'Metrics' ? [['Modulation (est.)', est?.modulation], ['Modulation (used)', dem?.modulation_used], ['Assisted', dem?.assisted ? 'yes' : 'no'], ['Symbol rate', hz(est?.symbol_rate_bps)], ['Rs method', est?.symbol_rate_method], ['FEC', dem?.coded ? 'conv r=1/2' : 'none (uncoded)'], ['Interleaver', dem?.interleaver ?? (dem?.coded ? 'searched, unresolved' : 'n/a')], ['Interleaver margin', dem?.interleaver_margin ?? 'n/a'], ['Rotation resolved', dem?.rotation != null ? `${dem.rotation} of ${dem.rotation_order}` : 'n/a'], ['Preamble agreement', dem?.preamble_agreement ?? 'n/a'], ['BER', ber(dem?.ber)], ['Bits', nInt(dem?.n_bits)], ['Symbols', nInt(dem?.n_symbols)], ['Confidence', conf(dem?.confidence)], ['Phase resolved', dem?.phase_resolved ? 'yes' : 'no'], ['Total time', totalMs + ' ms']].map(([k, v]) => <div key={k}><i>{k.slice(0, 4)}</i>{k.padEnd(18, ' ')}{String(v ?? 'n/a')}</div>)
                    : [dem?.reason, dem?.interleaver_note, dem?.note, est?.amc_note, est?.amc_abstain_reason].filter(Boolean).map((v, i) => <div key={i}><i>{''}</i>{v}</div>)}
              </div></div>
            <div className="c"><h3>Data Summary</h3>{[
              ['Modulation (est.)', est?.modulation ?? 'n/a', est?.amc_agrees_with_truth === false ? 'Disagrees' : 'Agrees'],
              ['Symbol rate', hz(est?.symbol_rate_bps), est?.symbol_rate_confidence >= 0.9 ? 'High conf' : 'Low conf'],
              ['Phase class', dem?.phase_resolved ? 'Resolved' : 'Unresolved', dem?.phase_resolved ? 'Preamble' : 'Ambiguous'],
              ['FEC', dem?.coded ? (dem.decoded ? 'Decoded' : 'Unresolved') : 'Uncoded', dem?.coded ? (dem.decoded ? `conv r=1/2, BER ${ber(dem?.ber)}` : 'abstained') : 'n/a'],
              ['De-interleave', dem?.coded ? (dem.interleaver ?? 'unresolved') : 'n/a', dem?.coded ? (dem.interleaver ? `margin ${dem.interleaver_margin ?? 'n/a'}` : 'no candidate separated') : 'n/a'],
              ['BER (synthetic truth)', ber(dem?.ber), dem?.ber === 0 ? 'Error-free' : dem?.ber < 0.01 ? 'Low' : 'High'],
            ].map(([k, v, s]) => <div className="row2" key={k}><span>{k}</span><b style={{ fontWeight: 400 }}>{v}</b><i className="lv" style={{ fontStyle: 'normal' }}>{s}</i></div>)}
              <div className="ok" style={{ marginTop: 10, opacity: run ? 1 : .4 }}>
                {reliable ? <CheckCircle2 size={30} color="#1f9d6b" /> : <AlertTriangle size={30} color="#d98a0b" />}
                <div>
                  <b>{reliable ? 'Demodulation verified' : 'Demodulated, confidence withheld'}</b>
                  <small>{reliable ? `Measured BER ${ber(dem?.ber)} against ground truth. Rotation class pinned by known preamble.` : 'Rotation class could not be pinned, so confidence is withheld rather than guessed.'}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
        </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse { 0% { opacity: 0.6; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.6; transform: scale(0.95); } }
      `}} />
      </div></div></div>
}

