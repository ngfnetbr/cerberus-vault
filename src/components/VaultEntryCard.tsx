import { useState } from 'react';
import { Eye, EyeOff, Copy, Pencil, Trash2, Globe, AtSign, Star } from 'lucide-react';
import googleLogo from '@/assets/google-logo.png';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type VaultEntry, deleteEntry } from '@/lib/vault-store';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface VaultEntryCardProps {
  entry: VaultEntry;
  onDecrypt: (entry: VaultEntry) => Promise<string>;
  onEdit: (entry: VaultEntry) => void;
  onDeleted: () => void;
  onToggleFavorite: (entry: VaultEntry) => void;
  onRecordUsage: (entry: VaultEntry) => void;
}

const VaultEntryCard = ({ entry, onDecrypt, onEdit, onDeleted, onToggleFavorite, onRecordUsage }: VaultEntryCardProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPw, setDecryptedPw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isGoogleAuth = entry.authType === 'google';

  const handleTogglePassword = async () => {
    if (isGoogleAuth) return;
    if (showPassword) { setShowPassword(false); return; }
    if (decryptedPw) { setShowPassword(true); return; }
    setLoading(true);
    try {
      const pw = await onDecrypt(entry);
      setDecryptedPw(pw);
      setShowPassword(true);
      onRecordUsage(entry);
    } catch {
      toast({ title: 'Erro ao descriptografar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(entry.username);
      onRecordUsage(entry);
      toast({ title: isGoogleAuth ? 'E-mail copiado!' : 'Usuário copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    try {
      if (isGoogleAuth) {
        await navigator.clipboard.writeText(entry.username);
        onRecordUsage(entry);
        toast({ title: 'E-mail copiado!' });
        return;
      }

      const pw = decryptedPw || await onDecrypt(entry);
      if (!decryptedPw) setDecryptedPw(pw);
      await navigator.clipboard.writeText(pw);
      onRecordUsage(entry);
      toast({ title: 'Senha copiada!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleDelete = () => {
    deleteEntry(entry.id);
    onDeleted();
    toast({ title: 'Entrada removida' });
  };

  const getFaviconUrl = (site: string) => {
    try {
      const url = site.startsWith('http') ? site : `https://${site}`;
      const hostname = new URL(url).hostname;
      // Try multiple favicon services for better coverage
      return [
        `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
        `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
        `https://${hostname}/favicon.ico`,
      ];
    } catch {
      return null;
    }
  };

  const getPlatformUrl = (site: string) => {
    try {
      const normalized = site.startsWith('http://') || site.startsWith('https://') ? site : `https://${site}`;
      return new URL(normalized).toString();
    } catch {
      return null;
    }
  };

  const faviconUrls = getFaviconUrl(entry.site);
  const [faviconIdx, setFaviconIdx] = useState(0);
  const currentFavicon = faviconUrls ? faviconUrls[faviconIdx] : null;
  const platformUrl = getPlatformUrl(entry.site);

  const handleFaviconError = () => {
    if (faviconUrls && faviconIdx < faviconUrls.length - 1) {
      setFaviconIdx(prev => prev + 1);
    } else {
      setFaviconIdx(-1); // all failed
    }
  };

  return (
    <div className="vault-gradient border border-border rounded-xl p-2.5 sm:p-4 hover:border-primary/30 transition-all group animate-vault-unlock">
      {/* Row 1: Icon + info + password (desktop: single row, mobile: stacked) */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {platformUrl ? (
          <a
            href={platformUrl}
            target="_blank"
            rel="noreferrer"
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-accent flex items-center justify-center shrink-0 transition-transform hover:scale-105"
            title={`Abrir ${entry.site}`}
            onClick={() => onRecordUsage(entry)}
          >
            {currentFavicon && faviconIdx >= 0 ? (
              <img src={currentFavicon} alt="" className="w-5 h-5" onError={handleFaviconError} />
            ) : (
              <Globe className="w-5 h-5 text-primary" />
            )}
            {isGoogleAuth && (
              <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                <img src={googleLogo} alt="Google" className="h-3 w-3 object-contain" />
              </span>
            )}
          </a>
        ) : (
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
            {currentFavicon && faviconIdx >= 0 ? (
              <img src={currentFavicon} alt="" className="w-5 h-5" onError={handleFaviconError} />
            ) : (
              <Globe className="w-5 h-5 text-primary" />
            )}
            {isGoogleAuth && (
              <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                <img src={googleLogo} alt="Google" className="h-3 w-3 object-contain" />
              </span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {platformUrl ? (
            <a
              href={platformUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm font-semibold hover:text-primary hover:underline underline-offset-4"
              title={`Abrir ${entry.site}`}
              onClick={() => onRecordUsage(entry)}
            >
              {entry.site}
            </a>
          ) : (
            <h3 className="font-semibold text-sm truncate">{entry.site}</h3>
          )}
          <p className="text-muted-foreground text-xs font-mono truncate">{entry.username}</p>
          <div className="flex gap-1 mt-1 flex-wrap">
            {isGoogleAuth && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                <img src={googleLogo} alt="Google" className="h-2.5 w-2.5 object-contain" />
                Google
              </Badge>
            )}
            {entry.tags && entry.tags.length > 0 && entry.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{tag}</Badge>
            ))}
          </div>
        </div>

        {/* Password - hidden on mobile, shown on desktop */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <span className={`text-xs w-24 text-right truncate text-muted-foreground ${isGoogleAuth ? '' : 'font-mono'}`}>
            {isGoogleAuth ? 'Login Google' : loading ? '...' : showPassword ? decryptedPw : '••••••••'}
          </span>
        </div>

        {/* Actions - always visible on desktop via hover */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className={`h-8 w-8 ${entry.isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-amber-400'}`} onClick={() => onToggleFavorite(entry)}>
            <Star className={`w-3.5 h-3.5 ${entry.isFavorite ? 'fill-current' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleCopyUsername}>
            <AtSign className="w-3.5 h-3.5" />
          </Button>
          {!isGoogleAuth && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleTogglePassword}>
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(entry)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir entrada</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{entry.site}</strong>? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Row 2: Mobile-only password + actions */}
      <div className="flex sm:hidden items-center justify-between mt-1 pl-12">
        <span className={`text-xs text-muted-foreground truncate ${isGoogleAuth ? '' : 'font-mono'}`}>
          {isGoogleAuth ? 'Login Google' : loading ? '...' : showPassword ? decryptedPw : '••••••••'}
        </span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className={`h-7 w-7 ${entry.isFavorite ? 'text-amber-400' : 'text-muted-foreground'}`} onClick={() => onToggleFavorite(entry)}>
            <Star className={`w-3.5 h-3.5 ${entry.isFavorite ? 'fill-current' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleCopyUsername}>
            <AtSign className="w-3.5 h-3.5" />
          </Button>
          {!isGoogleAuth && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleTogglePassword}>
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onEdit(entry)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir entrada</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{entry.site}</strong>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {entry.notes && (
        <p className="text-muted-foreground text-xs mt-3 pl-12 sm:pl-14 truncate">{entry.notes}</p>
      )}
    </div>
  );
};

export default VaultEntryCard;
