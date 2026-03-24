import { useState, type ReactElement } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Live from './pages/Live';
import Reports from './pages/Reports';
import About from './pages/About';
import './App.css';

function App(): ReactElement {
  const loc = useLocation();
  const path = loc.pathname.split('/')[1] || '';
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  
  const nav = [
    { id: "", label: "HOME", icon: "⌂", iconStyle: { fontSize: 22 } },
    { id: "live", label: "LIVE", icon: "◉", iconStyle: {} },
    { id: "reports", label: "REPORTS", icon: "⊞", iconStyle: {} },
  ] as const;

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
        <div className="logo"><img src="./logo.png" alt="R2" /></div>
        <nav className="nav">
          {nav.map(n => (
            <Link key={n.id} to={`/${n.id}`} className={`nav-link ${path === n.id ? 'active' : ''}`} title={n.label}>
              <span className="nav-icon" style={n.iconStyle}>{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </Link>
          ))}
        </nav>
        {/* About link at bottom */}
        <div style={{ marginTop: 'auto' }} className="nav">
          <Link to="/about" className={`nav-link ${path === 'about' ? 'active' : ''}`} title="ABOUT">
            <span className="nav-icon">ⓘ</span>
            <span className="nav-label">ABOUT</span>
          </Link>
        </div>
        {/* Expand/collapse toggle */}
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          title={sidebarExpanded ? "Collapse" : "Expand"}
        >
          {sidebarExpanded ? '‹' : '›'}
        </button>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live/*" element={<Live />} />
          <Route path="/reports/*" element={<Reports />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
