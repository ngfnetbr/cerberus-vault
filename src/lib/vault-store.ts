// Encrypted vault storage using localStorage

export interface VaultGroup {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  order: number;
}

export type VaultAuthType = 'password' | 'google';

export interface VaultEntry {
  id: string;
  site: string;
  username: string;
  authType: VaultAuthType;
  isFavorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
  encryptedPassword: string;
  notes: string;
  groupId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const VAULT_ENTRIES_KEY = 'vault_entries';
const VAULT_MASTER_HASH_KEY = 'vault_master_hash';
const VAULT_GROUPS_KEY = 'vault_groups';
const VAULT_TAGS_KEY = 'vault_tags';

const DEFAULT_GROUPS: VaultGroup[] = [
  { id: 'general', name: 'Geral', icon: 'folder', parentId: null, order: 0 },
  { id: 'email', name: 'E-mail', icon: 'mail', parentId: null, order: 1 },
  { id: 'social', name: 'Redes Sociais', icon: 'users', parentId: null, order: 2 },
  { id: 'banking', name: 'Bancos', icon: 'landmark', parentId: null, order: 3 },
  { id: 'work', name: 'Trabalho', icon: 'briefcase', parentId: null, order: 4 },
  { id: 'shopping', name: 'Compras', icon: 'shopping-cart', parentId: null, order: 5 },
];

export function getMasterHash(): string | null {
  return localStorage.getItem(VAULT_MASTER_HASH_KEY);
}

export function setMasterHash(hash: string): void {
  localStorage.setItem(VAULT_MASTER_HASH_KEY, hash);
}

// Groups
export function getGroups(): VaultGroup[] {
  const data = localStorage.getItem(VAULT_GROUPS_KEY);
  if (!data) {
    saveGroups(DEFAULT_GROUPS);
    return DEFAULT_GROUPS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_GROUPS;
  }
}

export function saveGroups(groups: VaultGroup[]): void {
  localStorage.setItem(VAULT_GROUPS_KEY, JSON.stringify(groups));
}

export function addGroup(group: VaultGroup): void {
  const groups = getGroups();
  groups.push(group);
  saveGroups(groups);
}

export function updateGroup(id: string, updated: Partial<VaultGroup>): void {
  const groups = getGroups();
  const index = groups.findIndex(g => g.id === id);
  if (index !== -1) {
    groups[index] = { ...groups[index], ...updated };
    saveGroups(groups);
  }
}

export function deleteGroup(id: string): void {
  const groups = getGroups().filter(g => g.id !== id && g.parentId !== id);
  saveGroups(groups);
  // Move entries from deleted group to null
  const entries = getEntries().map(e => e.groupId === id ? { ...e, groupId: null } : e);
  saveEntries(entries);
}

// Tags
export function getTags(): string[] {
  const data = localStorage.getItem(VAULT_TAGS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveTags(tags: string[]): void {
  localStorage.setItem(VAULT_TAGS_KEY, JSON.stringify(tags));
}

export function addTag(tag: string): void {
  const tags = getTags();
  if (!tags.includes(tag)) {
    tags.push(tag);
    saveTags(tags);
  }
}

export function deleteTag(tag: string): void {
  const tags = getTags().filter(t => t !== tag);
  saveTags(tags);
  // Remove tag from all entries
  const entries = getEntries().map(e =>
    e.tags?.includes(tag) ? { ...e, tags: e.tags.filter(t => t !== tag) } : e
  );
  saveEntries(entries);
}

// Entries
export function getEntries(): VaultEntry[] {
  const data = localStorage.getItem(VAULT_ENTRIES_KEY);
  if (!data) return [];
  try {
    const entries = JSON.parse(data) as VaultEntry[];
    // Migrate old entries without groupId/tags
    return entries.map(e => ({
      ...e,
      authType: e.authType === 'google' ? 'google' : 'password',
      isFavorite: e.isFavorite ?? false,
      useCount: e.useCount ?? 0,
      lastUsedAt: e.lastUsedAt ?? null,
      groupId: e.groupId ?? null,
      tags: e.tags ?? [],
    }));
  } catch {
    return [];
  }
}

export function saveEntries(entries: VaultEntry[]): void {
  localStorage.setItem(VAULT_ENTRIES_KEY, JSON.stringify(entries));
}

export function addEntry(entry: VaultEntry): void {
  const entries = getEntries();
  entries.push(entry);
  saveEntries(entries);
  // Auto-add tags
  entry.tags.forEach(t => addTag(t));
}

export function updateEntry(id: string, updated: Partial<VaultEntry>): void {
  const entries = getEntries();
  const index = entries.findIndex(e => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updated, updatedAt: new Date().toISOString() };
    saveEntries(entries);
    if (updated.tags) updated.tags.forEach(t => addTag(t));
  }
}

export function deleteEntry(id: string): void {
  const entries = getEntries().filter(e => e.id !== id);
  saveEntries(entries);
}

export function generateId(): string {
  return crypto.randomUUID();
}
