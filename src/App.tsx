import React from 'react';
import { AppProvider, useAppState, useAppDispatch } from './context/AppContext';
import { PlayerManager } from './components/PlayerManager';
import { FieldSetup } from './components/FieldSetup';
import { MatchDay } from './components/MatchDay';
import { ShootoutTracker } from './components/ShootoutTracker';
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

// Opstelling — dots in a 1-3-3-1 formation pattern
function OpstellingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={iconStyle}>
      <circle cx="12" cy="21" r="2"/>
      <circle cx="5"  cy="16" r="2"/>
      <circle cx="12" cy="16" r="2"/>
      <circle cx="19" cy="16" r="2"/>
      <circle cx="5"  cy="10" r="2"/>
      <circle cx="12" cy="10" r="2"/>
      <circle cx="19" cy="10" r="2"/>
      <circle cx="12" cy="4"  r="2"/>
    </svg>
  );
}

// Wedstrijd — stopwatch
function WedstrijdIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
      <circle cx="12" cy="14" r="8"/>
      <path d="M9 2 h6" strokeWidth="2.5"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="10" x2="12" y2="14"/>
      <line x1="12" y1="14" x2="16" y2="14"/>
    </svg>
  );
}

// Shootout — goal posts with net
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
  { id: 'setup',    label: 'Opstelling', icon: <OpstellingIcon /> },
  { id: 'matchday', label: 'Wedstrijd',  icon: <WedstrijdIcon />  },
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
        <div className="app__logo">
          <svg viewBox="0 0 32 32" width="32" height="32" className="app__logo-icon">
            {/* Head */}
            <circle cx="9" cy="5" r="2.5" fill="#60a5fa"/>
            {/* Body */}
            <line x1="9" y1="7.5" x2="15" y2="19" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
            {/* Legs */}
            <line x1="15" y1="19" x2="11" y2="29" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
            <line x1="15" y1="19" x2="18" y2="29" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
            {/* Arms + stick grip */}
            <line x1="11" y1="12" x2="22" y2="17" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
            {/* Stick shaft + hook */}
            <path d="M22 17 L26 27 Q27 30 30 28"
              fill="none" stroke="#93c5fd" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
            {/* Ball */}
            <circle cx="30" cy="27" r="2" fill="#93c5fd"/>
          </svg>
          <span>Hockey Manager</span>
        </div>
        <nav className="app__nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${activeTab === tab.id ? ' nav-tab--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app__content">
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
