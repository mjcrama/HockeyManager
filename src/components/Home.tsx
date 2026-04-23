import { useAppDispatch } from '../context/AppContext';
import type { AppState } from '../types';

declare const __APP_VERSION__: string;

type Tab = AppState['activeTab'];

const FEATURES: { tab: Exclude<Tab, 'home'>; label: string; description: string }[] = [
  { tab: 'roster',   label: 'Selectie',   description: 'Beheer je spelerslijst, rugnummers en voorkeursposities.' },
  { tab: 'setup',    label: 'Opstelling', description: 'Sleep spelers naar hun positie op het veld en kies een formatie.' },
  { tab: 'matchday', label: 'Wedstrijd',  description: 'Houd de timer, score en wissels bij tijdens de wedstrijd.' },
  { tab: 'shootout', label: 'Shootout',   description: 'Registreer strafballen per speler met score overzicht.' },
];

export function Home() {
  const dispatch = useAppDispatch();

  return (
    <div className="home">
      <div className="home__hero">
        <h1 className="home__title">Hockey Manager</h1>
        <p className="home__subtitle">Beheer je hockeyteam — opstelling, wissels en shootouts, ook offline.</p>
      </div>

      <div className="home__features">
        {FEATURES.map((f) => (
          <button
            key={f.tab}
            className="home__feature-card"
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: f.tab })}
          >
            <span className="home__feature-label">{f.label}</span>
            <span className="home__feature-desc">{f.description}</span>
          </button>
        ))}
      </div>

      <div className="home__version">
        <button
          className="home__version-btn"
          onClick={() => window.location.reload()}
          title="Klik om de app te verversen"
        >
          v{__APP_VERSION__}
        </button>
      </div>
    </div>
  );
}
