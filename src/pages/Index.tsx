import { useState, useCallback } from 'react';
import VaultLock from '@/components/VaultLock';
import VaultDashboard from '@/components/VaultDashboard';
import { useAutoLock } from '@/hooks/use-auto-lock';
import { useToast } from '@/hooks/use-toast';
import { getSettings, type VaultSettings } from '@/components/VaultSettings';

const Index = () => {
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [settings, setSettings] = useState<VaultSettings>(getSettings);
  const { toast } = useToast();

  const handleLock = useCallback(() => {
    if (masterPassword) {
      toast({ title: 'Cofre bloqueado', description: 'Bloqueado automaticamente por inatividade.' });
    }
    setMasterPassword(null);
  }, [masterPassword, toast]);

  useAutoLock(handleLock, masterPassword ? settings.autoLockMinutes : 0);

  if (!masterPassword) {
    return <VaultLock onUnlock={setMasterPassword} />;
  }

  return (
    <VaultDashboard
      masterPassword={masterPassword}
      onLock={() => setMasterPassword(null)}
      settings={settings}
      onSettingsChanged={setSettings}
      onMasterPasswordChanged={setMasterPassword}
    />
  );
};

export default Index;
