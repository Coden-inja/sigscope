'use client';
import { useState, useEffect } from 'react';
import { User, ChevronDown, Shield, Check, Lock, Database, Cpu } from 'lucide-react';

export default function Header({ 
  subtitle = 'From Raw Waveforms to Decoded Intelligence',
  mockMode = false,
  onToggleMock = null 
}) {
  const [timeStr, setTimeStr] = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-GB'));
      setDateStr(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="top">
      <span className="t">{subtitle}</span>

      {/* Mock Data / Real DSP Pipeline Toggle Button */}
      <div className="mock-toggle-wrapper">
        <button
          type="button"
          id="mock-mode-toggle-btn"
          className={`mock-toggle-btn ${mockMode ? 'mock-active' : 'real-active'}`}
          onClick={() => {
            if (onToggleMock) onToggleMock(!mockMode);
          }}
          title={mockMode ? 'Switch to Real DSP Signal Breakdown Engine' : 'Switch to Static Mock Preset Baseline'}
        >
          {mockMode ? <Database size={13} /> : <Cpu size={13} />}
          <span>{mockMode ? 'Mock Data: ON' : 'Real DSP: ACTIVE'}</span>
          <span className={`mock-indicator ${mockMode ? 'amber' : 'green'}`} />
        </button>
      </div>

      {/* Offline Mode indicator */}
      <div className="off" title="Air-gapped local workstation processing: zero cloud communication">
        <i />
        <div>
          <b>Offline Mode</b>
          <small>Local Processing</small>
        </div>
      </div>

      {/* Real-time Digital Clock */}
      <div className="clk">
        {timeStr}
        <small>{dateStr}</small>
      </div>

      {/* User Profile */}
      <div 
        className="usr" 
        onClick={() => setUserMenuOpen(!userMenuOpen)} 
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <span className="av">
          <User size={18} />
        </span>
        <div>
          <b style={{ fontSize: 12 }}>Analyst</b>
          <small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>NTRO</small>
        </div>
        <ChevronDown size={14} />

        {userMenuOpen && (
          <div 
            className="user-dropdown-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dropdown-header">
              <b>Analyst NTRO-145380</b>
              <small>Station: Local Workstation (Air-Gapped)</small>
            </div>
            <div className="dropdown-item">
              <Shield size={14} color="#1f9d6b" /> Clearance: Tier-1 TS/SCI
            </div>
            <div className="dropdown-item">
              <Lock size={14} color="#6b7280" /> Air-Gap Status: Active
            </div>
            <div className="dropdown-item" style={{ color: '#1f9d6b' }}>
              <Check size={14} /> Local DSP Engine: {mockMode ? 'Mock Emulated' : 'Real Active'}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
