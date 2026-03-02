import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Live from './pages/Live'
import Reports from './pages/Reports'
import './App.css'

function App() {
  const location = useLocation();
  
  return (
    <div className="app-container">
      <nav className="main-nav">
        <div className="nav-brand">
          <span className="brand-text">R2 <span className="brand-accent">Ctrl</span></span>
        </div>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
          <Link to="/live" className={location.pathname === '/live' ? 'active' : ''}>Live</Link>
          <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>Reports</Link>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live/*" element={<Live />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
