import type { ReactElement } from 'react';

interface TrailToggleButtonProps {
  showTrails: boolean;
  onToggle: () => void;
}

export function TrailToggleButton({ showTrails, onToggle }: TrailToggleButtonProps): ReactElement {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 100,
        padding: '6px 10px',
        background: showTrails ? 'rgba(0,212,255,0.15)' : 'rgba(7,10,15,0.9)',
        color: showTrails ? '#00d4ff' : '#667',
        border: `1px solid ${showTrails ? 'rgba(0,212,255,0.4)' : 'rgba(100,100,100,0.3)'}`,
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "'Share Tech Mono', monospace",
        cursor: 'pointer',
        letterSpacing: '0.5px',
        transition: 'all 0.2s ease',
      }}
    >
      {showTrails ? '◉ TRAILS' : '○ TRAILS'}
    </button>
  );
}
