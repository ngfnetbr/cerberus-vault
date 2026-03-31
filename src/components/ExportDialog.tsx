import { useState, useMemo } from 'react';
import { Download, Search, CheckSquare, Square, FolderTree, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { VaultEntry, VaultGroup } from '@/lib/vault-store';

export interface VaultExportData {
  entries: VaultEntry[];
  groups?: VaultGroup[];
  tags?: string[];
  exportedAt: string;
  version: 2;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: VaultEntry[];
  groups: VaultGroup[];
  tags: string[];
  onExport: (data: VaultExportData) => void;
}

const ExportDialog = ({ open, onOpenChange, entries, groups, tags, onExport }: ExportDialogProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(entries.map(e => e.id)));
  const [search, setSearch] = useState('');
  const [includeGroups, setIncludeGroups] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.site.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const groupName = (gid: string | null) =>
    groups.find(g => g.id === (gid || 'general'))?.name || 'Geral';

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach(e => next.delete(e.id));
    } else {
      filtered.forEach(e => next.add(e.id));
    }
    setSelected(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleExport = () => {
    const selectedEntries = entries.filter(e => selected.has(e.id));
    const usedGroupIds = new Set(selectedEntries.map(e => e.groupId || 'general'));
    const usedTags = new Set(selectedEntries.flatMap(e => e.tags || []));

    const data: VaultExportData = {
      entries: selectedEntries,
      groups: includeGroups ? groups.filter(g => usedGroupIds.has(g.id)) : undefined,
      tags: includeTags ? tags.filter(t => usedTags.has(t)) : undefined,
      exportedAt: new Date().toISOString(),
      version: 2,
    };
    onExport(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar senhas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-vault-surface border-border"
            />
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <button onClick={toggleAll} className="flex items-center gap-2 hover:text-foreground transition-colors">
              {allFilteredSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
              {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span className="font-mono text-xs">{selected.size} selecionadas</span>
          </div>

          <ScrollArea className="h-[250px] rounded-md border border-border">
            <div className="p-2 space-y-1">
              {filtered.map(entry => (
                <label
                  key={entry.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-vault-surface-hover cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selected.has(entry.id)}
                    onCheckedChange={() => toggle(entry.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.site}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.username}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {groupName(entry.groupId)}
                  </span>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado.</p>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-4 px-1 py-1">
            <Label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={includeGroups} onCheckedChange={setIncludeGroups} />
              <FolderTree className="w-3.5 h-3.5 text-muted-foreground" />
              Grupos
            </Label>
            <Label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={includeTags} onCheckedChange={setIncludeTags} />
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              Tags
            </Label>
          </div>

          <Button onClick={handleExport} disabled={selected.size === 0} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Exportar {selected.size} {selected.size === 1 ? 'senha' : 'senhas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
