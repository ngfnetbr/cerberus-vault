// File System Access API integration for local vault persistence
// Works in Chrome/Edge. Falls back gracefully in unsupported browsers.

import type { VaultEntry, VaultGroup } from './vault-store';

interface VaultFileData {
  version: 2;
  masterHash: string;
  entries: VaultEntry[];
  groups: VaultGroup[];
  tags: string[];
  updatedAt: string;
}

const FILE_HANDLE_KEY = 'vault_file_linked';
let fileHandle: FileSystemFileHandle | null = null;
let dirHandle: FileSystemDirectoryHandle | null = null;

const VAULT_FILENAME = 'cerberus-vault.json';

export function isFileSystemSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

export function isFileLinked(): boolean {
  return fileHandle !== null;
}

export async function pickDirectory(): Promise<boolean> {
  if (!isFileSystemSupported()) return false;
  try {
    dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    try {
      fileHandle = await dirHandle!.getFileHandle(VAULT_FILENAME, { create: false });
    } catch {
      // File doesn't exist yet, will be created on first save
      fileHandle = await dirHandle!.getFileHandle(VAULT_FILENAME, { create: true });
    }
    localStorage.setItem(FILE_HANDLE_KEY, 'true');
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') return false; // User cancelled
    console.error('Failed to pick directory:', err);
    return false;
  }
}

export async function saveToFile(data: VaultFileData): Promise<boolean> {
  if (!fileHandle) return false;
  try {
    // Verify permission
    const permission = await (fileHandle as any).queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const request = await (fileHandle as any).requestPermission({ mode: 'readwrite' });
      if (request !== 'granted') return false;
    }

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.error('Failed to save vault file:', err);
    return false;
  }
}

export async function loadFromFile(): Promise<VaultFileData | null> {
  if (!fileHandle) return null;
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text) as VaultFileData;
    if (data.version === 2 && Array.isArray(data.entries)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function unlinkFile(): void {
  fileHandle = null;
  dirHandle = null;
  localStorage.removeItem(FILE_HANDLE_KEY);
}

export function getLinkedFileName(): string | null {
  if (!fileHandle) return null;
  return fileHandle.name;
}

// Build the full vault snapshot for saving
export function buildVaultSnapshot(
  masterHash: string,
  entries: VaultEntry[],
  groups: VaultGroup[],
  tags: string[],
): VaultFileData {
  return {
    version: 2,
    masterHash,
    entries,
    groups,
    tags,
    updatedAt: new Date().toISOString(),
  };
}
