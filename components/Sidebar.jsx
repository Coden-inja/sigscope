'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Radio, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Activity,
  BarChart2,
  Cpu
} from 'lucide-react';

export default function Sidebar({ collapsed: propCollapsed, onToggle: propOnToggle, activeNavTab, onSelectTab }) {
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Sync with localStorage so collapse state persists seamlessly across all pages
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sigscope_sidebar_collapsed');
      if (saved !== null) {
        setInternalCollapsed(saved === 'true');
      }
    } catch (e) {}
  }, []);

  const isCollapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;

  const handleToggle = () => {
    const nextState = !isCollapsed;
    setInternalCollapsed(nextState);
    try {
      localStorage.setItem('sigscope_sidebar_collapsed', String(nextState));
    } catch (e) {}
    if (propOnToggle) {
      propOnToggle();
    }
    // Dispatch resize after transition completes so all canvas charts recalculate exact pixel dimensions
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 280);
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Home, isTab: true, tabName: 'Dashboard' },
    { label: 'Live SDR', href: '/live-sdr', icon: Radio },
    { label: 'Mission Reports', href: '/reports', icon: BarChart2 },
    { label: 'System Blueprint', href: '/?view=blueprint', icon: Cpu, isTab: true, tabName: 'System Blueprint' },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className={`side ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Small circled arrow toggle button positioned neatly on the right edge */}
      <button 
        type="button"
        id="sidebar-collapse-btn"
        className="collapse-toggle-btn"
        onClick={handleToggle}
        aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Logo */}
      <Link href="/" className="logo-link">
        <div className="logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ flexShrink: 0, color: 'var(--accent-purple)' }}>
            <path d="M20 3l15 12-15 22L5 15z" />
            <path d="M12 17c4-6 8 6 16 0" />
          </svg>
          {!isCollapsed && (
            <div className="logo-text">
              <b>SIG-SCOPE</b>
            </div>
          )}
        </div>
      </Link>

      {/* Navigation Links */}
      <nav className="nav-container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isInPageTab = onSelectTab && pathname === '/' && item.isTab;
          const isActive = isInPageTab 
            ? activeNavTab === item.tabName
            : (pathname === item.href || (item.href !== '/' && !item.href.includes('?') && pathname.startsWith(item.href)));

          if (isInPageTab) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onSelectTab(item.tabName)}
                className={`nav ${isActive ? 'a' : ''}`}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="nav-icon"><Icon size={19} /></span>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          }

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`nav ${isActive ? 'a' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="nav-icon"><Icon size={19} /></span>
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
            </Link>
          );
        })}
      </nav>


      {/* Challenge Sponsor Attribution Badge */}
      <div className="ntro" title="Problem Statement Sponsor: National Technical Research Organisation (SIH 2026)">
        <svg width={isCollapsed ? "32" : "36"} height={isCollapsed ? "32" : "36"} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="24" cy="24" r="22" stroke="var(--accent-purple)" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="24" cy="24" r="17" stroke="var(--accent-lime)" strokeWidth="1.2" strokeDasharray="3 3" />
          <path d="M24 10l10 4.5v9c0 7-5 12-10 14.5-5-2.5-10-7.5-10-14.5v-9z" fill="rgba(109, 58, 232, 0.08)" stroke="var(--accent-purple)" strokeWidth="1.8" />
          <circle cx="24" cy="23" r="3.5" fill="var(--accent-lime)" />
        </svg>
        {!isCollapsed && (
          <div className="ntro-text" style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.06em', color: 'var(--accent-purple)', textTransform: 'uppercase', fontWeight: 700, display: 'block', lineHeight: 1.2 }}>SPONSOR</span>
            <b style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em', lineHeight: 1.2 }}>NTRO</b>
            <small style={{ color: 'var(--text-secondary)', fontSize: 9.5, lineHeight: 1.25, display: 'block', marginTop: 1 }}>National Technical Research Organisation</small>
            <span style={{ color: 'var(--text-muted)', fontSize: 8.5, display: 'block', marginTop: 2 }}>Problem Statement SIH26147</span>
          </div>
        )}
      </div>
    </aside>
  );
}
