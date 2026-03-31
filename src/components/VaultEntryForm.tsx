import { useState, useEffect, useRef } from 'react';
import { Globe, User, Lock, FileText, Shuffle, Eye, EyeOff, Tag, FolderOpen, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { encrypt, decrypt } from '@/lib/crypto';
import { addEntry, updateEntry, generateId, getGroups, getTags, addTag, deleteTag, type VaultAuthType, type VaultEntry } from '@/lib/vault-store';
import { useToast } from '@/hooks/use-toast';
import PasswordStrength from './PasswordStrength';

interface VaultEntryFormProps {
  masterPassword: string;
  entry: VaultEntry | null;
  defaultGroupId?: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

const VaultEntryForm = ({ masterPassword, entry, defaultGroupId, onSaved, onCancel }: VaultEntryFormProps) => {
  const [site, setSite] = useState('');
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<VaultAuthType>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes] = useState('');
  const [groupId, setGroupId] = useState<string>(defaultGroupId || 'general');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const groups = getGroups();
  const existingTags = getTags();

  useEffect(() => {
    if (entry) {
      setSite(entry.site);
      setUsername(entry.username);
      setAuthType(entry.authType ?? 'password');
      setNotes(entry.notes);
      setGroupId(entry.groupId || 'general');
      setTags(entry.tags || []);
      decrypt(entry.encryptedPassword, masterPassword).then(setPassword).catch(() => {});
    } else {
      setSite('');
      setUsername('');
      setAuthType('password');
      setPassword('');
      setShowPassword(false);
      setNotes('');
      setGroupId(defaultGroupId || 'general');
      setTags([]);
      setTagInput('');
    }
  }, [entry, masterPassword, defaultGroupId]);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    setPassword(Array.from(array, b => chars[b % chars.length]).join(''));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      addTag(tag);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site || !username || (authType === 'password' && !password)) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const encryptedPassword = await encrypt(authType === 'google' ? '' : password, masterPassword);
      const now = new Date().toISOString();

      if (entry) {
        updateEntry(entry.id, { site, username, authType, encryptedPassword, notes, groupId, tags, updatedAt: now });
        toast({ title: 'Entrada atualizada!' });
      } else {
        addEntry({
          id: generateId(),
          site,
          username,
          authType,
          isFavorite: false,
          useCount: 0,
          lastUsedAt: null,
          encryptedPassword,
          notes,
          groupId,
          tags,
          createdAt: now,
          updatedAt: now,
        });
        toast({ title: 'Entrada adicionada!' });
      }
      onSaved();
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Site (ex: github.com)" value={site} onChange={e => setSite(e.target.value)} className="pl-10 bg-vault-surface border-border" />
      </div>
      <Select value={authType} onValueChange={(value) => setAuthType(value as VaultAuthType)}>
        <SelectTrigger className="bg-vault-surface border-border">
          <SelectValue placeholder="Tipo de acesso" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="password">Login com senha</SelectItem>
          <SelectItem value="google">Login com Google</SelectItem>
        </SelectContent>
      </Select>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={authType === 'google' ? 'E-mail da conta Google' : 'Username / Email'}
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="pl-10 bg-vault-surface border-border"
        />
      </div>
      {authType === 'password' ? (
        <>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 pr-20 bg-vault-surface border-border font-mono" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button type="button" onClick={generatePassword} className="text-muted-foreground hover:text-primary transition-colors">
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>
          <PasswordStrength password={password} />
        </>
      ) : (
        <div className="rounded-lg border border-border bg-vault-surface/50 px-3 py-2 text-sm text-muted-foreground">
          Esta entrada usa login com Google. Apenas o e-mail será necessário.
        </div>
      )}

      {/* Group selector */}
      <div className="flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="bg-vault-surface border-border">
            <SelectValue placeholder="Selecionar grupo" />
          </SelectTrigger>
          <SelectContent>
            {groups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags - dropdown multi-select */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-start bg-vault-surface border-border text-sm font-normal">
                {tags.length > 0 ? `${tags.length} tag${tags.length > 1 ? 's' : ''} selecionada${tags.length > 1 ? 's' : ''}` : 'Selecionar tags'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              {/* Create new tag */}
              <div className="flex items-center gap-1 mb-2">
                <Input
                  placeholder="Nova tag..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  className="h-8 text-xs bg-vault-surface border-border"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleAddTag} disabled={!tagInput.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {/* Existing tags list */}
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {existingTags.length === 0 && !tagInput && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag cadastrada</p>
                )}
                {existingTags.map(tag => {
                  const selected = tags.includes(tag);
                  return (
                    <div key={tag} className="flex items-center group/tag">
                      <button
                        type="button"
                        onClick={() => selected ? handleRemoveTag(tag) : setTags([...tags, tag])}
                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="truncate">{tag}</span>
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="opacity-0 group-hover/tag:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                            title="Excluir tag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover tag</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja remover a tag <strong>"{tag}"</strong>? Ela será removida de todas as entradas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => { deleteTag(tag); handleRemoveTag(tag); }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-6">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20" onClick={() => handleRemoveTag(tag)}>
                {tag} ×
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Textarea placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} className="pl-10 bg-vault-surface border-border min-h-[80px]" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? 'Salvando...' : entry ? 'Atualizar' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

export default VaultEntryForm;
