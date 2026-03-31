import { useState } from 'react';
import {
  Plus, Tag, Key, Trash2, Pencil, Check, X,
  FolderOpen, Star
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { addGroup, updateGroup, deleteGroup, generateId, type VaultGroup } from '@/lib/vault-store';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import IconPicker, { getIconComponent } from './IconPicker';

interface VaultSidebarProps {
  groups: VaultGroup[];
  selectedGroupId: string | null;
  selectedView: 'all' | 'group' | 'tags' | 'favorites' | 'trash';
  entryCounts: Record<string, number>;
  totalCount: number;
  favoriteCount: number;
  onSelectGroup: (groupId: string) => void;
  onSelectView: (view: 'all' | 'tags' | 'favorites' | 'trash') => void;
  onGroupsChanged: () => void;
}

const VaultSidebar = ({
  groups,
  selectedGroupId,
  selectedView,
  entryCounts,
  totalCount,
  favoriteCount,
  onSelectGroup,
  onSelectView,
  onGroupsChanged,
}: VaultSidebarProps) => {
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('folder');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('folder');
  const { toast } = useToast();

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    addGroup({
      id: generateId(),
      name: newGroupName.trim(),
      icon: newGroupIcon,
      parentId: null,
      order: groups.length,
    });
    setNewGroupName('');
    setNewGroupIcon('folder');
    setAddingGroup(false);
    onGroupsChanged();
  };

  const handleEditGroup = (group: VaultGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditIcon(group.icon);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    updateGroup(id, { name: editName.trim(), icon: editIcon });
    setEditingId(null);
    onGroupsChanged();
  };

  const handleDeleteGroup = (id: string) => {
    deleteGroup(id);
    onGroupsChanged();
    if (selectedGroupId === id) onSelectView('all');
    toast({ title: 'Grupo removido' });
  };

  const IconForGroup = (icon: string) => getIconComponent(icon);

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2">Navegação</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {/* All entries */}
        <button
          onClick={() => onSelectView('all')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
            selectedView === 'all' && !selectedGroupId
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          }`}
        >
          <Key className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">Todas as senhas</span>
          <span className="text-[10px] text-muted-foreground font-mono">{totalCount}</span>
        </button>

        <button
          onClick={() => onSelectView('favorites')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
            selectedView === 'favorites'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          }`}
        >
          <Star className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">Favoritos</span>
          <span className="text-[10px] text-muted-foreground font-mono">{favoriteCount}</span>
        </button>

        {/* Groups header */}
        <div className="flex items-center justify-between px-2 pt-4 pb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Grupos</p>
          <button
            onClick={() => setAddingGroup(true)}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add group input */}
        {addingGroup && (
          <div className="flex items-center gap-1 px-1">
            <IconPicker value={newGroupIcon} onChange={setNewGroupIcon} />
            <Input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
              placeholder="Nome do grupo"
              className="h-7 text-xs bg-sidebar-accent border-border"
              autoFocus
            />
            <button onClick={handleAddGroup} className="text-primary hover:text-primary/80">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setAddingGroup(false); setNewGroupName(''); setNewGroupIcon('folder'); }} className="text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Group items */}
        {groups.map(group => {
          const Icon = IconForGroup(group.icon);
          const isSelected = selectedView === 'group' && selectedGroupId === group.id;
          const count = entryCounts[group.id] || 0;

          if (editingId === group.id) {
            return (
              <div key={group.id} className="flex items-center gap-1 px-1">
                <IconPicker value={editIcon} onChange={setEditIcon} />
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit(group.id)}
                  className="h-7 text-xs bg-sidebar-accent border-border"
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(group.id)} className="text-primary">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }

          return (
            <div key={group.id} className="group/item flex items-center">
              <button
                onClick={() => onSelectGroup(group.id)}
                className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isSelected
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                {isSelected ? <FolderOpen className="w-4 h-4 shrink-0 text-primary" /> : <Icon className="w-4 h-4 shrink-0" />}
                <span className="truncate flex-1 text-left">{group.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{count}</span>
              </button>
              <div className="hidden group-hover/item:flex items-center gap-0.5 pr-1">
                <button onClick={() => handleEditGroup(group)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir grupo</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o grupo <strong>{group.name}</strong>? As entradas serão movidas para "Sem grupo".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteGroup(group.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}

        {/* Tags view */}
        <div className="pt-4 pb-1 px-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Outros</p>
        </div>
        <button
          onClick={() => onSelectView('tags')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
            selectedView === 'tags'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          }`}
        >
          <Tag className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">Tags</span>
        </button>
      </nav>
    </aside>
  );
};

export default VaultSidebar;
