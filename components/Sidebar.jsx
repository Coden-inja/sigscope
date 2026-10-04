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

export default function Sidebar({ collapsed: propCollapsed, onToggle: propOnToggle }) {
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
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Home },
    { label: 'Live SDR', href: '/live-sdr', icon: Radio },
    { label: 'Mission Reports', href: '/reports', icon: BarChart2 },
    { label: 'System Blueprint', href: '/?view=blueprint', icon: Cpu },
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
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e8e6e3" strokeWidth="2.4" style={{ flexShrink: 0 }}>
            <path d="M20 3l15 12-15 22L5 15z" />
            <path d="M12 17c4-6 8 6 16 0" />
          </svg>
          {!isCollapsed && (
            <div className="logo-text">
              <b>SIG-SCOPE</b>
              <small>Signal Intelligence Platform</small>
            </div>
          )}
        </div>
      </Link>

      {/* Navigation Links */}
      <nav className="nav-container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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

      {/* Wave decoration (hidden when collapsed) */}
      {!isCollapsed && (
        <svg className="wave" viewBox="0 0 228 120" fill="none" stroke="#c9b48f" strokeWidth="1.2">
          <path d="M0 80c20 0 24-4 40 0s20-60 34-40 16 70 34 30 20-70 32-50 20 50 40 30 30-20 48-10" />
        </svg>
      )}

      {/* NTRO Badge */}
      <div className="ntro">
        <svg width={isCollapsed ? "34" : "44"} height={isCollapsed ? "34" : "44"} viewBox="0 0 48 48" fill="none" stroke="#c9b48f" strokeWidth="1.6" style={{ flexShrink: 0 }}>
          <circle cx="24" cy="24" r="22" />
          <circle cx="24" cy="24" r="17" strokeDasharray="2 2" />
          <path d="M24 12l9 4v8c0 6-4 10-9 12-5-2-9-6-9-12v-8z" />
        </svg>
        {!isCollapsed && (
          <div className="ntro-text">
            <b>NTRO</b>
            <small>National Technical Research Organisation</small>
            <small>Signal · Analysis · Security</small>
          </div>
        )}
      </div>
    </aside>
  );
}
