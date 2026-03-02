import type { ReactElement } from 'react';

function Home(): ReactElement {
  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <img 
        src="./sphere.svg" 
        alt="" 
        style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          width: 600, 
          height: 600, 
          opacity: 0.3, 
          pointerEvents: 'none',
          zIndex: 0
        }} 
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
          <h1 className="page-title">DASHBOARD</h1>
          <p className="page-subtitle">SYSTEM OVERVIEW</p>
        </div>
      
        <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">System Status</div>
          <div className="stat-value success">ONLINE</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Sensors</div>
          <div className="stat-value">4</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Coverage Area</div>
          <div className="stat-value">47.3 km²</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Uptime</div>
          <div className="stat-value">99.9%</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">Quick Actions</div>
        <div className="card-content">
          
          <p>Navigate to <strong style={{ color: '#00d4ff' }}>Live</strong> to view real-time drone activity, or check <strong style={{ color: '#00d4ff' }}>Reports</strong> for historical data and analytics.</p>
        </div>
      </div>
      </div>
    </div>
  );
}

export default Home;
