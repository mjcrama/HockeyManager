import { useState, useRef } from 'react';
import { useAppDispatch } from '../context/AppContext';
import type { AppState } from '../types';

const STORAGE_KEY = 'hockey-manager-state';

type Tab = AppState['activeTab'];

const FEATURES: { tab: Exclude<Tab, 'home'>; label: string; description: string }[] = [
  { tab: 'roster',   label: 'Selectie',   description: 'Beheer je spelerslijst, rugnummers en voorkeursposities.' },
  { tab: 'setup',    label: 'Opstelling', description: 'Sleep spelers naar hun positie op het veld en kies een formatie.' },
  { tab: 'matchday', label: 'Wedstrijd',  description: 'Houd de timer, score en wissels bij tijdens de wedstrijd.' },
  { tab: 'shootout', label: 'Shootout',   description: 'Registreer strafballen per speler met score overzicht.' },
];

export function Home() {
  const dispatch = useAppDispatch();
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hockey-team.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string;
        JSON.parse(json);
        localStorage.setItem(STORAGE_KEY, json);
        window.location.reload();
      } catch {
        setImportError(true);
        setTimeout(() => setImportError(false), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleShare() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const encoded = btoa(unescape(encodeURIComponent(raw)));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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

      <div className="home__data">
        <h2 className="home__section-title">Team data</h2>
        <p className="home__section-desc">Exporteer je team om een back-up te maken of te delen. Importeer een bestand om data te laden op dit apparaat.</p>
        <div className="home__data-actions">
          <button className="btn btn--secondary" onClick={handleExport}>
            ↓ Exporteren
          </button>
          <button className="btn btn--secondary" onClick={() => importRef.current?.click()}>
            ↑ Importeren
          </button>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn--secondary" onClick={handleShare}>
            {copied ? '✓ Gekopieerd!' : '⎘ Deel link'}
          </button>
        </div>
        {importError && <p className="home__import-error">Ongeldig bestand — probeer een geldig export bestand.</p>}
      </div>
    </div>
  );
}
