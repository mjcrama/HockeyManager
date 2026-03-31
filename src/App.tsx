import React, { useState } from 'react';
import { AppProvider, useAppState, useAppDispatch } from './context/AppContext';
import { TeamProvider, useTeam } from './context/TeamContext';
import { FirebaseSync } from './components/FirebaseSync';
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

const ALL_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'roster',   label: 'Selectie',   icon: <SelectieIcon />   },
  { id: 'setup',    label: 'Opstelling', icon: <span style={iconStyle}><OpstellingIcon size={16} /></span>  },
  { id: 'matchday', label: 'Wedstrijd',  icon: <span style={iconStyle}><WedstrijdIcon size={16} /></span>  },
  { id: 'shootout', label: 'Shootout',   icon: <ShootoutIcon />   },
];

const VIEWER_TABS: Tab[] = ['matchday', 'shootout'];

function ShareBar() {
  const { isViewer, isOnline, teamName, setTeamName, getCoachUrl, getViewerUrl } = useTeam();
  const [open, setOpen]         = useState(false);
  const [copied, setCopied]     = useState<'coach' | 'viewer' | null>(null);
  const [nameInput, setNameInput] = useState(teamName);

  // Keep input in sync if another coach changes the name
  React.useEffect(() => { setNameInput(teamName); }, [teamName]);

  // Close menu on outside click
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function copy(type: 'coach' | 'viewer') {
    const url = type === 'coach' ? getCoachUrl() : getViewerUrl();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => { setCopied(type); setTimeout(() => setCopied(null), 2000); },
        () => { window.prompt('Kopieer deze link:', url); },
      );
    } else {
      window.prompt('Kopieer deze link:', url);
    }
  }

  if (isViewer) {
    return (
      <div className="session-bar session-bar--viewer">
        <span className={`session-bar__dot${isOnline ? ' session-bar__dot--live' : ' session-bar__dot--offline'}`} />
        <span className="session-bar__label">{teamName || 'Live meekijken'}</span>
      </div>
    );
  }

  return (
    <div className="session-bar session-bar--coach" ref={menuRef}>
      <span className={`session-bar__dot${isOnline ? ' session-bar__dot--live' : ' session-bar__dot--offline'}`} />
      <span className="session-bar__team-name">{teamName || 'Mijn team'}</span>
      <button
        className={`btn btn--sm btn--ghost session-bar__btn${open ? ' btn--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Team instellingen"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </button>

      {open && (
        <div className="share-menu">
          {/* Team naam */}
          <div className="share-menu__name">
            <label className="share-menu__name-label">Teamnaam</label>
            <input
              className="share-menu__name-input"
              placeholder="bijv. HV Bleiswijk U12"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => { if (nameInput.trim() !== teamName) setTeamName(nameInput.trim()); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setTeamName(nameInput.trim()); e.currentTarget.blur(); } }}
            />
          </div>
          <div className="share-menu__divider" />
          {/* Links */}
          <p className="share-menu__section-label">Link delen</p>

          <div className="share-menu__link-row">
            <div className="share-menu__link-info">
              <svg className="share-menu__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <strong>Coach link</strong>
            </div>
            <div className="share-menu__link-field">
              <input
                className="share-menu__url-input"
                readOnly
                value={getCoachUrl()}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button className="share-menu__copy-btn" onClick={() => copy('coach')}>
                {copied === 'coach' ? '✓' : 'Kopieer'}
              </button>
            </div>
          </div>

          <div className="share-menu__link-row">
            <div className="share-menu__link-info">
              <svg className="share-menu__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <strong>Kijker link</strong>
            </div>
            <div className="share-menu__link-field">
              <input
                className="share-menu__url-input"
                readOnly
                value={getViewerUrl()}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button className="share-menu__copy-btn" onClick={() => copy('viewer')}>
                {copied === 'viewer' ? '✓' : 'Kopieer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppInner() {
  const { activeTab } = useAppState();
  const dispatch = useAppDispatch();
  const { isViewer } = useTeam();

  const tabs = isViewer
    ? ALL_TABS.filter((t) => VIEWER_TABS.includes(t.id))
    : ALL_TABS;

  const visibleTab = isViewer && !VIEWER_TABS.includes(activeTab) ? 'matchday' : activeTab;

  return (
    <div className="app">
      <div className="rotate-overlay">
        <span className="rotate-overlay__icon">↺</span>
        <p>Draai je scherm naar<br />staand formaat</p>
      </div>
      <header className="app__header">
        <button className="app__logo" onClick={() => !isViewer && dispatch({ type: 'SET_ACTIVE_TAB', payload: 'home' })}>
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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${visibleTab === tab.id ? ' nav-tab--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
            >
              {tab.icon}<span className="nav-tab__label">{tab.label}</span>
            </button>
          ))}
        </nav>
        <ShareBar />
      </header>
      <main className="app__content">
        {visibleTab === 'home'     && <Home />}
        {visibleTab === 'roster'   && <PlayerManager />}
        {visibleTab === 'setup'    && <FieldSetup />}
        {visibleTab === 'matchday' && <MatchDay />}
        {visibleTab === 'shootout' && <ShootoutTracker />}
      </main>
      <FirebaseSync />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TeamProvider>
        <AppProvider>
          <AppInner />
        </AppProvider>
      </TeamProvider>
    </ErrorBoundary>
  );
}
