import { useState } from 'react';
import { Settings, Timer, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { isBiometricSupported, isBiometricEnabled, disableBiometric, registerBiometric } from '@/lib/biometric';
import { useToast } from '@/hooks/use-toast';

const AUTO_LOCK_OPTIONS = [
  { value: '1', label: '1 minuto' },
  { value: '5', label: '5 minutos' },
  { value: '10', label: '10 minutos' },
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '0', label: 'Nunca' },
];

const SETTINGS_KEY = 'vault_settings';

export interface VaultSettings {
  autoLockMinutes: number;
}

export function getSettings(): VaultSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return { autoLockMinutes: 5 };
}

export function saveSettings(settings: VaultSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

interface VaultSettingsDialogProps {
  settings: VaultSettings;
  onSettingsChanged: (settings: VaultSettings) => void;
  masterPassword?: string;
}

const VaultSettingsDialog = ({ settings, onSettingsChanged, masterPassword }: VaultSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [autoLock, setAutoLock] = useState(String(settings.autoLockMinutes));
  const [biometricOn, setBiometricOn] = useState(isBiometricEnabled());
  const { toast } = useToast();

  const handleBiometricToggle = async (checked: boolean) => {
    if (checked && masterPassword) {
      const ok = await registerBiometric(masterPassword);
      if (ok) {
        setBiometricOn(true);
        toast({ title: 'Biometria ativada!' });
      } else {
        toast({ title: 'Falha ao ativar biometria', variant: 'destructive' });
      }
    } else {
      disableBiometric();
      setBiometricOn(false);
      toast({ title: 'Biometria desativada' });
    }
  };

  const handleSave = () => {
    const updated: VaultSettings = { autoLockMinutes: Number(autoLock) };
    saveSettings(updated);
    onSettingsChanged(updated);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" title="Configurações">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono">Configurações</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4 text-muted-foreground" />
              Bloqueio automático
            </Label>
            <Select value={autoLock} onValueChange={setAutoLock}>
              <SelectTrigger className="bg-vault-surface border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_LOCK_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              O cofre será bloqueado automaticamente após o período de inatividade selecionado.
            </p>
          </div>

          {/* Biometric toggle */}
          {isBiometricSupported() && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Fingerprint className="w-4 h-4 text-muted-foreground" />
                Desbloqueio por biometria
              </Label>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground max-w-[200px]">
                  Use impressão digital ou reconhecimento facial para desbloquear.
                </p>
                <Switch checked={biometricOn} onCheckedChange={handleBiometricToggle} />
              </div>
            </div>
          )}

          <Button onClick={handleSave} className="w-full">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VaultSettingsDialog;
