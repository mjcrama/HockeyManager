import { useState, useEffect } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

export function UpdateBanner() {
  const [swUpdate, setSwUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const versionStatus = useVersionCheck();

  useEffect(() => {
    function onUpdate() { setSwUpdate(true); setDismissed(false); }
    window.addEventListener('sw-update-available', onUpdate);
    return () => window.removeEventListener('sw-update-available', onUpdate);
  }, []);

  function handleRefresh() {
    const fn = (window as any).__swUpdate;
    if (typeof fn === 'function') fn(true);
    else window.location.reload();
  }

  // Hard block — version below minVersion, cannot dismiss
  if (versionStatus === 'force-update') {
    return (
      <div className="update-modal-overlay">
        <div className="update-modal">
          <p className="update-modal__title">Update vereist</p>
          <p className="update-modal__desc">
            Deze versie van de app wordt niet meer ondersteund. Ververs de pagina om door te gaan.
          </p>
          <button className="update-modal__btn update-modal__btn--primary" onClick={handleRefresh}>
            Verversen
          </button>
        </div>
      </div>
    );
  }

  // Soft modal — SW update or newer Firebase version, can dismiss
  if ((swUpdate || versionStatus === 'soft-update') && !dismissed) {
    return (
      <div className="update-modal-overlay" onClick={() => setDismissed(true)}>
        <div className="update-modal" onClick={(e) => e.stopPropagation()}>
          <p className="update-modal__title">Nieuwe versie beschikbaar</p>
          <p className="update-modal__desc">
            Er is een nieuwe versie van de app beschikbaar. Ververs de pagina om de laatste versie te laden.
          </p>
          <div className="update-modal__actions">
            <button className="update-modal__btn update-modal__btn--secondary" onClick={() => setDismissed(true)}>
              Later
            </button>
            <button className="update-modal__btn update-modal__btn--primary" onClick={handleRefresh}>
              Verversen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
