import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

declare const __APP_VERSION__: string;

function semverGt(running: string, required: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [ma, mia, pa] = parse(running);
  const [mb, mib, pb] = parse(required);
  if (ma !== mb) return ma > mb;
  if (mia !== mib) return mia > mib;
  return pa > pb;
}

// 'ok'           — up to date
// 'soft-update'  — newer version available, but current still works
// 'force-update' — current version is below minVersion, must update
export type VersionStatus = 'ok' | 'soft-update' | 'force-update';

export function useVersionCheck(): VersionStatus {
  const [status, setStatus] = useState<VersionStatus>('ok');

  useEffect(() => {
    const configRef = ref(db, 'config');
    return onValue(configRef, (snap) => {
      const config = snap.val() as { latestVersion?: string; minVersion?: string } | null;
      if (!config) return;
      const current = __APP_VERSION__;
      if (config.minVersion && semverGt(config.minVersion, current)) {
        setStatus('force-update');
      } else if (config.latestVersion && semverGt(config.latestVersion, current)) {
        setStatus('soft-update');
      } else {
        setStatus('ok');
      }
    });
  }, []);

  return status;
}
