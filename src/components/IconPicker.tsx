import {
  Folder, Mail, Users, Landmark, Briefcase, ShoppingCart,
  Tag, Key, Globe, Heart, Star, Gamepad2, Music, Camera,
  BookOpen, Code, Cloud, Wifi, Smartphone, Monitor,
  CreditCard, Shield, Lock, Home, Car, Plane,
  Coffee, Gift, Palette, Wrench
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

const AVAILABLE_ICONS: { name: string; icon: React.ElementType }[] = [
  { name: 'folder', icon: Folder },
  { name: 'mail', icon: Mail },
  { name: 'users', icon: Users },
  { name: 'landmark', icon: Landmark },
  { name: 'briefcase', icon: Briefcase },
  { name: 'shopping-cart', icon: ShoppingCart },
  { name: 'tag', icon: Tag },
  { name: 'key', icon: Key },
  { name: 'globe', icon: Globe },
  { name: 'heart', icon: Heart },
  { name: 'star', icon: Star },
  { name: 'gamepad', icon: Gamepad2 },
  { name: 'music', icon: Music },
  { name: 'camera', icon: Camera },
  { name: 'book', icon: BookOpen },
  { name: 'code', icon: Code },
  { name: 'cloud', icon: Cloud },
  { name: 'wifi', icon: Wifi },
  { name: 'smartphone', icon: Smartphone },
  { name: 'monitor', icon: Monitor },
  { name: 'credit-card', icon: CreditCard },
  { name: 'shield', icon: Shield },
  { name: 'lock', icon: Lock },
  { name: 'home', icon: Home },
  { name: 'car', icon: Car },
  { name: 'plane', icon: Plane },
  { name: 'coffee', icon: Coffee },
  { name: 'gift', icon: Gift },
  { name: 'palette', icon: Palette },
  { name: 'wrench', icon: Wrench },
];

export const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  AVAILABLE_ICONS.map(i => [i.name, i.icon])
);

export function getIconComponent(name: string): React.ElementType {
  return ICON_MAP[name] || Folder;
}

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getIconComponent(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-9 h-9 rounded-md border border-border bg-vault-surface flex items-center justify-center hover:border-primary/50 transition-colors"
        >
          <SelectedIcon className="w-4 h-4 text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-card border-border" align="start">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 pb-2">Escolher ícone</p>
        <div className="grid grid-cols-6 gap-1">
          {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => { onChange(name); setOpen(false); }}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
                value === name
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;
