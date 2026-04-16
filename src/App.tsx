import React, { useState } from 'react';
import { useScrollLock } from './hooks/useScrollLock';
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
  const {
    isViewer, isOnline, teamId, teamName, teamDeleted, allTeams,
    setTeamName, switchTeam, createTeam, deleteTeam, getActiveDeviceCount,
    getCoachUrl, getViewerUrl,
  } = useTeam();

  const [open, setOpen]                           = useState(false);
  const [copied, setCopied]                       = useState<'coach' | 'viewer' | null>(null);
  const [nameInput, setNameInput]                 = useState(teamName);
  const [showTeams, setShowTeams]                 = useState(false);
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);
  const [activeDeviceCount, setActiveDeviceCount] = useState<number | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  useScrollLock(open || teamDeleted);

  // Force modal open when team is deleted
  React.useEffect(() => { if (teamDeleted) setOpen(true); }, [teamDeleted]);
  // Keep name input in sync; fall back to generated display name when team has no stored name
  React.useEffect(() => {
    setNameInput(teamName || allTeams.find((t) => t.id === teamId)?.name || '');
  }, [teamName, teamId, allTeams]);

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

  function saveName() {
    if (nameInput.trim() !== teamName) setTeamName(nameInput.trim());
  }

  function closeModal() {
    if (teamDeleted) return; // cannot close while team is deleted
    saveName();
    setShowTeams(false);
    setConfirmDeleteId(null);
    setOpen(false);
  }

  function handleSwitchTeam(id: string) {
    saveName();
    setShowTeams(false);
    setConfirmDeleteId(null);
    switchTeam(id);
  }

  function handleCreateTeam() {
    saveName();
    setShowTeams(false);
    const base = 'Nieuw team';
    const existing = allTeams.map((t) => t.name);
    let name = base;
    let i = 2;
    while (existing.includes(name)) name = `${base} ${i++}`;
    createTeam(name);
    setTimeout(() => nameInputRef.current?.select(), 50);
  }

  async function handleDeleteClick(t: { id: string; name: string }) {
    setConfirmDeleteId(t.id);
    setActiveDeviceCount(null);
    const count = await getActiveDeviceCount(t.id);
    setActiveDeviceCount(count);
  }

  async function handleConfirmDelete(id: string) {
    await deleteTeam(id);
    setConfirmDeleteId(null);
    setActiveDeviceCount(null);
    // If no teams left, create a new one
    const remaining = allTeams.filter((t) => t.id !== id);
    if (remaining.length === 0) handleCreateTeam();
  }

  if (isViewer) {
    return (
      <div className="session-bar session-bar--viewer">
        <span className={`session-bar__dot${isOnline ? ' session-bar__dot--live' : ' session-bar__dot--offline'}`} />
        <span className="session-bar__label">{teamName || 'Live meekijken'}</span>
      </div>
    );
  }

  const modalOpen = open || teamDeleted;

  return (
    <div className="session-bar session-bar--coach">
      <button className="session-bar__dot--btn" onClick={() => setOpen(true)} title="Team instellingen">
        <span className={`session-bar__dot${isOnline ? ' session-bar__dot--live' : ' session-bar__dot--offline'}`} />
      </button>
      <button
        className="session-bar__team-name session-bar__team-name--btn"
        onClick={() => setOpen(true)}
        title="Team instellingen"
      >
        <span className="session-bar__team-name-text">{teamName || 'Mijn team'}</span>
        <svg className="session-bar__kebab" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>

      {modalOpen && (
        <div className="settings-modal-overlay" onClick={closeModal}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal__header">
              <span className="settings-modal__header-title">Team instellingen</span>
              {!teamDeleted && (
                <button className="settings-modal__close-x" onClick={closeModal}>✕</button>
              )}
            </div>
            <div className="settings-modal__body">

              {/* Deleted team warning */}
              {teamDeleted && (
                <div className="team-deleted-notice">
                  <span className="team-deleted-notice__icon">⚠</span>
                  <span>Dit team is verwijderd. Selecteer of maak een nieuw team aan.</span>
                </div>
              )}

              {/* Team naam + switcher */}
              {!teamDeleted && (
                <div className="share-menu__name" style={{ padding: 0 }}>
                  <label className="share-menu__name-label">Teamnaam</label>
                  <div className="team-switcher">
                    <input
                      ref={nameInputRef}
                      className="share-menu__name-input team-switcher__input"
                      placeholder="bijv. HV Bleiswijk U12"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => { if (e.key === 'Enter') { saveName(); e.currentTarget.blur(); } }}
                    />
                    <button
                      className={`team-switcher__chevron${showTeams ? ' team-switcher__chevron--open' : ''}`}
                      onClick={() => setShowTeams((o) => !o)}
                      title="Wissel van team"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showTeams && renderTeamDropdown()}
                  </div>
                </div>
              )}

              {/* Team list when deleted (always visible) */}
              {teamDeleted && (
                <div className="team-switcher__dropdown team-switcher__dropdown--inline">
                  {renderTeamDropdown()}
                </div>
              )}

              {!teamDeleted && (
                <>
                  <div className="share-menu__divider" style={{ margin: '4px 0' }} />
                  <p className="share-menu__section-label" style={{ padding: 0 }}>Link delen</p>

                  <div className="share-menu__link-row" style={{ padding: 0, borderTop: 'none' }}>
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
                      <input className="share-menu__url-input" readOnly value={getCoachUrl()} onFocus={(e) => e.currentTarget.select()} />
                      <button className="share-menu__copy-btn" onClick={() => copy('coach')}>
                        {copied === 'coach' ? '✓' : 'Kopieer'}
                      </button>
                    </div>
                  </div>

                  <div className="share-menu__link-row" style={{ padding: 0, borderTop: 'none' }}>
                    <div className="share-menu__link-info">
                      <svg className="share-menu__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <strong>Kijker link</strong>
                    </div>
                    <div className="share-menu__link-field">
                      <input className="share-menu__url-input" readOnly value={getViewerUrl()} onFocus={(e) => e.currentTarget.select()} />
                      <button className="share-menu__copy-btn" onClick={() => copy('viewer')}>
                        {copied === 'viewer' ? '✓' : 'Kopieer'}
                      </button>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderTeamDropdown() {
    return (
      <div className={teamDeleted ? undefined : 'team-switcher__dropdown'}>
        {allTeams.length === 0 && (
          <span className="team-switcher__empty">Geen teams gevonden</span>
        )}
        {allTeams.map((t) => (
          <div key={t.id} className="team-switcher__row">
            {confirmDeleteId === t.id ? (
              <div className="team-switcher__confirm">
                <span className="team-switcher__confirm-label">
                  {activeDeviceCount === null
                    ? 'Controleren...'
                    : activeDeviceCount > 0
                      ? `⚠ ${activeDeviceCount} apparaat${activeDeviceCount > 1 ? 'en' : ''} actief`
                      : `Verwijder "${t.name}"?`}
                </span>
                <button className="team-switcher__confirm-cancel" onClick={() => setConfirmDeleteId(null)}>Annuleer</button>
                <button
                  className="team-switcher__confirm-delete"
                  disabled={activeDeviceCount === null}
                  onClick={() => handleConfirmDelete(t.id)}
                >
                  Verwijder
                </button>
              </div>
            ) : (
              <>
                <button
                  className={`team-switcher__option${t.id === teamId ? ' team-switcher__option--active' : ''}`}
                  onClick={() => handleSwitchTeam(t.id)}
                >
                  {t.name || 'Naamloos'}
                  {t.id === teamId && <span className="team-switcher__check">✓</span>}
                </button>
                {t.id !== teamId && (
                  <button
                    className="team-switcher__delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(t); }}
                    title={`Verwijder ${t.name}`}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <div className="team-switcher__divider" />
        <button className="team-switcher__option team-switcher__option--new" onClick={handleCreateTeam}>
          + Nieuw team
        </button>
      </div>
    );
  }
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
