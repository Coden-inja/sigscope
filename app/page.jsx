'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Activity, BarChart3, Grip, ShieldCheck, LayoutGrid, Link2, Upload, Download, MoreHorizontal, Radio, Settings, Home, ChevronDown, User, CheckCircle2, ChevronLeft, ChevronRight, ArrowRight, Timer, Layers, Waves, Signal, Clock } from 'lucide-react';
import { rng, gauss } from '../lib/sim';

const G = '#1b7f5c', cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const jet = t => `rgb(${[1.5 - Math.abs(4 * t - 3), 1.5 - Math.abs(4 * t - 2), 1.5 - Math.abs(4 * t - 1)].map(v => Math.round(cl(v) * 255))})`;
const SP = (() => { const r = rng(4); return Array.from({ length: 420 }, (_, i) => { const f = -2 + i / 419 * 4, a = Math.abs(f); const s = a < .5 ? -38 - 20 * (a / .5) ** 2 : -58 - 30 * (1 - Math.exp(-(a - .5) * 1.3)); return s + (r() - .5) * (a < .5 ? 7 : 5) }) })();
const BY = (() => { const r = rng(9), b = Array.from({ length: 1024 }, () => Math.floor(r() * 256));[0xA5, 0xF3, 0xC7, 0xD2].forEach((v, i) => b[i] = v); return b })();
const bin = b => b.toString(2).padStart(8, '0'), hx = b => b.toString(16).padStart(2, '0').toUpperCase(), asc = b => b > 31 && b < 127 ? String.fromCharCode(b) : '.';

function ax(x, w, h, o) {
  const L = o.l ?? 46, B = 30, T = 8, R = 8, pw = w - L - R, ph = h - T - B, [x0, x1, xs] = o.x, [y0, y1, ys] = o.y, X = v => L + (v - x0) / (x1 - x0) * pw, Y = v => T + (1 - (v - y0) / (y1 - y0)) * ph;
  x.strokeStyle = '#d5d9e0'; x.lineWidth = 1; x.strokeRect(L + .5, T + .5, pw, ph); x.fillStyle = '#6b7280'; x.font = '10px Inter,sans-serif'; x.textAlign = 'center';
  for (let v = x0; v <= x1 + 1e-9; v += xs)x.fillText(o.fx ? o.fx(v) : v.toFixed(1), X(v), h - B + 13);
  x.textAlign = 'right'; for (let v = y0; v <= y1 + 1e-9; v += ys)x.fillText(o.fy ? o.fy(v) : v.toFixed(1), L - 6, Y(v) + 3);
  x.textAlign = 'center'; x.fillText(o.xl, L + pw / 2, h - 4); x.save(); x.translate(10, T + ph / 2); x.rotate(-Math.PI / 2); x.fillText(o.yl, 0, 0); x.restore();
  x.save(); x.beginPath(); x.rect(L, T, pw, ph); x.clip(); return { X, Y, L, T, pw, ph }
}

const dSpec = (x, w, h) => {
  const a = ax(x, w, h, { x: [-2, 2, .5], y: [-100, -20, 20], fy: v => v.toFixed(0), xl: 'Frequency (MHz)', yl: 'Power (dB)' }), { X, Y } = a;
  x.fillStyle = 'rgba(31,157,107,.16)'; x.fillRect(X(-.5), a.T, X(.5) - X(-.5), a.ph);
  x.beginPath(); SP.forEach((d, i) => { const f = -2 + i / 419 * 4; i ? x.lineTo(X(f), Y(d)) : x.moveTo(X(f), Y(d)) }); x.strokeStyle = G; x.lineWidth = 1; x.stroke();
  x.lineTo(X(2), Y(-100)); x.lineTo(X(-2), Y(-100)); x.fillStyle = 'rgba(31,157,107,.12)'; x.fill(); x.restore();
  x.fillStyle = '#2a2d33'; x.fillRect(X(0) - 28, a.T - 2, 56, 15); x.fillStyle = '#fff'; x.font = '9.5px Inter'; x.textAlign = 'center'; x.fillText('1.024 MHz', X(0), a.T + 9)
};
const dWf = (x, w, h) => {
  const a = ax(x, w, h, { x: [0, 30, 5], y: [-2, 2, 1], fx: v => v.toFixed(0), xl: 'Time (s)', yl: 'Frequency (MHz)' }), r = rng(2), N = 90, M = 70;
  for (let i = 0; i < N; i++)for (let j = 0; j < M; j++) {
    const t = i / N * 30, f = 2 - j / M * 4;
    const v = .3 + .32 * Math.exp(-((f / .7) ** 2)) + .16 * Math.exp(-(((t - 15) / 2.6) ** 2)) * (.5 + .5 * Math.exp(-((f / 1.4) ** 2))) + .28 * Math.exp(-((f / .12) ** 2) - (((t - 15) / 1.3) ** 2)) + .09 * (r() - .5) * 2;
    x.fillStyle = jet(cl(v)); x.fillRect(a.L + i * a.pw / N, a.T + j * a.ph / M, a.pw / N + .6, a.ph / M + .6)
  } x.restore()
};
const CC = [[-.6, .6, '#0f6b4a'], [.6, .6, '#22b8e6'], [-.6, -.6, '#f08a1c'], [.6, -.6, '#7a3fc0']];
const dCon = (x, w, h) => {
  const a = ax(x, w, h, { x: [-1, 1, .5], y: [-1, 1, .5], xl: 'I', yl: 'Q', l: 40 }), r = rng(6);
  x.strokeStyle = '#d5d9e0'; x.beginPath(); x.moveTo(a.X(0), a.T); x.lineTo(a.X(0), a.T + a.ph); x.moveTo(a.L, a.Y(0)); x.lineTo(a.L + a.pw, a.Y(0)); x.stroke();
  CC.forEach(([cx, cy, c]) => { x.fillStyle = c; for (let i = 0; i < 220; i++)x.fillRect(a.X(cx + gauss(r) * .09), a.Y(cy + gauss(r) * .09), 2, 2) }); x.restore()
};
const dIQ = (x, w, h) => {
  const a = ax(x, w, h, { x: [0, 200, 50], y: [-1, 1, .5], fx: v => v, xl: 'Sample', yl: 'Amplitude' }), r = rng(8);
  [['#1b7f5c', 0], ['#e08a1c', 1.4]].forEach(([c, p]) => { x.beginPath(); for (let i = 0; i <= 200; i++) { const y = Math.sin(i * .31 + p) * .7 * (.9 + .1 * Math.sin(i * .05)) + (r() - .5) * .12; i ? x.lineTo(a.X(i), a.Y(y)) : x.moveTo(a.X(i), a.Y(y)) } x.strokeStyle = c; x.lineWidth = 1; x.stroke() }); x.restore()
};
const V = { Spectrum: [dSpec, 220], Waterfall: [dWf, 220], Constellation: [dCon, 220], 'IQ Plot': [dIQ, 220] };

function Cv({ w, h, draw }) { const r = useRef(); useEffect(() => { const c = r.current, x = c.getContext('2d'), d = window.devicePixelRatio || 1; c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0); draw(x, w, h) }, [w, h, draw]); return <canvas ref={r} /> }
const Sel = ({ v }) => <select className="sel" defaultValue={v}><option>{v}</option></select>;
const STEPS = [[FileText, 'File Ingest', 'IQ / .wav', '4.096 Msps'], [Activity, 'Parameter Estimation', 'Sampling, Modulation, FEC, Interleaving'], [Grip, 'Demodulation', 'QPSK', '512 ksps'], [LayoutGrid, 'De-Interleaving', 'Block', '(Auto-selected)'], [ShieldCheck, 'FEC Decoding', 'Convolutional + Viterbi', '(BER: 1.2e-5)'], [Link2, 'Bitstream Correlation', 'Header / Payload', '(Sync Word: 0xA5F3C7D2)']];
const PARAMS = [[Activity, 'Sampling Rate', '4.096 Msps', '99.2%'], [BarChart3, 'Bandwidth', '1.024 MHz', '98.7%'], [Grip, 'Modulation', 'QPSK', '98.7%'], [Activity, 'Symbol Rate', '512 ksps', '97.9%'], [ShieldCheck, 'FEC Type', 'Convolutional', '96.3%', '(Viterbi)'], [LayoutGrid, 'Interleaving', 'Block', '98.1%']];

export default function Page() {
  const [done, setDone] = useState(0), [tab, setTab] = useState('Spectrum'), [out, setOut] = useState('Bitstream'), [fmt, setFmt] = useState('Binary'), [pg, setPg] = useState(0), [now, setNow] = useState(null);
  useEffect(() => { if (done >= 6) return; const t = setTimeout(() => setDone(d => d + 1), 650); return () => clearTimeout(t) }, [done]);
  useEffect(() => { const f = () => setNow(new Date()); f(); const i = setInterval(f, 1000); return () => clearInterval(i) }, []);
  const bytes = BY.slice(pg * 128, pg * 128 + 128), lines = useMemo(() => { const n = fmt === 'Binary' ? 4 : 16, o = []; for (let i = 0; i < bytes.length; i += n) { const s = bytes.slice(i, i + n); o.push(fmt === 'Binary' ? s.map(bin).join('') : fmt === 'Hex' ? s.map(hx).join(' ') : s.map(asc).join('')) } return o }, [bytes, fmt]);
  const outL = out === 'Bitstream' ? BY.slice(0, 24).reduce((a, b, i) => (i % 4 ? a[a.length - 1] += bin(b) : a.push(bin(b)), a), []) : out === 'Header' ? ['Sync Word   A5F3C7D2', 'Frame Len   2000 bytes', 'Frame ID    0x0412', 'Flags       0x40', 'Version     1', 'Header CRC  Valid'] : [0, 1, 2, 3, 4, 5].map(i => BY.slice(4 + i * 16, 20 + i * 16).map(asc).join(''));
  const [draw, hh] = V[tab], complete = done >= 6, d = now, pr = Math.min(42.6, done * 7.1).toFixed(1);
  return <div className="shell">
    <aside className="side">
      <div className="logo"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e8e6e3" strokeWidth="2.4"><path d="M20 3l15 12-15 22L5 15z" /><path d="M12 17c4-6 8 6 16 0" /></svg><div><b>SIG-SCOPE</b><small>Signal Intelligence Platform</small></div></div>
      {[[Home, 'Dashboard'], [FileText, 'File Analyzer'], [Radio, 'Live SDR'], [FileText, 'Reports'], [Settings, 'Settings']].map(([I, n], i) => <button key={n} className={'nav' + (i ? '' : ' a')}><I size={19} />{n}</button>)}
      <svg className="wave" viewBox="0 0 228 120" fill="none" stroke="#c9b48f" strokeWidth="1.2"><path d="M0 80c20 0 24-4 40 0s20-60 34-40 16 70 34 30 20-70 32-50 20 50 40 30 30-20 48-10" /></svg>
      <div className="ntro"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#c9b48f" strokeWidth="1.6"><circle cx="24" cy="24" r="22" /><circle cx="24" cy="24" r="17" strokeDasharray="2 2" /><path d="M24 12l9 4v8c0 6-4 10-9 12-5-2-9-6-9-12v-8z" /></svg><div><b>NTRO</b><small>National Technical Research Organisation</small><small>Signal · Analysis · Security</small></div></div>
    </aside>
    <div className="content-area">
      <header className="top"><span className="t">From Raw Waveforms to Decoded Intelligence</span>
        <div className="off"><i /><div><b>Offline Mode</b><small>Local Processing</small></div></div>
        <div className="clk">{d ? d.toLocaleTimeString('en-GB') : '--:--:--'}<small>{d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small></div>
        <div className="usr"><span className="av"><User size={18} /></span><div><b style={{ fontSize: 12 }}>Analyst</b><small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>NTRO</small></div><ChevronDown size={14} /></div></header>
      <div className="main">
        <div className="c fh"><span className="fic"><FileText size={24} /></span><div><h2>capture_20260917_124530.iq</h2><small>IQ File • 256 MB • 4.096 Msps • Complex64</small></div>
          <span className="sp" /><span className={'pill' + (complete ? '' : ' w')}><CheckCircle2 size={14} />{complete ? 'Analysis Complete' : 'Analyzing…'}</span><span>Processing Time: <b>{pr}s</b></span><span className="sp" />
          <button className="btn d" onClick={() => setDone(0)}><Upload size={15} />Load File</button><button className="btn" disabled={!complete}><Download size={15} />Export Report</button><button className="btn sq"><MoreHorizontal size={16} /></button></div>
        <div className="grid"><div className="l">
          <div className="c"><h3 style={{ fontSize: 15 }}>Detected Parameters</h3>
            <div className="tiles">
              {PARAMS.map(([I, k, v, c, sub], i) => <div className="tile" key={k} style={{ opacity: done >= Math.min(i + 1, 2) ? 1 : .35 }}>
                <div className="tile-top"><span className="tile-ic"><I size={14} /></span><span className="tile-lbl">{k}</span></div>
                <div className="tile-val"><b>{v}</b>{sub && <span className="tile-sub">{sub}</span>}</div>
                <div className="tile-ftr">Confidence: {c}</div>
              </div>)}
            </div>
          </div>
          <div className="cs">
            <div className="c"><h3><Activity size={16} /><span>Spectrum</span><span className="sp" /><Sel v="Live" /></h3><Cv w={330} h={230} draw={dSpec} /></div>
            <div className="c"><h3><Grip size={16} /><span>Waterfall</span> <em>(Time-Freq)</em><span className="sp" /><Sel v="Live" /></h3><div className="cb"><div style={{ flex: 1, minWidth: 0 }}><Cv w={290} h={230} draw={dWf} /></div><div className="bar" /><div className="cbl">{[-20, -40, -60, -80, -100].map(v => <span key={v}>{v} dB</span>)}</div></div></div>
            <div className="c"><h3><Grip size={16} /><span>Constellation</span><span className="sp" /><Sel v="QPSK" /></h3><Cv w={330} h={230} draw={dCon} /></div></div>
          <div className="c"><h3><Activity size={16} />Analysis Pipeline<span className="sp" /><span className="pill" style={{ padding: '3px 10px', fontSize: 11, background: complete ? '#e3f6ec' : '#fdf1dc', color: complete ? '#1f9d6b' : '#d98a0b' }}>{complete ? 'Completed' : 'Running'}</span></h3>
            <div className="pl">{STEPS.map(([I, t, a, b], i) => <div key={t} className={'st' + (i < done ? '' : ' p')}><span className="st-ic"><I size={15} /></span><h4>{i + 1}. {t}</h4><small>{a}</small>{b && <small>{b}</small>}{i < done && <CheckCircle2 className="ck" size={15} />}{i < 5 && <ArrowRight className="ar" size={13} />}</div>)}</div></div>
          <div className="b3">
            <div className="c"><h3><Layers size={16} />Visualizations</h3><div className="tabs">{Object.keys(V).map(k => <button key={k} className={tab === k ? 'a' : ''} onClick={() => setTab(k)}>{k}</button>)}</div>
              <div style={{ display: 'flex', gap: 8 }}><div style={{ flex: 1, minWidth: 0 }}><Cv w={340} h={hh} draw={draw} /></div><div className="inf">Center:<b>0.000 MHz</b><br />Span:<b>4.096 MHz</b><br />RBW:<b>10 kHz</b></div></div></div>
            <div className="c"><h3><Waves size={16} />Decoded Bitstream View</h3><div className="tabs">{['Binary', 'Hex', 'ASCII'].map(k => <button key={k} className={fmt === k ? 'a' : ''} onClick={() => setFmt(k)}>{k}</button>)}</div>
              <div className="term">{lines.map((l, i) => <div key={i}><i>{String(pg * 32 + i + 1).padStart(4, '0')}</i>{l}</div>)}</div>
              <div className="pg">Showing 1,024 bits (of 8,192)<span className="sp" />Page <b>{pg + 1} / 8</b><button aria-label="Previous page" onClick={() => setPg(p => Math.max(0, p - 1))}><ChevronLeft size={13} /></button><button aria-label="Next page" onClick={() => setPg(p => Math.min(7, p + 1))}><ChevronRight size={13} /></button></div></div>
            <div className="c sm"><h3><Signal size={16} />Signal Summary</h3>{[[FileText, 'File Name', 'capture_20260917_124530.iq'], [Clock, 'Duration', '30.00 s'], [Grip, 'Samples', '122,880,000'], [Layers, 'Format', 'Complex64 (IQ)'], [Radio, 'Source Band', 'VHF (Estimated)'], [Activity, 'SNR (Estimated)', '18.4 dB']].map(([I, k, v]) => <div key={k}><I size={15} /><span>{k}</span><b style={{ fontSize: 11 }}>{v}</b></div>)}</div></div>
        </div>
          <div className="r">
            <div className="c"><h3 style={{ fontSize: 15 }}>Detected Parameters</h3>{PARAMS.map(([I, k, v, , sub], i) => <div className="pr" key={k}><span className="ic" style={{ width: 24, height: 24, background: 'none' }}><I size={15} /></span><span>{k}</span><b style={{ fontSize: 11.5 }}>{v}{sub ? ' ' + sub : ''}</b><i className={'lv' + (i === 5 ? ' w' : '')}>{i === 5 ? 'Medium' : 'High'}</i></div>)}</div>
            <div className="c"><h3><Timer size={16} />Decoded Output</h3><div className="tabs f">{['Bitstream', 'Header', 'Payload'].map(k => <button key={k} className={out === k ? 'a' : ''} onClick={() => setOut(k)}>{k}</button>)}</div>
              <div className="term" style={{ height: 'auto', background: '#fff', color: '#1b1f27', border: '1px solid #e7e9ee', fontSize: 10.5 }}>{outL.map((l, i) => <div key={i}><i>{i + 1}</i>{l}</div>)}</div></div>
            <div className="c"><h3>Data Summary</h3>{[['Header (Sync Word)', '0xA5F3C7D2', 'Detected'], ['Payload Length', '8,192 bytes', 'Detected'], ['CRC Check', 'Pass', 'Valid']].map(([k, v, s]) => <div className="row2" key={k}><span>{k}</span><b style={{ fontWeight: 400 }}>{v}</b><i className="lv" style={{ fontStyle: 'normal' }}>{s}</i></div>)}
              <div className="ok" style={{ marginTop: 10, opacity: complete ? 1 : .4 }}><CheckCircle2 size={30} color="#1f9d6b" /><div><b>Decoding Successful</b><small>Signal successfully demodulated, de-interleaved, FEC decoded and correlated.</small></div></div></div>
          </div></div>
      </div></div></div>
}
