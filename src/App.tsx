import type { ReactElement } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Live from './pages/Live';
import Reports from './pages/Reports';
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
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live/*" element={<Live />} />
          <Route path="/reports/*" element={<Reports />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
