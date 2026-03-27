import React from 'react';
import { AppProvider, useAppState, useAppDispatch } from './context/AppContext';
import { Home } from './components/Home';
import { PlayerManager } from './components/PlayerManager';
import { FieldSetup } from './components/FieldSetup';
import { MatchDay } from './components/MatchDay';
import { ShootoutTracker } from './components/ShootoutTracker';
import { OpstellingIcon, WedstrijdIcon } from './components/Icons';
import type { AppState } from './types';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#f85149', background: '#0d1117', minHeight: '100vh' }}>
          <h2>App fout</h2>
          <pre style={{ fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

type Tab = AppState['activeTab'];

const iconStyle: React.CSSProperties = {
  display: 'block', marginRight: 5, flexShrink: 0,
};

// Selectie — two person silhouettes
function SelectieIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={iconStyle}>
      <circle cx="9" cy="7" r="3.5"/>
      <path d="M1 20 C1 14 17 14 17 20"/>
      <circle cx="17" cy="6" r="3" opacity="0.55"/>
      <path d="M13 19 C13 14.5 23 14.5 23 19" opacity="0.55"/>
    </svg>
  );
}

// Shootout — goal posts with net (local wrapper with nav style)
function ShootoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
      <path d="M2 21 L2 3 L22 3 L22 21" strokeWidth="2.5"/>
      <line x1="2"  y1="8"  x2="22" y2="8"  strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="2"  y1="13" x2="22" y2="13" strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="2"  y1="18" x2="22" y2="18" strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="8"  y1="3"  x2="8"  y2="21" strokeWidth="1" strokeOpacity="0.55"/>
      <line x1="15" y1="3"  x2="15" y2="21" strokeWidth="1" strokeOpacity="0.55"/>
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'roster',   label: 'Selectie',   icon: <SelectieIcon />   },
  { id: 'setup',    label: 'Opstelling', icon: <span style={iconStyle}><OpstellingIcon size={16} /></span>  },
  { id: 'matchday', label: 'Wedstrijd',  icon: <span style={iconStyle}><WedstrijdIcon size={16} /></span>  },
  { id: 'shootout', label: 'Shootout',   icon: <ShootoutIcon />   },
];

function AppInner() {
  const { activeTab } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="app">
      <div className="rotate-overlay">
        <span className="rotate-overlay__icon">↺</span>
        <p>Draai je scherm naar<br />staand formaat</p>
      </div>
      <header className="app__header">
        <button className="app__logo" onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'home' })}>
          <svg viewBox="0 0 192 192" width="32" height="32" className="app__logo-icon" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logoStick" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2E74D1"/>
                <stop offset="100%" stopColor="#0B3C8C"/>
              </linearGradient>
              <radialGradient id="logoBall" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#FFFFFF"/>
                <stop offset="100%" stopColor="#E4E8EF"/>
              </radialGradient>
            </defs>
            <g transform="rotate(38 96 96)">
              <rect x="90" y="30" width="12" height="82" rx="6" fill="url(#logoStick)"/>
              <rect x="90" y="30" width="12" height="14" rx="5" fill="#0A234F"/>
              <rect x="91" y="42" width="10" height="6" rx="2.5" fill="#8CC0FF"/>
              <rect x="91" y="49" width="10" height="6" rx="2.5" fill="#C7E0FF"/>
              <path d="M90 106 H102 V126 C102 137 94 145 83 145 H73 C65 145 59 139 59 131 C59 123 65 117 73 117 H79 C85 117 90 112 90 106 Z" fill="url(#logoStick)"/>
            </g>
            <circle cx="128" cy="127" r="20" fill="url(#logoBall)"/>
            <circle cx="121" cy="120" r="6" fill="#FFFFFF" opacity="0.7"/>
            <circle cx="128" cy="127" r="20" fill="none" stroke="#D4DBE5" strokeWidth="2"/>
          </svg>
          <span className="app__logo-text">Hockey Manager</span>
        </button>
        <nav className="app__nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${activeTab === tab.id ? ' nav-tab--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
            >
              {tab.icon}<span className="nav-tab__label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="app__content">
        {activeTab === 'home' && <Home />}
        {activeTab === 'roster' && <PlayerManager />}
        {activeTab === 'setup' && <FieldSetup />}
        {activeTab === 'matchday' && <MatchDay />}
        {activeTab === 'shootout' && <ShootoutTracker />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ErrorBoundary>
  );
}
