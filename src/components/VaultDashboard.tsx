import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, LogOut, Download, Upload, Tag, FolderSync, FolderOpen, Unlink, CheckCircle2, Clock, X } from 'lucide-react';
import cerberusLogo from '@/assets/cerberus-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileSidebar from './MobileSidebar';
import { getEntries, saveEntries, getGroups, saveGroups, getTags, saveTags, deleteTag, getMasterHash, setMasterHash, type VaultEntry, type VaultGroup } from '@/lib/vault-store';
import { useToast } from '@/hooks/use-toast';
import { decrypt } from '@/lib/crypto';
import { isFileSystemSupported, isFileLinked, pickDirectory, unlinkFile, loadFromFile, getLinkedFileName } from '@/lib/file-sync';
import { useFileSync } from '@/hooks/use-file-sync';
import VaultEntryCard from './VaultEntryCard';
import VaultEntryForm from './VaultEntryForm';
import VaultSidebar from './VaultSidebar';
import VaultSettingsDialog, { getSettings, type VaultSettings } from './VaultSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ExportDialog, { type VaultExportData } from './ExportDialog';
import ImportConfirmDialog, { type ImportSummary } from './ImportConfirmDialog';

interface VaultDashboardProps {
  masterPassword: string;
  onLock: () => void;
  onSettingsChanged: (settings: VaultSettings) => void;
  settings: VaultSettings;
}

const VaultDashboard = ({ masterPassword, onLock, onSettingsChanged, settings }: VaultDashboardProps) => {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [groups, setGroups] = useState<VaultGroup[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [decryptedPasswords, setDecryptedPasswords] = useState<Record<string, string>>({});
  const [selectedView, setSelectedView] = useState<'all' | 'group' | 'tags' | 'trash'>('all');
  const [showExport, setShowExport] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [pendingImportData, setPendingImportData] = useState<VaultExportData | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [fileLinked, setFileLinked] = useState(isFileLinked());
  const { toast } = useToast();
  const { syncToFile, lastSyncAt, setLastSyncAt, hasPendingChanges, markDirty } = useFileSync();
  const isMobile = useIsMobile();

  const loadAll = useCallback(() => {
    setEntries(getEntries());
    setGroups(getGroups());
    setTags(getTags());
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-sync to file after every loadAll (which runs after add/edit/delete)
  const loadAndSync = useCallback(() => {
    loadAll();
    markDirty();
    syncToFile();
  }, [loadAll, syncToFile, markDirty]);

  const decryptPassword = useCallback(async (entry: VaultEntry): Promise<string> => {
    if (decryptedPasswords[entry.id]) return decryptedPasswords[entry.id];
    const pw = await decrypt(entry.encryptedPassword, masterPassword);
    setDecryptedPasswords(prev => ({ ...prev, [entry.id]: pw }));
    return pw;
  }, [masterPassword, decryptedPasswords]);

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => {
      const gid = e.groupId || 'general';
      counts[gid] = (counts[gid] || 0) + 1;
    });
    return counts;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let filtered = entries;

    // Filter by view
    if (selectedView === 'group' && selectedGroupId) {
      filtered = filtered.filter(e => (e.groupId || 'general') === selectedGroupId);
    } else if (selectedView === 'tags' && selectedTag) {
      filtered = filtered.filter(e => e.tags?.includes(selectedTag));
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.site.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.tags?.some(t => t.includes(q))
      );
    }

    return filtered;
  }, [entries, selectedView, selectedGroupId, selectedTag, search]);

  const handleSaved = () => {
    setShowForm(false);
    setEditingEntry(null);
    loadAndSync();
    setDecryptedPasswords({});
  };

  const handleEdit = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeleted = () => { loadAndSync(); setDecryptedPasswords({}); };

  const handleSelectGroup = (groupId: string) => {
    setSelectedView('group');
    setSelectedGroupId(groupId);
    setSelectedTag(null);
  };

  const handleSelectView = (view: 'all' | 'tags' | 'trash') => {
    setSelectedView(view);
    setSelectedGroupId(null);
    if (view !== 'tags') setSelectedTag(null);
  };

  const handleExport = (data: VaultExportData) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const count = data.entries.length;
    toast({ title: `${count} ${count === 1 ? 'senha exportada' : 'senhas exportadas'}!` });
  };

  const parseImportFile = (raw: string): VaultExportData | null => {
    const parsed = JSON.parse(raw);
    // Support v2 format
    if (parsed.version === 2 && Array.isArray(parsed.entries)) return parsed;
    // Support legacy format (plain array)
    if (Array.isArray(parsed)) {
      return { entries: parsed, exportedAt: '', version: 2 };
    }
    return null;
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = parseImportFile(text);
        if (!data || data.entries.some(e => !e.id || !e.encryptedPassword)) {
          toast({ title: 'Arquivo inválido', variant: 'destructive' });
          return;
        }
        const existing = getEntries();
        const existingIds = new Set(existing.map(e => e.id));
        const newEntries = data.entries.filter(e => !existingIds.has(e.id));

        const existingGroups = getGroups();
        const existingGroupIds = new Set(existingGroups.map(g => g.id));
        const newGroups = (data.groups || []).filter(g => !existingGroupIds.has(g.id));

        const existingTags = getTags();
        const existingTagSet = new Set(existingTags);
        const newTags = (data.tags || []).filter(t => !existingTagSet.has(t));

        const summary: ImportSummary = {
          newEntries,
          duplicateCount: data.entries.length - newEntries.length,
          newGroups,
          newTags,
          totalImported: data.entries.length,
        };

        setImportSummary(summary);
        setPendingImportData(data);
        setShowImportConfirm(true);
      } catch {
        toast({ title: 'Erro ao importar', variant: 'destructive' });
      }
    };
    input.click();
  };

  const confirmImport = () => {
    if (!importSummary || !pendingImportData) return;
    const { newEntries, newGroups, newTags } = importSummary;

    if (newEntries.length > 0) {
      saveEntries([...getEntries(), ...newEntries]);
    }
    if (newGroups.length > 0) {
      saveGroups([...getGroups(), ...newGroups]);
    }
    if (newTags.length > 0) {
      const allTags = [...getTags(), ...newTags];
      saveTags(allTags);
    }

    loadAndSync();
    setDecryptedPasswords({});
    setShowImportConfirm(false);
    setPendingImportData(null);
    setImportSummary(null);

    const parts: string[] = [];
    if (newEntries.length > 0) parts.push(`${newEntries.length} ${newEntries.length === 1 ? 'senha' : 'senhas'}`);
    if (newGroups.length > 0) parts.push(`${newGroups.length} ${newGroups.length === 1 ? 'grupo' : 'grupos'}`);
    if (newTags.length > 0) parts.push(`${newTags.length} ${newTags.length === 1 ? 'tag' : 'tags'}`);
    toast({ title: `Importado: ${parts.join(', ')}` });
  };

  const viewTitle = useMemo(() => {
    if (selectedView === 'group' && selectedGroupId) {
      return groups.find(g => g.id === selectedGroupId)?.name || 'Grupo';
    }
    if (selectedView === 'tags') return 'Tags';
    return 'Todas as senhas';
  }, [selectedView, selectedGroupId, groups]);

  const handleLinkFolder = async () => {
    const linked = await pickDirectory();
    if (linked) {
      setFileLinked(true);
      // Load existing data from file if it has content
      const fileData = await loadFromFile();
      if (fileData && fileData.entries.length > 0) {
        // Merge file data into localStorage
        const existingEntries = getEntries();
        const existingIds = new Set(existingEntries.map(e => e.id));
        const newEntries = fileData.entries.filter(e => !existingIds.has(e.id));
        if (newEntries.length > 0) saveEntries([...existingEntries, ...newEntries]);

        if (fileData.groups) {
          const existingGroups = getGroups();
          const existingGids = new Set(existingGroups.map(g => g.id));
          const newGroups = fileData.groups.filter(g => !existingGids.has(g.id));
          if (newGroups.length > 0) saveGroups([...existingGroups, ...newGroups]);
        }
        if (fileData.tags) {
          const existingTags = getTags();
          const existingTagSet = new Set(existingTags);
          const newTags = fileData.tags.filter(t => !existingTagSet.has(t));
          if (newTags.length > 0) saveTags([...existingTags, ...newTags]);
        }
        if (fileData.masterHash && !getMasterHash()) {
          setMasterHash(fileData.masterHash);
        }
        loadAll();
      }
      // Save current state to file
      syncToFile().then(() => setLastSyncAt(new Date()));
      toast({ title: 'Pasta vinculada!', description: 'O cofre será salvo automaticamente no arquivo local.' });
    }
  };

  const handleUnlinkFolder = () => {
    unlinkFile();
    setFileLinked(false);
    toast({ title: 'Pasta desvinculada', description: 'O cofre continuará salvo no navegador.' });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between py-3 px-3 md:px-4 gap-2">
          <div className="flex items-center gap-2">
            <MobileSidebar
              groups={groups}
              selectedGroupId={selectedGroupId}
              selectedView={selectedView}
              entryCounts={entryCounts}
              totalCount={entries.length}
              onSelectGroup={handleSelectGroup}
              onSelectView={handleSelectView}
              onGroupsChanged={loadAndSync}
            />
            <img src={cerberusLogo} alt="Cerberus" className="w-7 h-7 object-contain" />
            <h1 className="text-lg font-bold vault-text-gradient hidden sm:block" style={{ fontFamily: "'Cinzel Decorative', serif" }}>CERBERUS</h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Last sync indicator */}
            {fileLinked && lastSyncAt && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground font-mono mr-1 cursor-default">
                      <Clock className="w-3 h-3" />
                      {lastSyncAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Última sincronização: {lastSyncAt.toLocaleString('pt-BR')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {isFileSystemSupported() && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {fileLinked ? (
                      <Button variant="ghost" size="icon" onClick={handleUnlinkFolder} className="relative text-primary hover:text-destructive h-8 w-8" title="Desvincular pasta">
                        <CheckCircle2 className="w-4 h-4" />
                        {hasPendingChanges && (
                          <span className="absolute top-1 right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        )}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={handleLinkFolder} className="text-muted-foreground hover:text-foreground h-8 w-8" title="Vincular pasta local">
                        <FolderSync className="w-4 h-4" />
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {fileLinked ? 'Sincronizado com arquivo local — clique para desvincular' : 'Vincular a uma pasta local para salvar automaticamente'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <VaultSettingsDialog settings={settings} onSettingsChanged={onSettingsChanged} masterPassword={masterPassword} />
            <Button variant="ghost" size="icon" onClick={() => setShowExport(true)} className="text-muted-foreground hover:text-foreground h-8 w-8" title="Exportar">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleImport} className="text-muted-foreground hover:text-foreground h-8 w-8" title="Importar">
              <Upload className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onLock} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Bloquear</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile, uses Sheet instead */}
        <div className="hidden md:block">
          <VaultSidebar
            groups={groups}
            selectedGroupId={selectedGroupId}
            selectedView={selectedView}
            entryCounts={entryCounts}
            totalCount={entries.length}
            onSelectGroup={handleSelectGroup}
            onSelectView={handleSelectView}
            onGroupsChanged={loadAndSync}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            {/* Title + search */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{viewTitle}</h2>
              <span className="text-xs text-muted-foreground font-mono">{filteredEntries.length} entradas</span>
            </div>

            {/* Tags filter (when in tags view) */}
            {selectedView === 'tags' && (
              <div className="flex flex-wrap gap-2 mb-6">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    className="cursor-pointer text-xs group/tag gap-1"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="ml-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
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
                            onClick={() => {
                              deleteTag(tag);
                              if (selectedTag === tag) setSelectedTag(null);
                              loadAndSync();
                              toast({ title: `Tag "${tag}" removida` });
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhuma tag criada ainda.</p>
                )}
              </div>
            )}

            <div className="flex gap-2 md:gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-vault-surface border-border"
                />
              </div>
              <Button onClick={() => { setEditingEntry(null); setShowForm(true); }} className="shrink-0">
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Adicionar</span>
              </Button>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="text-center py-20">
                <img src={cerberusLogo} alt="" className="w-16 h-16 object-contain mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">
                  {entries.length === 0 ? 'Seu cofre está vazio. Adicione sua primeira senha!' : 'Nenhum resultado encontrado.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map(entry => (
                  <VaultEntryCard
                    key={entry.id}
                    entry={entry}
                    onDecrypt={decryptPassword}
                    onEdit={handleEdit}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {editingEntry ? 'Editar entrada' : 'Nova entrada'}
            </DialogTitle>
          </DialogHeader>
          <VaultEntryForm
            masterPassword={masterPassword}
            entry={editingEntry}
            defaultGroupId={selectedView === 'group' ? selectedGroupId : null}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditingEntry(null); }}
          />
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        entries={entries}
        groups={groups}
        tags={tags}
        onExport={handleExport}
      />

      <ImportConfirmDialog
        open={showImportConfirm}
        onOpenChange={setShowImportConfirm}
        summary={importSummary}
        onConfirm={confirmImport}
      />
    </div>
  );
};

export default VaultDashboard;
