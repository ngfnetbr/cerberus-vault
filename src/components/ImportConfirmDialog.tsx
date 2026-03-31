import { useState } from 'react';
import { Upload, FileCheck, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { VaultEntry, VaultGroup } from '@/lib/vault-store';
import type { VaultExportData } from './ExportDialog';

interface ImportSummary {
  newEntries: VaultEntry[];
  duplicateCount: number;
  newGroups: VaultGroup[];
  newTags: string[];
  totalImported: number;
}

interface ImportConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ImportSummary | null;
  onConfirm: () => void;
}

const ImportConfirmDialog = ({ open, onOpenChange, summary, onConfirm }: ImportConfirmDialogProps) => {
  if (!summary) return null;

  const { newEntries, duplicateCount, newGroups, newTags } = summary;
  const hasNew = newEntries.length > 0 || newGroups.length > 0 || newTags.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Confirmar importação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!hasNew ? (
            <div className="flex items-start gap-3 p-3 rounded-md bg-vault-surface">
              <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Nenhuma entrada nova</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todas as {duplicateCount} senhas do arquivo já existem no cofre.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {newEntries.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-md bg-vault-surface">
                    <FileCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {newEntries.length} {newEntries.length === 1 ? 'senha nova' : 'senhas novas'}
                      </p>
                      <ScrollArea className={newEntries.length > 4 ? 'h-[120px] mt-1' : 'mt-1'}>
                        <div className="space-y-1">
                          {newEntries.map(e => (
                            <p key={e.id} className="text-xs text-muted-foreground truncate">
                              {e.site} — {e.username}
                            </p>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                {duplicateCount > 0 && (
                  <p className="text-xs text-muted-foreground px-1">
                    {duplicateCount} {duplicateCount === 1 ? 'entrada já existe' : 'entradas já existem'} e {duplicateCount === 1 ? 'será ignorada' : 'serão ignoradas'}.
                  </p>
                )}

                {newGroups.length > 0 && (
                  <p className="text-xs text-muted-foreground px-1">
                    + {newGroups.length} {newGroups.length === 1 ? 'grupo novo' : 'grupos novos'}: {newGroups.map(g => g.name).join(', ')}
                  </p>
                )}

                {newTags.length > 0 && (
                  <p className="text-xs text-muted-foreground px-1">
                    + {newTags.length} {newTags.length === 1 ? 'tag nova' : 'tags novas'}: {newTags.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={onConfirm} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
              </div>
            </>
          )}

          {!hasNew && (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportConfirmDialog;
export type { ImportSummary };
