import type { ReactElement } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Live from './pages/Live';
import Reports from './pages/Reports';
import About from './pages/About';
import './App.css';

function App(): ReactElement {
  const loc = useLocation();
  const path = loc.pathname.split('/')[1] || '';
  
  const nav = [
    { id: "", label: "HOME" },
    { id: "live", label: "LIVE" },
    { id: "reports", label: "REPORTS" },
  ] as const;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo"><img src="./logo.png" alt="R2" /></div>
        <nav className="nav">
          {nav.map(n => (
            <Link key={n.id} to={`/${n.id}`} className={`nav-link ${path === n.id ? 'active' : ''}`}>{n.label}</Link>
          ))}
        </nav>
        {/* About link at bottom */}
        <div style={{ marginTop: 'auto' }} className="nav">
          <Link to="/about" className={`nav-link ${path === 'about' ? 'active' : ''}`}>ABOUT</Link>
        </div>
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
