function Reports() {
  const mockData = [
    { date: '2024-03-01', detected: 47, critical: 3, high: 8, medium: 15, low: 21 },
    { date: '2024-02-29', detected: 52, critical: 5, high: 12, medium: 18, low: 17 },
    { date: '2024-02-28', detected: 38, critical: 2, high: 6, medium: 12, low: 18 },
    { date: '2024-02-27', detected: 61, critical: 7, high: 14, medium: 22, low: 18 },
    { date: '2024-02-26', detected: 44, critical: 4, high: 9, medium: 14, low: 17 },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">REPORTS</h1>
        <p className="page-subtitle">HISTORICAL DATA & ANALYTICS</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Detections (7d)</div>
          <div className="stat-value">242</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical Threats</div>
          <div className="stat-value danger">21</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Response Time</div>
          <div className="stat-value">2.4s</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Detection Rate</div>
          <div className="stat-value success">98.7%</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">Recent Activity</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.15)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#00d4ff88', letterSpacing: 1.5, fontWeight: 700 }}>DATE</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#00d4ff88', letterSpacing: 1.5, fontWeight: 700 }}>DETECTED</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#ff2d55', letterSpacing: 1.5, fontWeight: 700 }}>CRITICAL</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#ff8c00', letterSpacing: 1.5, fontWeight: 700 }}>HIGH</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#ffd60a', letterSpacing: 1.5, fontWeight: 700 }}>MEDIUM</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#30d158', letterSpacing: 1.5, fontWeight: 700 }}>LOW</th>
              </tr>
            </thead>
            <tbody>
              {mockData.map(row => (
                <tr key={row.date} style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.06)' }}>
                  <td style={{ padding: '12px 16px', color: '#7ecfff' }}>{row.date}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e8eaf0', fontWeight: 700 }}>{row.detected}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ff2d55' }}>{row.critical}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ff8c00' }}>{row.high}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ffd60a' }}>{row.medium}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#30d158' }}>{row.low}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Reports
