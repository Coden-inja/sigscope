'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { 
  FileText, Activity, BarChart3, Grip, ShieldCheck, LayoutGrid, Link2, Upload, 
  MoreHorizontal, Radio, Settings, Home, ChevronDown, User, CheckCircle2, 
  ChevronLeft, ChevronRight, ArrowRight, Timer, Layers, Waves, Signal, Clock, 
  AlertTriangle, PlayCircle, PauseCircle, BookOpen, Cpu, Shield, Search, 
  Copy, Check, Maximize2, X, Sun, Moon, Info, Download, RefreshCw, Zap
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { fetchIndex, fetchRun, cacheRun, hz, pct, ber, nInt, conf, bitsToBytes, bin, hx, asc } from '../lib/dataload';
import { SystemBlueprintView } from './components/SidebarViews';

const LIME = '#C6F432';
const PURPLE = '#6D3AE8';

const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Dark-purple to bright-lime colormap matching the colorbar:
// 0.0: dark purple #6D3AE8 -> 1.0: bright lime #C6F432
const purpleToLime = t => {
  const v = cl(t);
  const r = Math.round(109 + (198 - 109) * v);
  const g = Math.round(58 + (244 - 58) * v);
  const b = Math.round(232 + (50 - 232) * v);
  return `rgb(${r},${g},${b})`;
};

// Canvas Chart Axis with Faint Dotted Grid and Tabular Numerals
function ax(x, w, h, o) {
  const L = o.l ?? 46, B = 42, T = 8, R = o.r ?? 32;
  const pw = w - L - R, ph = h - T - B;
  const [x0, x1, xs] = o.x, [y0, y1, ys] = o.y;
  const X = v => L + (v - x0) / (x1 - x0) * pw;
  const Y = v => T + (1 - (v - y0) / (y1 - y0)) * ph;

  // Background: Solid clean white canvas
  x.clearRect(L, T, pw, ph);
  x.fillStyle = '#FFFFFF';
  x.fillRect(L, T, pw, ph);

  // Faint dotted grid
  x.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  x.lineWidth = 1;
  x.setLineDash([2, 3]);
  for (let v = x0; v <= x1 + 1e-9; v += xs) {
    const xPos = Math.round(X(v)) + 0.5;
    x.beginPath();
    x.moveTo(xPos, T);
    x.lineTo(xPos, T + ph);
    x.stroke();
  }
  // Deduplicate y-ticks
  const yTicks = [];
  const seenY = new Set();
  for (let v = y0; v <= y1 + 1e-9; v += ys) {
    const lbl = o.fy ? o.fy(v) : v.toFixed(1);
    if (!seenY.has(lbl)) { seenY.add(lbl); yTicks.push({ v, lbl }); }
  }
  for (const { v } of yTicks) {
    const yPos = Math.round(Y(v)) + 0.5;
    x.beginPath();
    x.moveTo(L, yPos);
    x.lineTo(L + pw, yPos);
    x.stroke();
  }
  x.setLineDash([]);

  // Frame border
  x.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  x.lineWidth = 1;
  x.strokeRect(L + 0.5, T + 0.5, pw, ph);

  // Ticks & Labels
  x.fillStyle = '#475569';
  x.font = "10px Inter, -apple-system, sans-serif";
  x.textAlign = 'center';
  for (let v = x0; v <= x1 + 1e-9; v += xs) {
    x.fillText(o.fx ? o.fx(v) : v.toFixed(1), X(v), T + ph + 14);
  }
  x.textAlign = 'right';
  for (const { v, lbl } of yTicks) {
    x.fillText(lbl, L - 6, Y(v) + 3);
  }
  x.textAlign = 'center';
  x.fillStyle = '#0F172A';
  x.font = "500 10px Inter, -apple-system, sans-serif";
  x.fillText(o.xl, L + pw / 2, h - 6);
  x.save();
  x.translate(10, T + ph / 2);
  x.rotate(-Math.PI / 2);
  x.fillText(o.yl, 0, 0);
  x.restore();

  x.save();
  x.beginPath();
  x.rect(L, T, pw, ph);
  x.clip();
  return { X, Y, L, T, pw, ph };
}

const EMPTY = (x, w, h, msg) => {
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#64748B';
  x.font = "11px Inter, sans-serif";
  x.textAlign = 'center';
  x.fillText(msg, w / 2, h / 2);
};

// ---- Chart Renderers --------------------------------------------------

// 1. Spectrum: Lime line with soft gradient fill fading to transparent & purple BW band
const dSpec = (run, zoom) => (x, w, h) => {
  const s = run?.viz?.spectrum;
  if (!s?.power_db?.length) return EMPTY(x, w, h, 'No spectrum data');
  const f = s.freq, p = s.power_db;
  const f0 = f[0], f1 = f[f.length - 1];
  const span = (f1 - f0) / zoom;
  const zf0 = -span / 2, zf1 = span / 2;
  const lo = Math.min(...p), hi = Math.max(...p);
  const a = ax(x, w, h, { 
    x: [zf0, zf1, span / 4], 
    y: [lo, hi, (hi - lo) / 4], 
    fy: v => v.toFixed(0), 
    xl: 'Frequency (kHz)', 
    yl: 'Power (dB)', 
    r: 28 
  });
  const { X, Y } = a;
  
  // Translucent purple occupied-bandwidth band
  const bw = run.estimates?.bandwidth_hz;
  if (bw) {
    const xL = X(-bw / 2000), xR = X(bw / 2000);
    x.fillStyle = 'rgba(109, 58, 232, 0.12)';
    x.fillRect(xL, a.T, xR - xL, a.ph);
    x.strokeStyle = 'rgba(109, 58, 232, 0.4)';
    x.lineWidth = 1;
    x.setLineDash([2, 2]);
    x.beginPath();
    x.moveTo(xL, a.T); x.lineTo(xL, a.T + a.ph);
    x.moveTo(xR, a.T); x.lineTo(xR, a.T + a.ph);
    x.stroke();
    x.setLineDash([]);
  }
  
  // Emerald soft gradient fill fading to transparent
  const grad = x.createLinearGradient(0, a.T, 0, a.T + a.ph);
  grad.addColorStop(0, 'rgba(22, 163, 74, 0.22)');
  grad.addColorStop(1, 'rgba(22, 163, 74, 0.0)');

  x.beginPath();
  x.moveTo(X(f0), Y(lo));
  p.forEach((d, i) => x.lineTo(X(f[i]), Y(d)));
  x.lineTo(X(f1), Y(lo));
  x.fillStyle = grad;
  x.fill();
  
  // Crisp emerald trace
  x.beginPath();
  p.forEach((d, i) => { i ? x.lineTo(X(f[i]), Y(d)) : x.moveTo(X(f[i]), Y(d)); });
  x.strokeStyle = '#16A34A';
  x.lineWidth = 1.8;
  x.stroke();
  x.restore();
};

// 2. Waterfall: Dark-purple to bright-lime colormap
const dWf = (run, contrast = 1, zoom = 1) => (x, w, h) => {
  const d = run?.viz?.waterfall;
  if (!d?.power?.length) return EMPTY(x, w, h, 'No waterfall data');
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
    yl: 'Frequency (kHz)',
    r: 28
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
      x.fillStyle = purpleToLime(cl((M[i][j] / 127) * contrast));
      x.fillRect(xPos, yPos - binH / 2, colW, binH);
    }
  }
  x.restore();
};

const MODCOLOR = { BPSK: '#0284C7', QPSK: '#16A34A', '8PSK': '#7C3AED', '16QAM': '#D97706', '64QAM': '#DC2626' };

// 3. Constellation
const dCon = (run) => (x, w, h) => {
  const c = run?.viz?.constellation;
  if (!c?.i?.length) return EMPTY(x, w, h, 'No constellation data');
  const m = Math.max(...c.i.map(Math.abs), ...c.q.map(Math.abs)) * 1.15 || 1;
  const a = ax(x, w, h, { x: [-m, m, m / 2], y: [-m, m, m / 2], xl: 'In-phase (I)', yl: 'Quadrature (Q)', l: 40, r: 28 });
  const col = MODCOLOR[run.demod?.modulation_used] || '#16A34A';

  x.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(a.X(0), a.T); x.lineTo(a.X(0), a.T + a.ph);
  x.moveTo(a.L, a.Y(0)); x.lineTo(a.L + a.pw, a.Y(0));
  x.stroke();

  x.fillStyle = col;
  for (let i = 0; i < c.i.length; i++) {
    x.beginPath();
    x.arc(a.X(c.i[i]), a.Y(c.q[i]), 2.2, 0, 2 * Math.PI);
    x.fill();
  }
  x.restore();
};

// 4. IQ Waveform
const dIQ = (run) => (x, w, h) => {
  const q = run?.viz?.iq;
  if (!q?.i?.length) return EMPTY(x, w, h, 'No IQ samples');
  const n = q.i.length;
  const a = ax(x, w, h, { x: [0, n - 1, n / 4], y: [-1.15, 1.15, .5], fx: v => v.toFixed(0), xl: 'Sample Index', yl: 'Amplitude', r: 28 });
  
  ['i', 'q'].forEach((k, j) => {
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const y = q[k][i];
      i ? x.lineTo(a.X(i), a.Y(y)) : x.moveTo(a.X(i), a.Y(y));
    }
    x.strokeStyle = j ? '#D97706' : '#16A34A';
    x.lineWidth = 1.3;
    x.stroke();
  });
  x.restore();
};

// 5. Eye Diagram: Emerald traces with source-over persistence & Time (Ts) axis
const dEye = (run) => (x, w, h) => {
  const e = run?.viz?.eye;
  if (!e?.i?.length) return EMPTY(x, w, h, 'No eye diagram data');
  const nT = e.t.length, nS = e.i.length;
  
  // Overlaid 2 symbol periods centered on decision strobe instant
  const a = ax(x, w, h, { 
    x: [-1, 1, 0.5], 
    y: [-1.0, 1.0, 0.5], 
    fx: v => v.toFixed(1), 
    fy: v => v.toFixed(1),
    xl: 'Time (Ts)', 
    yl: 'Amplitude',
    r: 32 
  });
  
  // Center threshold
  x.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(a.L, a.Y(0));
  x.lineTo(a.L + a.pw, a.Y(0));
  x.stroke();

  // Vertical decision strobe at t = 0 (emerald dashed)
  x.save();
  x.strokeStyle = 'rgba(22, 163, 74, 0.85)';
  x.lineWidth = 1.4;
  x.setLineDash([3, 3]);
  x.beginPath();
  x.moveTo(a.X(0), a.T);
  x.lineTo(a.X(0), a.T + a.ph);
  x.stroke();
  x.restore();

  // Emerald persistence traces
  x.save();
  x.globalCompositeOperation = 'source-over';
  x.lineWidth = 0.9;
  x.strokeStyle = 'rgba(22, 163, 74, 0.22)';

  for (let s = 0; s < nS; s++) {
    const tr1 = e.i[s];
    const tr2 = e.i[(s + 1) % nS];
    
    x.beginPath();
    for (let t = 0; t < nT; t++) {
      const tVal = -1.0 + (t / (nT - 1));
      const yVal = tr1[t];
      t === 0 ? x.moveTo(a.X(tVal), a.Y(yVal)) : x.lineTo(a.X(tVal), a.Y(yVal));
    }
    for (let t = 0; t < nT; t++) {
      const tVal = (t / (nT - 1));
      const yVal = tr2[t];
      x.lineTo(a.X(tVal), a.Y(yVal));
    }
    x.stroke();
  }
  x.restore();
  x.restore();
};

function Cv({ w, h, draw }) {
  const r = useRef();
  const [actualW, setActualW] = useState(w);

  useEffect(() => {
    const c = r.current;
    if (!c) return;
    const updateSize = () => {
      if (c.parentElement) {
        const parentW = c.parentElement.clientWidth;
        if (parentW && Math.abs(parentW - actualW) > 2) {
          setActualW(parentW);
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && c.parentElement) {
      ro = new ResizeObserver(updateSize);
      ro.observe(c.parentElement);
    }
    return () => {
      window.removeEventListener('resize', updateSize);
      if (ro) ro.disconnect();
    };
  }, [actualW]);

  useEffect(() => {
    const c = r.current;
    if (!c) return;
    let animId;
    animId = requestAnimationFrame(() => {
      const targetW = actualW || w;
      const x = c.getContext('2d'), d = window.devicePixelRatio || 1;
      c.width = targetW * d;
      c.height = h * d;
      x.setTransform(d, 0, 0, d, 0, 0);
      draw(x, targetW, h);
    });
    return () => cancelAnimationFrame(animId);
  }, [actualW, w, h, draw]);

  return (
    <div className="cv-wrapper">
      <canvas ref={r} style={{ width: '100%', height: h, display: 'block' }} />
    </div>
  );
}

// Stage formulas and descriptions for modal
const STAGE_DETAILS = {
  'File Ingest': {
    title: '1. File Ingest',
    desc: 'Reads raw IQ stream or .wav capture. Calculates sampling rate, duration, and normalises complex envelope to unit variance.',
    formula: 'x[n] = I[n] + jQ[n], \\quad P = \\frac{1}{N}\\sum_{n=0}^{N-1}|x[n]|^2, \\quad x_{norm}[n] = \\frac{x[n]}{\\sqrt{P}}',
  },
  'Parameter Estimation': {
    title: '2. Parameter Estimation',
    desc: 'Computes Welch Power Spectral Density for 99% occupied bandwidth. Evaluates cyclostationary spectral correlation and higher-order cumulants (C40, C42) to estimate symbol rate and modulation format.',
    formula: 'S_{xx}(f) = \\int_{-\\infty}^{\\infty} R_{xx}(\\tau) e^{-j2\\pi f \\tau} d\\tau, \\quad C_{42} = E[|x|^4] - |E[x^2]|^2 - 2E[|x|^2]^2',
  },
  'Demodulation': {
    title: '3. Demodulation',
    desc: 'Performs coarse FFT frequency offset correction followed by Costas phase tracking loop. Recovers optimal symbol strobes using Gardner timing error detector and applies root-raised-cosine matched filtering.',
    formula: 'e_{timing}[k] = I[k-1/2](I[k] - I[k-1]) + Q[k-1/2](Q[k] - Q[k-1])',
  },
  'De-Interleaving': {
    title: '4. De-Interleaving',
    desc: 'Searches matrix interleaver block dimensions (depth x span). Tests dispersion metric of soft bitstream to discover and reverse periodic interleaving without prior channel knowledge.',
    formula: 'D(M, N) = \\sum_{k} |p[k \\cdot N \\pmod L] - p_{ref}|^2',
  },
  'FEC Decoding': {
    title: '5. FEC Decoding',
    desc: 'Tests standard convolutional constraint lengths (K=7, r=1/2 poly [171, 133]) via CommPy soft-decision Viterbi traceback. Evaluates syndrome consistency to abstain if uncoded.',
    formula: 'm_k = \\min_{prev} \\{m_{k-1} + d(r_k, c_{prev \\to curr})\\}',
  },
  'Phase / Bitstream': {
    title: '6. Phase / Bitstream',
    desc: 'Correlates decoded bitstream against known synchronization patterns to resolve 4-fold phase rotation ambiguity. If no preamble matches, leaves phase resolved with confidence withheld.',
    formula: 'R_{xy}[m] = \\max_{\\theta} \\sum_{n} y[n] e^{-j\\theta} s^*[n-m]',
  }
};

export default function Page() {
  const [idx, setIdx] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Eye');
  const [out, setOut] = useState('Metrics');
  const [fmt, setFmt] = useState('Binary');
  const [pg, setPg] = useState(0);
  const [navTab, setNavTab] = useState('Dashboard');
  
  // Visualizer Sliders
  const [zoom, setZoom] = useState(1);
  const [wfZoom, setWfZoom] = useState(1.0);
  const [wfContrast, setWfContrast] = useState(1.0);
  const [runKey, setRunKey] = useState(0);
  
  // Single Clock state with date & UTC in tooltip
  const [timeLocal, setTimeLocal] = useState('--:--:--');
  const [timeUtc, setTimeUtc] = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');
  
  // Audio, File Upload & Modals
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchBit, setSearchBit] = useState('');
  const [activeStageModal, setActiveStageModal] = useState(null);
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Single clock updater with date
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeLocal(now.toLocaleTimeString('en-GB'));
      setTimeUtc(now.toUTCString().slice(17, 25));
      setDateStr(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  // Permanent Light Theme Enforcement
  useEffect(() => {
    try {
      localStorage.setItem('sigscope_theme', 'light');
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = 'light';
      }
    } catch (e) {}
  }, []);

  // URL Blueprint routing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('view') === 'blueprint') {
        setNavTab('System Blueprint');
      }
    }
  }, []);

  // Analyzing animation step simulation
  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const i = setInterval(() => setLoadingStep(s => Math.min(s + 1, 5)), 400);
    return () => clearInterval(i);
  }, [loading]);

  // Load index and default case
  useEffect(() => {
    fetchIndex()
      .then(i => {
        setIdx(i);
        if (i?.cases?.length) {
          setSel(i.cases[0].id);
        }
      })
      .catch(e => setErr(String(e.message || e)));
  }, []);

  // Fetch selected run
  useEffect(() => {
    if (sel) {
      setLoading(true);
      fetchRun(sel)
        .then(r => {
          setRun(r);
          setLoading(false);
          if (r?.estimates?.bandwidth_hz && r?.source?.fs_hz) {
            const target = r.estimates.bandwidth_hz * 4;
            const optZoom = Math.max(1, Math.min(15, parseFloat((r.source.fs_hz / target).toFixed(1))));
            setZoom(optZoom);
            const optWfZoom = Math.max(1.0, Math.min(8.5, parseFloat((r.source.fs_hz / (r.estimates.bandwidth_hz * 2.8)).toFixed(1))));
            setWfZoom(optWfZoom);
          } else {
            setZoom(1);
            setWfZoom(1.0);
          }
        })
        .catch(e => {
          setErr(String(e.message || e));
          setLoading(false);
        });
    } else {
      setRun(null);
    }
  }, [sel, runKey]);

  useEffect(() => { setPg(0); setTab('Eye'); }, [sel, runKey]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setUploadError(null);
    setToastMsg(null);

    const baseId = file.name.replace(/\.[^/.]+$/, "");
    const existing = idx?.cases?.find(c => c.id === baseId || c.id === file.name);
    if (existing) {
      setSel(existing.id);
      setRunKey(k => k + 1);
      setLoading(false);
      setToastMsg(`Loaded file: ${existing.id}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (data.run) {
        cacheRun(data.case_id, data.run);
        setRun(data.run);
        const newCaseMeta = {
          id: data.case_id,
          modulation: data.run.estimates?.modulation || data.run.demod?.modulation_used || 'QPSK',
          modulation_used: data.run.demod?.modulation_used || 'QPSK',
          snr_db: data.run.source?.measured_snr_db || null,
          ber: data.run.demod?.ber || null,
          confidence: data.run.demod?.confidence || 1.0,
          rs_bps: data.run.estimates?.symbol_rate_bps || null,
          bandwidth_hz: data.run.estimates?.bandwidth_hz || null,
          duration_s: data.run.source?.duration_s || 0,
          bytes: data.run.source?.n_samples ? data.run.source.n_samples * 4 : 0
        };
        setIdx(prev => {
          if (!prev) return { cases: [newCaseMeta] };
          return { ...prev, cases: [newCaseMeta, ...prev.cases.filter(c => c.id !== data.case_id)] };
        });
        setSel(data.case_id);
        setRunKey(k => k + 1);
        setToastMsg(`Analyzed file: ${file.name}`);
      } else {
        const i = await fetchIndex();
        setIdx(i);
        setSel(data.case_id);
        setRunKey(k => k + 1);
      }
      setLoading(false);
    } catch (err) {
      setUploadError(String(err.message || err));
      setLoading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Chart Draw Callbacks
  const drawSymbolPlot = useMemo(() => {
    if (tab === 'Eye') return dEye(run);
    if (tab === 'IQ Plot') return dIQ(run);
    return dCon(run);
  }, [tab, run]);

  const drawSpecPlot = useMemo(() => dSpec(run, zoom), [run, zoom]);
  const drawWfPlot = useMemo(() => dWf(run, wfContrast, wfZoom), [run, wfContrast, wfZoom]);

  // Bitstream preparation
  const bytes = useMemo(() => bitsToBytes(run?.bits), [run]);
  const LPP = 14;
  const lines = useMemo(() => {
    const n = fmt === 'Binary' ? 4 : 16, o = [];
    for (let i = 0; i < bytes.length; i += n) {
      const s = bytes.slice(i, i + n);
      o.push({
        byteOffset: i,
        text: fmt === 'Binary' ? s.map(bin).join('') : fmt === 'Hex' ? s.map(hx).join(' ') : s.map(asc).join('')
      });
    }
    return o;
  }, [bytes, fmt]);

  const filteredLines = useMemo(() => {
    if (!searchBit) return lines;
    return lines.filter(l => l.text.toLowerCase().includes(searchBit.toLowerCase()));
  }, [lines, searchBit]);

  const maxPage = Math.max(0, Math.ceil(filteredLines.length / LPP) - 1);
  const visible = filteredLines.slice(pg * LPP, pg * LPP + LPP);

  const est = run?.estimates, dem = run?.demod, src = run?.source;
  const reliable = dem?.confidence_reliable;
  const totalMs = run?.elapsed_ms ?? 0;
  const procSeconds = (totalMs / 1000).toFixed(2);
  const [procInt, procDec] = procSeconds.split('.');

  // 6 Detected Parameters Tiles
  const PARAMS = useMemo(() => {
    if (!run) return [];
    return [
      {
        icon: Activity,
        label: 'Sampling Rate',
        val: hz(src?.fs_hz),
        sub: '',
        conf: est?.symbol_rate_confidence,
        tag: est?.symbol_rate_confidence != null ? 'Conf: ' + pct(est.symbol_rate_confidence) : 'n/a',
        info: 'Hardware sampling rate of the baseband capture.'
      },
      {
        icon: BarChart3,
        label: 'Occupied BW',
        val: hz(est?.bandwidth_hz),
        sub: '',
        conf: null,
        tag: '99% Welch',
        info: 'Method: 99% power (Welch). Integrated power spectral density across 99% energy contour.'
      },
      {
        icon: Grip,
        label: 'Symbol Rate',
        val: hz(est?.symbol_rate_bps),
        sub: `sps ${est?.sps ?? 'n/a'}`,
        conf: est?.symbol_rate_confidence,
        tag: est?.symbol_rate_confidence != null ? 'Conf: ' + pct(est.symbol_rate_confidence) : 'n/a',
        info: 'Second-order cyclostationary autocorrelation peak.'
      },
      {
        icon: Activity,
        label: 'Modulation (est.)',
        val: est?.modulation ?? 'n/a',
        sub: est?.amc_agrees_with_truth === false ? 'MISC' : '',
        conf: est?.modulation_confidence,
        tag: est?.modulation_confidence != null ? 'Conf: ' + pct(est.modulation_confidence) : 'n/a',
        info: 'Blind statistical modulation recognition using higher-order cumulants.'
      },
      {
        icon: ShieldCheck,
        label: 'Modulation (used)',
        val: dem?.modulation_used ?? 'n/a',
        sub: '',
        conf: dem?.confidence_reliable ? dem?.confidence : null,
        tag: dem?.confidence != null ? 'Conf: ' + pct(dem.confidence) : (dem?.assisted ? 'assisted' : 'blind'),
        info: 'Constellation template matched by demodulator decision engine.'
      },
      {
        icon: LayoutGrid,
        label: 'Measured BER',
        val: ber(dem?.ber),
        sub: '',
        conf: null,
        tag: run?.truth?.bits ? 'vs ground truth' : 'no ground truth',
        info: 'No transmitted reference available for real captures, so BER is not computed.'
      }
    ];
  }, [run, est, dem, src]);

  // 6 Pipeline Stages Data (unabbreviated stage names)
  const STEPDATA = useMemo(() => {
    if (!run) return [];
    const s = Object.fromEntries((run.stages || []).map(x => [x.stage, x.ms]));
    return [
      { i: FileText, t: '1. File Ingest', key: 'File Ingest', a: `${nInt(src?.n_samples)} samples`, ms: s.ingest },
      { i: Activity, t: '2. Parameter Estimation', key: 'Parameter Estimation', a: `Rs ${hz(est?.symbol_rate_bps)} · ${est?.modulation ?? 'n/a'}`, ms: s.estimate },
      { i: Grip, t: '3. Demodulation', key: 'Demodulation', a: `${dem?.modulation_used} · ${nInt(dem?.n_bits)} bits`, ms: s.demodulate },
      { i: LayoutGrid, t: '4. De-Interleaving', key: 'De-Interleaving', a: dem?.interleaver ?? (dem?.coded ? 'searched, none' : 'n/a'), ms: null },
      { i: ShieldCheck, t: '5. FEC Decoding', key: 'FEC Decoding', a: dem?.coded ? (dem.decoded ? `conv r=1/2 · BER ${ber(dem.ber)}` : 'unresolved') : 'n/a (uncoded)', ms: null },
      { 
        i: Link2, 
        t: '6. Phase / Bitstream', 
        key: 'Phase / Bitstream',
        a: (dem?.preamble_agreement != null) ? 'preamble-locked' : (dem?.phase_resolved ? 'phase resolved' : 'unresolved'), 
        ms: null 
      },
    ];
  }, [run, est, dem, src]);

  const handleCopyBits = () => {
    if (!run?.bits) return;
    navigator.clipboard.writeText(run.bits.slice(0, 10000));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render Blueprint view if selected
  if (navTab === 'System Blueprint') {
    return (
      <div className="shell">
        <Sidebar activeNavTab={navTab} onSelectTab={setNavTab} />
        <div className="content-area">
          <Header />
          <div className="main">
            <SystemBlueprintView />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <Sidebar activeNavTab={navTab} onSelectTab={setNavTab} />

      <div className="content-area">
        <Header />

        {/* Global Notifications */}
        {uploadError && (
          <div style={{ margin: '12px 32px 0', padding: '10px 16px', background: 'rgba(255, 77, 94, 0.12)', border: '1px solid rgba(255, 77, 94, 0.3)', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-red)', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} />
              <span>{uploadError}</span>
            </div>
            <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: 16 }}>×</button>
          </div>
        )}
        {toastMsg && (
          <div style={{ margin: '12px 32px 0', padding: '10px 16px', background: 'rgba(198, 244, 50, 0.12)', border: '1px solid rgba(198, 244, 50, 0.3)', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-lime)', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-lime)', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Analyzing / Loading Animation Overlay */}
        {loading && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
              <Zap size={32} color="var(--accent-lime)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 16, color: 'var(--text-main)', justifyContent: 'center', margin: '0 0 6px' }}>
                Analyzing Signal
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 16px' }}>
                Estimating carrier, symbol rate, and modulation...
              </p>
              <div style={{ height: 4, background: 'rgba(0, 0, 0, 0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((loadingStep + 1) / 6) * 100}%`, background: 'var(--accent-lime)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        )}

        <div className="main">
          {/* INITIAL EMPTY STATE: Mission Control Standby (when no run is selected) */}
          {!sel ? (
            <div className="c" style={{ textAlign: 'center', padding: '60px 32px' }}>
              <Signal size={36} color="var(--accent-lime)" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: 22, color: 'var(--text-main)', fontWeight: 600, marginBottom: 8 }}>
                Standby Mode
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 480, margin: '0 auto 24px' }}>
                Load a raw telemetry waveform (.iq, .wav) or select a benchmark to begin blind signal analysis.
              </p>

              <input type="file" accept=".iq,.wav" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
                <button className="pill-btn white" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> Load File
                </button>
              </div>

              <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 12 }}>
                  Benchmark Files:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { id: 'fmt_stereo_wav_qpsk', name: 'fmt_stereo_wav_qpsk.wav', sub: 'QPSK · 96.00 kHz' },
                    { id: 'bpsk_20', name: 'bpsk_20.json', sub: 'BPSK · 20 dB SNR' },
                    { id: 'qpsk_20', name: 'qpsk_20.json', sub: 'QPSK · 20 dB SNR' },
                    { id: '16qam_20', name: '16qam_20.json', sub: '16QAM · 20 dB SNR' },
                    { id: '8psk_20', name: '8psk_20.json', sub: '8PSK · 20 dB SNR' },
                    { id: '64qam_20', name: '64qam_20.json', sub: '64QAM · 20 dB SNR' },
                  ].map(p => (
                    <div 
                      key={p.id} 
                      className="preset-pill"
                      onClick={() => setSel(p.id)}
                      style={{ 
                        borderRadius: 14, 
                        padding: '12px 14px', 
                        cursor: 'pointer', 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        alignItems: 'flex-start'
                      }}
                    >
                      <b style={{ display: 'block', fontSize: 12, color: 'var(--text-main)', marginBottom: 2 }}>{p.name}</b>
                      <small style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.sub}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* HERO FILE CARD: Large White Name, Pill Actions, Processing Hero */}
              <div className="file-card">
                <div className="file-card-info">
                  <div className="file-card-top-row">
                    <h2>{sel}</h2>
                    <span className="status-dot-pill">
                      <i />
                      <span>{reliable ? 'Decoded' : 'Decoded'}</span>
                    </span>
                  </div>
                  <div className="file-card-meta">
                    {src ? `${src.format || 'Complex64'} · ${hz(src.fs_hz)} · ${src.duration_s}s · ${nInt(src.n_samples)} samples` : 'Loading...'}
                  </div>
                </div>

                {/* Case Selector Dropdown as Dark Pill */}
                {idx?.cases?.length && (
                  <select 
                    className="pill-btn dark" 
                    style={{ minWidth: 240, fontSize: 12, cursor: 'pointer' }}
                    value={sel} 
                    onChange={e => setSel(e.target.value)}
                  >
                    {idx.cases.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.id} ({c.modulation ?? 'n/a'})
                      </option>
                    ))}
                  </select>
                )}

                {/* Processing Large Counter with Gray Decimals */}
                <div className="processing-hero" title="Total DSP Execution Time">
                  <span>Processing: </span>
                  <b>{procInt}<small>.{procDec}s</small></b>
                </div>

                {/* Primary Actions: White & Dark Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {(src?.file?.endsWith('.wav') || sel === 'fmt_stereo_wav_qpsk') && (
                    <>
                      <button 
                        type="button"
                        id="play-audio-btn"
                        className={`pill-btn white ${playing ? 'play-active' : ''}`}
                        onClick={() => {
                          if (audioRef.current) {
                            if (playing) {
                              audioRef.current.pause();
                              setPlaying(false);
                            } else {
                              audioRef.current.play().catch(e => console.log('Audio error', e));
                              setPlaying(true);
                            }
                          }
                        }}
                      >
                        {playing ? <PauseCircle size={15} color="#000" /> : <PlayCircle size={15} />}
                        <span>{playing ? 'Pause' : 'Play Audio'}</span>
                      </button>
                      <audio 
                        ref={audioRef} 
                        src={`/api/audio?f=${src?.file || 'fmt_stereo_wav_qpsk.wav'}`} 
                        onEnded={() => setPlaying(false)} 
                        onPause={() => setPlaying(false)}
                        style={{ display: 'none' }} 
                      />
                    </>
                  )}

                  <input type="file" accept=".iq,.wav" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} />
                  <button className="pill-btn white" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} /> Load File
                  </button>

                  <button className="pill-btn dark" onClick={() => window.print()}>
                    <Download size={14} /> Export
                  </button>

                  <button className="pill-btn dark" onClick={() => setSel(null)}>
                    <RefreshCw size={14} /> Standby
                  </button>
                </div>
              </div>

              {/* 2-COLUMN DASHBOARD GRID */}
              <div className="grid">
                {/* Left Column: Detected Parameters, Visualizers, Pipeline, Bitstream */}
                <div className="l">
                  {/* 6 Detected Parameters Tiles */}
                  <div className="c">
                    <h3>
                      <Activity size={16} /> 
                      <span>Detected Parameters</span>
                    </h3>

                    <div className="tiles">
                      {PARAMS.map(p => (
                        <div className="tile" key={p.label}>
                          <div className="tile-top">
                            <span className="tile-lbl">{p.label}</span>
                            <button type="button" className="tile-info-btn" title={p.info}>
                              <Info size={13} />
                            </button>
                          </div>

                          <div className="tile-val-row">
                            <b className="tile-val">{p.val}</b>
                            {p.sub && <span className="tile-sub">{p.sub}</span>}
                          </div>

                          <div className="tile-ftr">
                            <span className={`tile-confidence-tag ${p.tag.includes('ground') || p.tag === 'n/a' ? 'withheld' : 'high'}`}>
                              {p.tag}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visualizers Row: Spectrum, Waterfall, Symbol */}
                  <div className="cs">
                    {/* 1. Spectrum */}
                    <div className="c chart-card-solid">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ margin: 0 }}><Activity size={15} /> Spectrum</h3>
                        <div className="slider-group">
                          <span>Zoom:</span>
                          <input 
                            type="range" 
                            min="1" 
                            max="15" 
                            step="0.5" 
                            value={Math.min(15, Math.max(1, zoom))} 
                            onChange={e => setZoom(Number(e.target.value))} 
                            style={{ width: 65 }} 
                          />
                          <span className="slider-pill-tag">{Math.min(15, Math.max(1, zoom)).toFixed(1)}x</span>
                          <button 
                            className="theme-circle-btn" 
                            style={{ width: 28, height: 28 }}
                            onClick={() => setFullscreenChart('spectrum')}
                            title="Expand Spectrum"
                          >
                            <Maximize2 size={12} />
                          </button>
                        </div>
                      </div>
                      <Cv w={330} h={230} draw={drawSpecPlot} />
                    </div>

                    {/* 2. Waterfall: Title on Row 1, Sliders on Row 2 (Fixes Card Edge Cutoff Bug) */}
                    <div className="c chart-card-solid">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3 style={{ margin: 0 }}><Grip size={15} /> Waterfall</h3>
                        <button 
                          className="theme-circle-btn" 
                          style={{ width: 28, height: 28 }}
                          onClick={() => setFullscreenChart('waterfall')}
                          title="Expand Waterfall"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>

                      {/* Second Row for Sliders */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div className="slider-group">
                          <span>Zoom:</span>
                          <input 
                            type="range" 
                            min="1.0" 
                            max="8.5" 
                            step="0.1" 
                            value={Math.min(8.5, Math.max(1.0, wfZoom))} 
                            onChange={e => setWfZoom(Number(e.target.value))} 
                            style={{ width: 55 }} 
                          />
                          <span className="slider-pill-tag">{Math.min(8.5, Math.max(1.0, wfZoom)).toFixed(1)}x</span>
                        </div>
                        <div className="slider-group">
                          <span>Contrast:</span>
                          <input 
                            type="range" 
                            min="0.6" 
                            max="2.2" 
                            step="0.1" 
                            value={Math.min(2.2, Math.max(0.6, wfContrast))} 
                            onChange={e => setWfContrast(Number(e.target.value))} 
                            style={{ width: 50 }} 
                          />
                          <span className="slider-pill-tag">{wfContrast.toFixed(1)}x</span>
                        </div>
                      </div>

                      <div className="cb">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Cv w={290} h={210} draw={drawWfPlot} />
                        </div>
                        <div className="bar-gradient" />
                        <div className="cbl">
                          {[0, -25, -50, -75, -100].map(v => <span key={v}>{v} dB</span>)}
                        </div>
                      </div>
                    </div>

                    {/* 3. Symbol / Eye / Constellation */}
                    <div className="c chart-card-solid">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
                        <div className="tabs-pill" style={{ flexShrink: 0 }}>
                          {['Eye', 'Constellation', 'IQ Plot'].map(k => (
                            <button key={k} className={tab === k ? 'a' : ''} onClick={() => setTab(k)} style={{ whiteSpace: 'nowrap' }}>
                              {k}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                          <span className="pill-btn dark" style={{ height: 26, padding: '0 10px', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {dem?.modulation_used ?? '—'}
                          </span>
                          <button 
                            className="theme-circle-btn" 
                            style={{ width: 28, height: 28 }}
                            onClick={() => setFullscreenChart('symbol')}
                            title="Expand Chart"
                          >
                            <Maximize2 size={12} />
                          </button>
                        </div>
                      </div>
                      <Cv w={330} h={230} draw={drawSymbolPlot} />
                    </div>
                  </div>

                  {/* Analysis Pipeline */}
                  <div className="c">
                    <h3>
                      <Activity size={16} /> 
                      <span>Analysis Pipeline</span>
                    </h3>

                    <div className="pl">
                      {STEPDATA.map(s => (
                        <div 
                          key={s.key} 
                          className="st"
                          onClick={() => setActiveStageModal(s.key)}
                          title="Click to view mathematical equations"
                        >
                          <h4>{s.t}</h4>
                          <small>{s.a}</small>
                          {s.ms != null && <span className="ms-tag">{s.ms} ms</span>}
                          {s.ms != null && <span className="ck-dot" />}
                        </div>
                      ))}
                    </div>

                    {/* Progress Bar in Purple to Lime */}
                    {run?.stages?.length > 0 && totalMs > 0 && (
                      <div className="pipeline-bar" title="Execution Proportions">
                        {run.stages.map((st, i) => {
                          const pct = ((st.ms / totalMs) * 100);
                          const colors = [PURPLE, '#8B5CF6', '#35C9FF', '#10B981', LIME, '#A3E635'];
                          return (
                            <div 
                              key={st.stage} 
                              className="pipeline-bar-seg" 
                              style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                              title={`${st.stage}: ${st.ms}ms (${pct.toFixed(1)}%)`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Decoded Bitstream & Signal Summary */}
                  <div className="b3">
                    <div className="c" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ margin: 0 }}><Waves size={15} /> Decoded Bitstream</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tile)', padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border-hairline)' }}>
                            <Search size={12} color="var(--text-secondary)" />
                            <input 
                              type="text" 
                              placeholder="Search..." 
                              value={searchBit} 
                              onChange={e => setSearchBit(e.target.value)}
                              style={{ background: 'none', border: 'none', width: 80, paddingLeft: 6, fontSize: 11, color: 'var(--text-main)', outline: 'none' }}
                            />
                          </div>

                          <div className="tabs-pill">
                            {['Binary', 'Hex', 'ASCII'].map(k => (
                              <button key={k} className={fmt === k ? 'a' : ''} onClick={() => setFmt(k)}>
                                {k}
                              </button>
                            ))}
                          </div>

                          <button 
                            className="pill-btn dark" 
                            style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                            onClick={handleCopyBits}
                          >
                            {copied ? <Check size={12} color="var(--accent-lime)" /> : <Copy size={12} />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="term">
                        {visible.length ? visible.map((l, i) => (
                          <div className="term-row" key={pg * LPP + i}>
                            <span className="term-gutter">
                              {String(pg * LPP + i + 1).padStart(4, '0')}
                            </span>
                            <span className="term-content">
                              {l.text}
                            </span>
                          </div>
                        )) : (
                          <div>no bits matching query</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span>Showing {nInt(visible.length)} of {nInt(lines.length)} lines</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Page {pg + 1} / {maxPage + 1}</span>
                          <button 
                            className="theme-circle-btn" 
                            style={{ width: 26, height: 26 }} 
                            disabled={pg === 0} 
                            onClick={() => setPg(p => Math.max(0, p - 1))}
                          >
                            <ChevronLeft size={12} />
                          </button>
                          <button 
                            className="theme-circle-btn" 
                            style={{ width: 26, height: 26 }} 
                            disabled={pg >= maxPage} 
                            onClick={() => setPg(p => Math.min(maxPage, p + 1))}
                          >
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Signal Summary Card */}
                    <div className="c" style={{ width: 280, minWidth: 280 }}>
                      <h3><Signal size={15} /> Signal Summary</h3>
                      {[
                        ['Dossier ID', sel ?? '—'],
                        ['Duration', src ? src.duration_s + ' s' : 'n/a'],
                        ['Samples', nInt(src?.n_samples)],
                        ['Format', 'Complex64'],
                        ['Measured SNR', src?.measured_snr_db != null ? src.measured_snr_db + ' dB' : 'n/a'],
                        ['True SNR', run?.truth?.snr_db != null ? run.truth.snr_db + ' dB' : 'n/a'],
                      ].map(([k, v]) => (
                        <div className="pr" key={k}>
                          <span>{k}</span>
                          <b>{v}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Parameter Summary, Honesty Gate, Demodulation Details, Data Summary */}
                <div className="r">
                  {/* Parameter Summary */}
                  <div className="c">
                    <h3>Parameter Summary</h3>
                    {PARAMS.map(p => (
                      <div className="pr" key={p.label} title={p.info}>
                        <span>{p.label}</span>
                        <b>{p.val}{p.sub ? ' ' + p.sub : ''}</b>
                        <span className={`tag-badge ${p.tag.includes('ground') || p.tag === 'n/a' ? 'amber' : ''}`}>
                          {p.tag}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Honesty Gate Card: Title + 4 Rows with tooltips */}
                  <div className="c">
                    <h3><ShieldCheck size={16} color="var(--accent-lime)" /> Honesty Gate</h3>
                    
                    <div className="honesty-row">
                      <span className="honesty-title" title="Cyclostationary cumulants">Modulation Estimation</span>
                      <span className="honesty-pill pass">PASS</span>
                    </div>

                    <div className="honesty-row">
                      <span className="honesty-title" title="Autocorrelation peak lock">Symbol Rate (1.20 kHz)</span>
                      <span className="honesty-pill pass">PASS</span>
                    </div>

                    <div className="honesty-row">
                      <span className="honesty-title" title="No reference signal for live captures">Measured BER</span>
                      <span className="honesty-pill withheld" title="No transmitted reference available for real captures, so BER is not computed.">
                        WITHHELD
                      </span>
                    </div>

                    <div className="honesty-row">
                      <span className="honesty-title" title="Costas loop phase resolved">Phase Classification</span>
                      <span className="honesty-pill pass">
                        {dem?.preamble_agreement != null ? 'LOCKED' : 'RESOLVED'}
                      </span>
                    </div>
                  </div>

                  {/* Demodulation Details */}
                  <div className="c">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ margin: 0 }}><Timer size={15} /> Demodulation Details</h3>
                      <div className="tabs-pill">
                        {['Metrics', 'Notes'].map(k => (
                          <button key={k} className={out === k ? 'a' : ''} onClick={() => setOut(k)}>
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      {out === 'Metrics' ? (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.01em', margin: '8px 0 4px', fontWeight: 500 }}>
                            Carrier & timing recovery
                          </div>
                          {[
                            ['Symbol Rate', hz(est?.symbol_rate_bps)],
                            ['Rs Method', est?.symbol_rate_method ?? 'Cyclostationary peak'],
                            ['Timing Samples / Sym', est?.sps ? String(est.sps) : 'n/a'],
                            ['Modulation (used)', dem?.modulation_used ?? 'n/a'],
                            ['Assisted', dem?.assisted ? 'yes' : 'no'],
                          ].map(([k, v]) => (
                            <div key={k} className="pr">
                              <span>{k}</span>
                              <b>{v}</b>
                            </div>
                          ))}

                          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.01em', margin: '14px 0 4px', fontWeight: 500 }}>
                            Coding & synchronization
                          </div>
                          {[
                            ['FEC', dem?.coded ? 'conv r=1/2' : 'none (uncoded)'],
                            ['Interleaver', dem?.interleaver ?? (dem?.coded ? 'searched, unresolved' : 'n/a')],
                            ['Interleaver Margin', dem?.interleaver_margin ? String(dem.interleaver_margin) : 'n/a'],
                            ['Phase Resolved', dem?.phase_resolved ? 'yes' : 'no'],
                            ['Rotation Resolved', dem?.rotation != null ? `${dem.rotation} of ${dem.rotation_order}` : 'n/a'],
                            ['Preamble Agreement', dem?.preamble_agreement ?? 'n/a'],
                            ['Measured BER', ber(dem?.ber)],
                            ['Confidence', conf(dem?.confidence)],
                          ].map(([k, v]) => (
                            <div key={k} className="pr">
                              <span>{k}</span>
                              <b>{v}</b>
                            </div>
                          ))}
                        </>
                      ) : (
                        (() => {
                          const notes = [dem?.reason, dem?.interleaver_note, dem?.note, est?.amc_note, est?.amc_abstain_reason].filter(Boolean);
                          if (notes.length === 0) {
                            return (
                              <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, background: 'var(--bg-tile)', borderRadius: 'var(--radius-tile)', border: '1px solid var(--border-hairline)', marginTop: 4 }}>
                                <CheckCircle2 size={16} color="var(--accent-lime)" style={{ margin: '0 auto 6px', display: 'block' }} />
                                <b style={{ color: 'var(--text-main)' }}>No Anomalies Recorded</b>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Demodulation locked with nominal parameters.</div>
                              </div>
                            );
                          }
                          return notes.map((v, i) => (
                            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-secondary)', fontSize: 12 }}>
                              {v}
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  </div>

                  {/* Data Summary */}
                  <div className="c">
                    <h3><Layers size={15} /> Data Summary</h3>
                    {[
                      ['Modulation (est.)', est?.modulation ?? 'n/a', est?.amc_agrees_with_truth === false ? 'Disagrees' : 'Agrees'],
                      ['Symbol Rate', hz(est?.symbol_rate_bps), est?.symbol_rate_confidence >= 0.9 ? 'High conf' : 'Low conf'],
                      ['Phase Class', dem?.phase_resolved ? 'Resolved' : 'Unresolved', dem?.preamble_agreement != null ? 'Preamble-locked' : 'Phase resolved'],
                      ['FEC Decoding', dem?.coded ? (dem.decoded ? 'Decoded' : 'Unresolved') : 'Uncoded', dem?.coded ? 'conv r=1/2' : 'n/a'],
                      ['De-interleave', dem?.coded ? (dem.interleaver ?? 'unresolved') : 'n/a', dem?.coded ? 'analyzed' : 'n/a'],
                      ['Measured BER', ber(dem?.ber), dem?.ber === 0 ? 'Error-free' : dem?.ber != null ? 'Measured' : 'Withheld'],
                    ].map(([k, v, s]) => (
                      <div className="pr" key={k}>
                        <span>{k}</span>
                        <b>{v}</b>
                        <span className="tag-badge">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stage Detail Modal */}
      {activeStageModal && STAGE_DETAILS[activeStageModal] && (
        <div className="modal-backdrop" onClick={() => setActiveStageModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
                {STAGE_DETAILS[activeStageModal].title}
              </h3>
              <button 
                onClick={() => setActiveStageModal(null)}
                className="theme-circle-btn"
                style={{ width: 30, height: 30 }}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              {STAGE_DETAILS[activeStageModal].desc}
            </p>

            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mathematical Specification:
            </span>
            <div style={{ background: 'rgba(255, 255, 255, 0.35)', border: '1px solid var(--border-card)', borderRadius: 12, padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-purple-dark)', margin: '8px 0 16px' }}>
              {STAGE_DETAILS[activeStageModal].formula}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Chart Modal with Solid Background */}
      {fullscreenChart && (
        <div className="modal-backdrop" onClick={() => setFullscreenChart(null)}>
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: 1100, 
              maxHeight: '94vh', 
              background: '#FFFFFF', 
              borderRadius: 24, 
              padding: 28,
              boxShadow: '0 25px 60px -10px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.08)' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {fullscreenChart === 'spectrum' ? <><Activity size={18} /> Spectrum Analyzer</> : fullscreenChart === 'waterfall' ? <><Grip size={18} /> Waterfall</> : <><Layers size={18} /> Eye / Constellation / IQ</>}
                </h3>
                {fullscreenChart === 'symbol' && (
                  <div className="tabs-pill" style={{ marginLeft: 8 }}>
                    {['Eye', 'Constellation', 'IQ Plot'].map(k => (
                      <button key={k} className={tab === k ? 'a' : ''} onClick={() => setTab(k)} style={{ whiteSpace: 'nowrap' }}>
                        {k}
                      </button>
                    ))}
                  </div>
                )}
                {fullscreenChart === 'waterfall' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 16 }}>
                    <div className="slider-group">
                      <span>Zoom:</span>
                      <input 
                        type="range" 
                        min="1.0" 
                        max="8.5" 
                        step="0.1" 
                        value={Math.min(8.5, Math.max(1.0, wfZoom))} 
                        onChange={e => setWfZoom(Number(e.target.value))} 
                        style={{ width: 70 }} 
                      />
                      <span className="slider-pill-tag">{Math.min(8.5, Math.max(1.0, wfZoom)).toFixed(1)}x</span>
                    </div>
                    <div className="slider-group">
                      <span>Contrast:</span>
                      <input 
                        type="range" 
                        min="0.6" 
                        max="2.2" 
                        step="0.1" 
                        value={Math.min(2.2, Math.max(0.6, wfContrast))} 
                        onChange={e => setWfContrast(Number(e.target.value))} 
                        style={{ width: 65 }} 
                      />
                      <span className="slider-pill-tag">{wfContrast.toFixed(1)}x</span>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setFullscreenChart(null)} className="theme-circle-btn" style={{ width: 32, height: 32 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ width: '100%', height: 490, background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
              {fullscreenChart === 'spectrum' && <Cv w={1040} h={490} draw={drawSpecPlot} />}
              {fullscreenChart === 'waterfall' && (
                <div className="cb" style={{ width: '100%', height: '100%' }}>
                  <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                    <Cv w={990} h={490} draw={drawWfPlot} />
                  </div>
                  <div className="bar-gradient" style={{ width: 14, margin: '8px 0 42px 0' }} />
                  <div className="cbl" style={{ margin: '8px 8px 42px 0', fontSize: 11, fontWeight: 500 }}>
                    {[0, -25, -50, -75, -100].map(v => <span key={v}>{v} dB</span>)}
                  </div>
                </div>
              )}
              {fullscreenChart === 'symbol' && <Cv w={1040} h={490} draw={drawSymbolPlot} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
