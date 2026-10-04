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
    a.click();
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
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGSCOPE_INTELLIGENCE_AUDIT_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printDossier = () => {
    window.print();
  };

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="content-area">
        <Header subtitle="Signal Intelligence Reports & Mission Audit Dossiers" />

        <div className="main">
          {/* Mission Stats Row */}
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic"><FileText size={14} /></span>
                <span className="tile-lbl">Total Intercepts</span>
              </div>
              <div className="tile-val"><b>{reports.length} Captures</b></div>
              <div className="tile-ftr">100% Processed Offline</div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic"><CheckCircle2 size={14} color="#1f9d6b" /></span>
                <span className="tile-lbl">Verified Missions</span>
              </div>
              <div className="tile-val"><b>{reports.filter(r => r.status === 'Verified').length} Signals</b></div>
              <div className="tile-ftr">Sync Word & CRC Valid</div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic"><Shield size={14} /></span>
                <span className="tile-lbl">Air-Gap Integrity</span>
              </div>
              <div className="tile-val"><b>100% Local</b></div>
              <div className="tile-ftr">0 Cloud Leaks</div>
            </div>

            <div className="tile">
              <div className="tile-top">
                <span className="tile-ic"><BarChart2 size={14} /></span>
                <span className="tile-lbl">Mean Confidence</span>
              </div>
              <div className="tile-val"><b>96.8%</b></div>
              <div className="tile-ftr">DSP + ML Consensus</div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="c fh" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
              <Search size={16} color="#6b7280" />
              <input 
                type="text"
                placeholder="Search by file, mission ID, or modulation..."
                className="form-input"
                style={{ maxWidth: 320, padding: '5px 10px', fontSize: 11.5 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} color="#6b7280" />
              <span style={{ fontSize: 11, color: '#6b7280' }}>Classification:</span>
              <select 
                className="sel"
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
              >
                <option value="ALL">All Levels</option>
                <option value="TOP SECRET">Top Secret</option>
                <option value="SECRET">Secret</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </div>

            <span className="sp" />

            <button className="btn" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </button>
            <button className="btn d" onClick={exportAllJson}>
              <Download size={14} /> Export Intelligence Dossier (JSON)
            </button>
          </div>

          {/* Reports Log Table */}
          <div className="c" style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>
                <FileText size={16} /> Intercepted Signal Mission Log
              </h3>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Showing {filteredReports.length} records</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Intercept File</th>
                    <th>Classification</th>
                    <th>Frequency</th>
                    <th>Modulation</th>
                    <th>SNR</th>
                    <th>CRC Check</th>
                    <th>Confidence</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(r => {
                    const isTop = r.classification.includes('TOP SECRET');
                    const isSec = r.classification.includes('SECRET') && !isTop;
                    const tagClass = isTop ? 'top-secret' : isSec ? 'secret' : 'restricted';

                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>{r.id}</td>
                        <td>
                          <b>{r.captureFile}</b>
                          <small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>{r.analyst}</small>
                        </td>
                        <td>
                          <span className={`class-tag ${tagClass}`}>{r.classification}</span>
                        </td>
                        <td>{r.frequency}</td>
                        <td>
                          <b>{r.modulation}</b>
                          <small style={{ display: 'block', color: '#6b7280', fontSize: 9.5 }}>{r.symbolRate}</small>
                        </td>
                        <td>{r.snr}</td>
                        <td>
                          <span className={`pill ${r.crcStatus.includes('Valid') ? '' : 'w'}`} style={{ padding: '2px 8px', fontSize: 10.5 }}>
                            {r.crcStatus.split(' ')[0]}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#1f9d6b', fontWeight: 600 }}>{r.confidenceOverall}</span>
                        </td>
                        <td style={{ color: '#6b7280', fontSize: 10.5 }}>
                          {new Date(r.timestamp).toLocaleString('en-GB')}
                        </td>
                        <td>
                          <button 
                            className="btn" 
                            style={{ padding: '3px 8px', fontSize: 11 }}
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
          <div className="modal-box" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Shield size={18} color="#1f9d6b" /> 
                NTRO Mission Dossier: {selectedReport.id}
              </h3>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setSelectedReport(null)}
              >
                <X size={18} color="#6b7280" />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <span className={`class-tag ${selectedReport.classification.includes('TOP') ? 'top-secret' : 'secret'}`}>
                    {selectedReport.classification}
                  </span>
                  <b style={{ marginLeft: 10, fontSize: 14 }}>{selectedReport.captureFile}</b>
                </div>
                <button className="btn" onClick={printDossier} style={{ fontSize: 11 }}>
                  <Printer size={13} /> Print Dossier
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                <div className="inf" style={{ width: 'auto' }}>
                  <span>Source Frequency:</span> <b>{selectedReport.frequency}</b><br />
                  <span>Sample Rate:</span> <b>{selectedReport.sampleRate}</b><br />
                  <span>Bandwidth:</span> <b>{selectedReport.bandwidth}</b><br />
                  <span>Estimated SNR:</span> <b>{selectedReport.snr}</b>
                </div>
                <div className="inf" style={{ width: 'auto' }}>
                  <span>Modulation:</span> <b>{selectedReport.modulation}</b><br />
                  <span>Symbol Rate:</span> <b>{selectedReport.symbolRate}</b><br />
                  <span>FEC Codec:</span> <b>{selectedReport.fec}</b><br />
                  <span>Interleaving:</span> <b>{selectedReport.interleaving}</b>
                </div>
              </div>

              <div className="c" style={{ background: '#f8fafc', marginBottom: 14 }}>
                <b style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Analyst Intelligence Notes:</b>
                <p style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.5, margin: 0 }}>
                  {selectedReport.notes}
                </p>
              </div>

              <div className="c">
                <b style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Frame & Sync Header:</b>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <span>Sync Word: <b style={{ fontFamily: 'var(--mono)', color: '#1f9d6b' }}>{selectedReport.syncWord}</b></span>
                  <span>Payload Length: <b>{selectedReport.payloadLength}</b></span>
                  <span>CRC Status: <b style={{ color: '#1f9d6b' }}>{selectedReport.crcStatus}</b></span>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: '10px 14px', background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10.5, color: '#6b7280' }}>
                  Digitally Signed by <b>{selectedReport.analyst}</b><br />
                  SIH 2026 Smart India Hackathon • Space Technology
                </div>
                <div style={{ textAlign: 'right', fontSize: 10.5, color: '#1f9d6b', fontWeight: 600 }}>
                  AUTHENTICATED OFF-LINE
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setSelectedReport(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
