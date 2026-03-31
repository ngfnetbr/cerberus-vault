import { useState } from 'react';
import { Settings, Timer, Fingerprint, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { decrypt, encrypt, hashMasterPassword, verifyMasterPassword } from '@/lib/crypto';
import { isBiometricSupported, isBiometricEnabled, disableBiometric, registerBiometric, updateBiometricPassword } from '@/lib/biometric';
import { getEntries, getMasterHash, saveEntries, setMasterHash } from '@/lib/vault-store';
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
  } catch {
    return { autoLockMinutes: 5 };
  }
  return { autoLockMinutes: 5 };
}

export function saveSettings(settings: VaultSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

interface VaultSettingsDialogProps {
  settings: VaultSettings;
  onSettingsChanged: (settings: VaultSettings) => void;
  masterPassword?: string;
  onMasterPasswordChanged?: (password: string) => void;
}

const VaultSettingsDialog = ({ settings, onSettingsChanged, masterPassword, onMasterPasswordChanged }: VaultSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [autoLock, setAutoLock] = useState(String(settings.autoLockMinutes));
  const [biometricOn, setBiometricOn] = useState(isBiometricEnabled());
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
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

  const handleChangeMasterPassword = async () => {
    if (!masterPassword) {
      toast({ title: 'Sessão inválida', description: 'Desbloqueie o cofre novamente.', variant: 'destructive' });
      return;
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: 'Senha fraca', description: 'A nova senha mestra deve ter pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({ title: 'Senhas não coincidem', description: 'Confirme a nova senha mestra corretamente.', variant: 'destructive' });
      return;
    }

    const masterHash = getMasterHash();
    if (!masterHash) {
      toast({ title: 'Senha mestra não encontrada', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);

    try {
      const isCurrentPasswordValid = await verifyMasterPassword(currentPassword, masterHash);
      if (!isCurrentPasswordValid) {
        toast({ title: 'Senha atual incorreta', variant: 'destructive' });
        return;
      }

      const entries = getEntries();
      const reencryptedEntries = await Promise.all(entries.map(async (entry) => {
        const plaintextPassword = await decrypt(entry.encryptedPassword, currentPassword);
        const encryptedPassword = await encrypt(plaintextPassword, newPassword);

        return {
          ...entry,
          encryptedPassword,
        };
      }));

      saveEntries(reencryptedEntries);
      setMasterHash(await hashMasterPassword(newPassword));
      updateBiometricPassword(newPassword);
      onMasterPasswordChanged?.(newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast({ title: 'Senha mestra alterada!', description: 'Todas as senhas foram recriptografadas com sucesso.' });
    } catch {
      toast({ title: 'Erro ao alterar a senha mestra', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
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

          <div className="space-y-3 rounded-lg border border-border bg-vault-surface/50 p-3">
            <Label className="flex items-center gap-2 text-sm">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              Alterar senha mestra
            </Label>
            <Input
              type="password"
              placeholder="Senha mestra atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-vault-surface border-border"
            />
            <Input
              type="password"
              placeholder="Nova senha mestra"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-vault-surface border-border"
            />
            <Input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="bg-vault-surface border-border"
            />
            <p className="text-[11px] text-muted-foreground">
              As entradas existentes serão recriptografadas automaticamente com a nova senha mestra.
            </p>
            <Button type="button" variant="outline" onClick={handleChangeMasterPassword} disabled={changingPassword} className="w-full">
              {changingPassword ? 'Alterando...' : 'Alterar senha mestra'}
            </Button>
          </div>

          <Button onClick={handleSave} className="w-full">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VaultSettingsDialog;
