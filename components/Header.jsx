'use client';
import { useState, useEffect } from 'react';
import { User, ChevronDown, Shield, Check, Lock, Sun, Moon } from 'lucide-react';

export default function Header({ 
  subtitle = 'From Raw Waveforms to Decoded Intelligence' 
}) {
  const [timeLocal, setTimeLocal] = useState('--:--:--');
  const [timeUtc, setTimeUtc] = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('sigscope_theme', 'light');
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = 'light';
      }
    } catch (e) {}

    const updateTime = () => {
      const now = new Date();
      setTimeLocal(now.toLocaleTimeString('en-GB'));
      setTimeUtc(now.toUTCString().slice(17, 25));
      setDateStr(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="top">
      <h1 className="top-title">
        From Raw Waveforms <span style={{ color: 'var(--text-secondary)' }}>to Decoded Intelligence</span>
      </h1>

      {/* Offline Mode Pill with Green Dot */}
      <div className="offline-pill" title="Local processing only">
        <i />
        <span>Offline Mode</span>
      </div>

      {/* Single Digital Clock with Date & UTC Tooltip */}
      <div className="clk-single" title={`UTC: ${timeUtc} | Local Ground Station: ${timeLocal}`}>
        <b>{timeLocal}</b>
        <small>{dateStr}</small>
      </div>

      {/* Analyst/NTRO Menu */}
      <div 
        className="usr-chip" 
        onClick={() => setUserMenuOpen(!userMenuOpen)} 
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <span className="usr-av">
          <User size={15} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <b style={{ fontSize: 12, color: 'var(--text-main)' }}>Analyst</b>
          <small style={{ color: 'var(--text-secondary)', fontSize: 10 }}>NTRO</small>
        </div>
        <ChevronDown size={14} color="var(--text-secondary)" style={{ marginLeft: 2 }} />

        {userMenuOpen && (
          <div 
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 10,
              background: 'var(--bg-card-elevated)',
              backdropFilter: 'var(--card-backdrop)',
              WebkitBackdropFilter: 'var(--card-backdrop)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 16,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              padding: 14,
              zIndex: 50,
              minWidth: 230
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ borderBottom: '1px solid var(--border-hairline)', paddingBottom: 8, marginBottom: 8 }}>
              <b style={{ display: 'block', fontSize: 12, color: 'var(--text-main)' }}>NTRO SIGINT Division</b>
              <small style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Station: Air-Gapped Localhost</small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-main)', padding: '4px 0' }}>
              <Shield size={13} color="var(--accent-purple)" /> SIH 2026 Space Telemetry
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)', padding: '4px 0' }}>
              <Lock size={13} color="var(--text-secondary)" /> Air-Gap Status: Active
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--accent-lime)', padding: '4px 0' }}>
              <Check size={13} /> DSP Engine: Real Active
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
