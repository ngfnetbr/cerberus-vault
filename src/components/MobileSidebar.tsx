import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import VaultSidebar from './VaultSidebar';
import type { VaultGroup } from '@/lib/vault-store';
import { useState } from 'react';

interface MobileSidebarProps {
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

const MobileSidebar = (props: MobileSidebarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground">
          <Menu className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 bg-sidebar border-border flex flex-col h-full">
        <div onClick={() => setOpen(false)} className="flex flex-col h-full overflow-hidden">
          <VaultSidebar {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileSidebar;
