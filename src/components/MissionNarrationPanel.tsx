import type { ReactElement } from 'react';
import { type MissionMoment } from '../utils/missionReplay';

interface MissionNarrationPanelProps {
  activeMoment: MissionMoment | null;
  recentMoments: MissionMoment[];
  narrationEnabled: boolean;
  onToggleNarration: () => void;
}

function priorityColor(priority: MissionMoment['priority']): string {
  switch (priority) {
    case 'high':
      return '#00d4ff';
    case 'medium':
      return '#ffd60a';
    default:
      return '#8899aa';
  }
}

export function MissionNarrationPanel({
  activeMoment,
  recentMoments,
  narrationEnabled,
  onToggleNarration,
}: MissionNarrationPanelProps): ReactElement {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        background: 'linear-gradient(180deg, rgba(0,16,28,0.96), rgba(0,7,14,0.96))',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: '#00d4ff' }}>MISSION NARRATION</span>
          <span style={{ fontSize: 10, letterSpacing: 1.5, color: narrationEnabled ? '#7ecfff' : '#667788' }}>
            {narrationEnabled ? 'VOICE ON' : 'VOICE MUTED'}
          </span>
        </div>
        <div
          style={{
            minHeight: 66,
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid rgba(0,212,255,0.18)',
            background: 'rgba(0,212,255,0.05)',
            boxShadow: activeMoment?.priority === 'high' ? '0 0 18px rgba(0,212,255,0.12)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: priorityColor(activeMoment?.priority ?? 'low'),
                boxShadow: `0 0 10px ${priorityColor(activeMoment?.priority ?? 'low')}`,
              }}
            />
            <span style={{ fontSize: 12, color: '#e8eaf0', fontWeight: 700 }}>
              {activeMoment?.title ?? 'Mission replay standing by'}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#a9c6d8' }}>
            {activeMoment?.narration ?? 'Press play to begin the incident briefing.'}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: '#8899aa' }}>RECENT MOMENTS</span>
          <button
            onClick={onToggleNarration}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,212,255,0.24)',
              background: narrationEnabled ? 'rgba(0,212,255,0.14)' : 'transparent',
              color: narrationEnabled ? '#00d4ff' : '#8899aa',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
            }}
          >
            {narrationEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {recentMoments.length > 0 ? recentMoments.slice().reverse().map(moment => (
            <div
              key={moment.id}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ fontSize: 11, color: priorityColor(moment.priority), marginBottom: 4 }}>{moment.title}</div>
              <div style={{ fontSize: 11, lineHeight: 1.35, color: '#91a6b8' }}>{moment.narration}</div>
            </div>
          )) : (
            <div style={{ padding: '8px 10px', fontSize: 11, color: '#667788' }}>
              Key mission moments will accumulate here during replay.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}