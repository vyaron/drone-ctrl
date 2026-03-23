import { useState, useMemo, type ReactElement } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import ReportEventsView from '../components/ReportEventsView';
import ReportSummaryView from '../components/ReportSummaryView';

type DateRange = '1d' | '7d' | '14d' | 'custom';

interface ReportFilters {
  dateRange: DateRange;
  customStart?: Date;
  customEnd?: Date;
}

// Get time range in ms based on filter
function getTimeRange(filters: ReportFilters): { start: number; end: number } {
  const now = Date.now();
  const end = filters.dateRange === 'custom' && filters.customEnd 
    ? filters.customEnd.getTime() 
    : now;
  
  let start: number;
  switch (filters.dateRange) {
    case '1d': start = now - 24 * 60 * 60 * 1000; break;
    case '7d': start = now - 7 * 24 * 60 * 60 * 1000; break;
    case '14d': start = now - 14 * 24 * 60 * 60 * 1000; break;
    case 'custom': start = filters.customStart?.getTime() ?? now - 24 * 60 * 60 * 1000; break;
  }
  return { start, end };
}

function Reports(): ReactElement {
  const location = useLocation();
  const currentPath = location.pathname.replace('/reports', '').replace('/', '') || 'events';
  
  // Common filter state
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: '1d',
  });
  
  const [customStartStr, setCustomStartStr] = useState('');
  const [customEndStr, setCustomEndStr] = useState('');
  
  const timeRange = useMemo(() => getTimeRange(filters), [filters]);

  const setDateRange = (range: DateRange) => {
    if (range === 'custom') {
      // Initialize with current range values (1 day back)
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setCustomStartStr(start.toISOString().slice(0, 16));
      setCustomEndStr(now.toISOString().slice(0, 16));
      setFilters(f => ({ 
        ...f, 
        dateRange: 'custom',
        customStart: start,
        customEnd: now,
      }));
    } else {
      setFilters(f => ({ ...f, dateRange: range, customStart: undefined, customEnd: undefined }));
    }
  };

  const updateCustomRange = (startStr: string, endStr: string) => {
    setCustomStartStr(startStr);
    setCustomEndStr(endStr);
    if (startStr && endStr) {
      setFilters(f => ({
        ...f,
        customStart: new Date(startStr),
        customEnd: new Date(endStr),
      }));
    }
  };

  const formatTimeRangeLabel = () => {
    const { start, end } = timeRange;
    const fmt = (t: number) => {
      const d = new Date(t);
      return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    return `${fmt(start)} — ${fmt(end)}`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ 
        padding: '10px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 16, 
        borderBottom: '1px solid rgba(0,212,255,0.12)', 
        background: 'rgba(0,5,12,0.95)', 
        flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2 }}>REPORTS</span>
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(0,212,255,0.15)', margin: '0 4px' }}/>
        <span style={{ fontSize: 11, color: '#7ecfff', letterSpacing: 1 }}>{formatTimeRangeLabel()}</span>
        <div style={{ flex: 1 }}/>
      </div>

      {/* Navigation + Filters */}
      <div style={{ 
        padding: '0 20px', 
        display: 'flex', 
        alignItems: 'center', 
        borderBottom: '1px solid rgba(0,212,255,0.08)', 
        flexShrink: 0, 
        background: 'rgba(0,5,12,0.7)',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        {/* Left side - Navigation */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[
            { id: 'events', icon: '⚡', label: 'EVENTS' },
            { id: 'summary', icon: '▦', label: 'SUMMARY' },
          ].map(t => (
            <Link 
              key={t.id} 
              to={`/reports/${t.id}`}
              style={{ 
                padding: '10px 16px', 
                fontSize: 12, 
                letterSpacing: 2, 
                fontWeight: 700, 
                color: currentPath === t.id ? '#00d4ff' : '#8899aa', 
                background: 'none', 
                textDecoration: 'none',
                borderBottom: currentPath === t.id ? '2px solid #00d4ff' : '2px solid transparent', 
                marginBottom: '-1px', 
                transition: 'color 0.15s', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 5, 
                fontFamily: "'Share Tech Mono',monospace" 
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
            </Link>
          ))}
        </div>
        
        <div style={{ flex: 1 }}/>
        
        {/* Right side - Date Range Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          {/* Date Range */}
          <span style={{ fontSize: 10, color: '#8899aa', letterSpacing: 1 }}>RANGE:</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {([
              { id: '1d', label: '1d' },
              { id: '7d', label: '7d' },
              { id: '14d', label: '14d' },
              { id: 'custom', label: '⋯' },
            ] as { id: DateRange; label: string }[]).map(r => (
              <button 
                key={r.id} 
                onClick={() => setDateRange(r.id)} 
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: 3, 
                  fontSize: 10, 
                  letterSpacing: 1, 
                  fontWeight: 700, 
                  background: filters.dateRange === r.id ? 'rgba(0,212,255,0.12)' : 'transparent', 
                  color: filters.dateRange === r.id ? '#00d4ff' : '#8899aa', 
                  border: `1px solid ${filters.dateRange === r.id ? 'rgba(0,212,255,0.3)' : 'rgba(0,212,255,0.07)'}`, 
                  cursor: 'pointer', 
                  transition: 'all 0.12s', 
                  fontFamily: "'Share Tech Mono',monospace" 
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          
          {/* Custom date inputs */}
          {filters.dateRange === 'custom' && (
            <>
              <input
                type="datetime-local"
                value={customStartStr}
                onChange={e => updateCustomRange(e.target.value, customEndStr)}
                style={{
                  padding: '3px 6px',
                  fontSize: 10,
                  background: 'rgba(0,212,255,0.06)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: 3,
                  color: '#7ecfff',
                  fontFamily: "'Share Tech Mono',monospace",
                }}
              />
              <span style={{ color: '#556' }}>→</span>
              <input
                type="datetime-local"
                value={customEndStr}
                onChange={e => updateCustomRange(customStartStr, e.target.value)}
                style={{
                  padding: '3px 6px',
                  fontSize: 10,
                  background: 'rgba(0,212,255,0.06)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: 3,
                  color: '#7ecfff',
                  fontFamily: "'Share Tech Mono',monospace",
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/reports/events" replace />} />
          <Route path="events" element={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
              <ReportEventsView timeRange={timeRange} />
            </div>
          } />
          <Route path="summary" element={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'auto' }}>
              <ReportSummaryView timeRange={timeRange} />
            </div>
          } />
        </Routes>
      </div>
    </div>
  );
}

export default Reports;
