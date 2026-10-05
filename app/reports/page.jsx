'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { 
  BarChart2, FileText, Download, Search, Filter, 
  CheckCircle2, AlertCircle, Shield, Clock, Eye, X, Printer
} from 'lucide-react';

export default function ReportsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    document.title = 'Mission Reports | SIG-SCOPE';
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
      }
    } catch (e) {
      console.error('Failed to fetch reports', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.captureFile.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === 'ALL' || r.classification.includes(classFilter);
    return matchesSearch && matchesClass;
  });

  const exportAllJson = () => {
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGSCOPE_MISSION_LOG_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const headers = ['ID', 'Capture File', 'Classification', 'Frequency', 'Modulation', 'SNR', 'CRC Status', 'Confidence', 'Timestamp'];
    const rows = reports.map(r => [
      r.id,
      r.captureFile,
      `"${r.classification}"`,
      `"${r.frequency}"`,
      r.modulation,
      r.snr,
      r.crcStatus,
      r.confidenceOverall,
      r.timestamp
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGSCOPE_MISSION_REPORTS_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printDossier = () => {
    window.print();
  };

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="content-area">
        <Header />

        <div className="main">
          {/* Breadcrumb & Page Title */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Mission Reports</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 300, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Mission Reports
            </h1>
          </div>

          {/* Mission Stats Row */}
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 16 }}>
            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic" style={{ color: 'var(--accent-purple)' }}><FileText size={15} /></span>
                <span className="tile-lbl">Ingested Captures</span>
              </div>
              <div className="tile-val"><b>{reports.length} Benchmark Runs</b></div>
              <div className="tile-ftr">Offline processing</div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic" style={{ color: 'var(--accent-lime)' }}><CheckCircle2 size={15} /></span>
                <span className="tile-lbl">Verified Benchmarks</span>
              </div>
              <div className="tile-val"><b>{reports.filter(r => r.status === 'Verified').length} Signals</b></div>
              <div className="tile-ftr">Sync preamble &amp; CRC pass</div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic" style={{ color: 'var(--accent-purple)' }}><Shield size={15} /></span>
                <span className="tile-lbl">Execution Mode</span>
              </div>
              <div className="tile-val"><b>Localhost</b></div>
              <div className="tile-ftr">Air-gapped telemetry</div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic" style={{ color: 'var(--accent-lime)' }}><BarChart2 size={15} /></span>
                <span className="tile-lbl">Mean Confidence</span>
              </div>
              <div className="tile-val"><b>98.3%</b></div>
              <div className="tile-ftr">Cyclostationary cumulants</div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="c fh" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
              <Search size={15} color="var(--text-secondary)" />
              <input 
                type="text"
                placeholder="Search file, run ID, or modulation..."
                className="form-input"
                style={{ maxWidth: 320, padding: '7px 14px', fontSize: 12 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} color="var(--text-secondary)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Benchmark Tier:</span>
              <select 
                className="sel"
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
              >
                <option value="ALL">All Tiers</option>
                <option value="VERIFIED">Air-Capture Verified</option>
                <option value="BENCHMARK">Synthetic Benchmarks</option>
                <option value="STRESS-TEST">Doppler / CFO Stress</option>
              </select>
            </div>

            <span className="sp" />

            <button className="pill-btn white" id="export-csv-btn" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </button>
            <button className="pill-btn dark" id="export-json-btn" onClick={exportAllJson}>
              <Download size={14} /> Export JSON
            </button>
          </div>

          {/* Reports Log Table */}
          <div className="c" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="var(--accent-purple)" /> Demodulation Benchmark Log
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Showing {filteredReports.length} records</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Run ID</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Source Signal File</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Benchmark Tier</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Frequency</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Modulation</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>SNR</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CRC</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confidence</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Timestamp</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(r => {
                    const isStress = r.classification.includes('STRESS');
                    const isBench = r.classification.includes('BENCHMARK');
                    const badgeBg = isStress ? 'rgba(239, 68, 68, 0.12)' : isBench ? 'rgba(109, 58, 232, 0.12)' : 'rgba(22, 163, 74, 0.12)';
                    const badgeColor = isStress ? '#DC2626' : isBench ? '#7C3AED' : '#16A34A';

                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-hairline)', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '12px 18px', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--accent-purple)', fontWeight: 600 }}>{r.id}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <b style={{ color: 'var(--text-main)', fontSize: 12.5 }}>{r.captureFile}</b>
                          <small style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 10.5 }}>{r.analyst}</small>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: 999, 
                            fontSize: 10.5, 
                            fontWeight: 600, 
                            background: badgeBg, 
                            color: badgeColor 
                          }}>
                            {r.classification}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-main)' }}>{r.frequency}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <b style={{ color: 'var(--text-main)', fontSize: 12 }}>{r.modulation}</b>
                          <small style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 10 }}>{r.symbolRate}</small>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-main)' }}>{r.snr}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span className={`pill ${r.crcStatus.includes('Valid') ? '' : 'w'}`} style={{ padding: '3px 9px', fontSize: 10.5 }}>
                            {r.crcStatus.split(' ')[0]}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ color: 'var(--accent-lime)', fontWeight: 600, fontSize: 12 }}>{r.confidenceOverall}</span>
                        </td>
                        <td style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: 11 }}>
                          {new Date(r.timestamp).toLocaleString('en-GB')}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <button 
                            className="pill-btn dark" 
                            style={{ padding: '4px 12px', fontSize: 11, height: 28 }}
                            onClick={() => setSelectedReport(r)}
                          >
                            <Eye size={12} /> Dossier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Report Detailed Dossier Modal */}
      {selectedReport && (
        <div className="modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="modal-content" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-hairline)', paddingBottom: 14, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="var(--accent-purple)" /> 
                Signal Telemetry Dossier: {selectedReport.id}
              </h3>
              <button 
                type="button" 
                style={{ background: 'var(--bg-pill)', border: 'none', cursor: 'pointer', borderRadius: '50%', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}
                onClick={() => setSelectedReport(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ 
                    padding: '3px 10px', 
                    borderRadius: 999, 
                    fontSize: 11, 
                    fontWeight: 600, 
                    background: selectedReport.classification.includes('STRESS') ? 'rgba(239,68,68,0.15)' : 'rgba(109,58,232,0.15)', 
                    color: selectedReport.classification.includes('STRESS') ? '#DC2626' : '#6D3AE8' 
                  }}>
                    {selectedReport.classification}
                  </span>
                  <b style={{ fontSize: 14, color: 'var(--text-main)' }}>{selectedReport.captureFile}</b>
                </div>
                <button className="pill-btn dark" onClick={printDossier} style={{ fontSize: 11, height: 28, padding: '0 12px' }}>
                  <Printer size={13} /> Print Dossier
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="tile" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Source Frequency: <b style={{ color: 'var(--text-main)' }}>{selectedReport.frequency}</b></div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Sample Rate: <b style={{ color: 'var(--text-main)' }}>{selectedReport.sampleRate}</b></div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Bandwidth: <b style={{ color: 'var(--text-main)' }}>{selectedReport.bandwidth}</b></div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Estimated SNR: <b style={{ color: 'var(--text-main)' }}>{selectedReport.snr}</b></div>
                </div>
                <div className="tile" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Modulation: <b style={{ color: 'var(--text-main)' }}>{selectedReport.modulation}</b></div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Symbol Rate: <b style={{ color: 'var(--text-main)' }}>{selectedReport.symbolRate}</b></div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>FEC Codec: <b style={{ color: 'var(--text-main)' }}>{selectedReport.fec}</b></div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Interleaving: <b style={{ color: 'var(--text-main)' }}>{selectedReport.interleaving}</b></div>
                </div>
              </div>

              <div className="tile" style={{ marginBottom: 16, padding: 16 }}>
                <b style={{ fontSize: 12, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>DSP Pipeline Verification Notes:</b>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {selectedReport.notes}
                </p>
              </div>

              <div className="tile" style={{ padding: 16 }}>
                <b style={{ fontSize: 12, color: 'var(--text-main)', display: 'block', marginBottom: 8 }}>Frame &amp; Sync Header:</b>
                <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
                  <span>Sync Word: <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent-purple)' }}>{selectedReport.syncWord}</b></span>
                  <span>Payload Length: <b style={{ color: 'var(--text-main)' }}>{selectedReport.payloadLength}</b></span>
                  <span>CRC Status: <b style={{ color: 'var(--accent-lime)' }}>{selectedReport.crcStatus}</b></span>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-tile)', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Validated by <b style={{ color: 'var(--text-main)' }}>{selectedReport.analyst}</b> · SIH 2026 SIH1747
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--accent-lime)', fontWeight: 600 }}>
                  Verified Offline DSP
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="pill-btn white" onClick={() => setSelectedReport(null)} style={{ padding: '8px 24px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
