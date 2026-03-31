import { useCallback, useRef, useState } from 'react';
import { getEntries, getGroups, getTags, getMasterHash } from '@/lib/vault-store';
import { isFileLinked, saveToFile, buildVaultSnapshot } from '@/lib/file-sync';

export function useFileSync() {
  const saving = useRef(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const markDirty = useCallback(() => {
    if (isFileLinked()) setHasPendingChanges(true);
  }, []);

  const syncToFile = useCallback(async () => {
    if (!isFileLinked() || saving.current) return;
    const hash = getMasterHash();
    if (!hash) return;

    saving.current = true;
    try {
      const snapshot = buildVaultSnapshot(hash, getEntries(), getGroups(), getTags());
      const success = await saveToFile(snapshot);
      if (success) {
        setLastSyncAt(new Date());
        setHasPendingChanges(false);
      }
    } finally {
      saving.current = false;
    }
  }, []);

  return { syncToFile, lastSyncAt, setLastSyncAt, hasPendingChanges, markDirty };
}
