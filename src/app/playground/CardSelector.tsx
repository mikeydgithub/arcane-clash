'use client';

import { useState } from 'react';
import { CardData } from "@/types";
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface CardSelectorProps {
  cards: CardData[];
  onCardSelected: (card: CardData) => void;
}

export function CardSelector({ cards, onCardSelected }: CardSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCards = cards.filter(card =>
    card.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="relative mb-4">
        <Input
          type="text"
          placeholder="Search by card name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {filteredCards.map(card => (
          <button
            key={card.id}
            onClick={() => onCardSelected(card)}
            className="p-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <h3 className="text-lg font-bold">{card.title}</h3>
            <p className="text-sm text-gray-400">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
