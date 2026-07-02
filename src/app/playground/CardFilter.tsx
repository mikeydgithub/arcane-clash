'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';

export interface CardFilterState {
  monster: boolean;
  monster_effects: boolean;
  spell: boolean;
}

interface CardFilterProps {
  filterState: CardFilterState;
  onFilterChange: (newState: CardFilterState) => void;
}

export function CardFilter({ filterState, onFilterChange }: CardFilterProps) {
  const handleCheckedChange = (filterType: keyof CardFilterState) => (checked: boolean) => {
    onFilterChange({
      ...filterState,
      [filterType]: checked,
    });
  };

  const activeFiltersCount = Object.values(filterState).filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter Cards {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Filter by Card Type</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={filterState.monster}
          onCheckedChange={handleCheckedChange('monster')}
        >
          Monsters
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filterState.monster_effects}
          onCheckedChange={handleCheckedChange('monster_effects')}
        >
          Monsters with Effects
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filterState.spell}
          onCheckedChange={handleCheckedChange('spell')}
        >
          Spells
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
