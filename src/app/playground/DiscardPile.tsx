'use client';

import { CardData } from '@/types';

interface DiscardPileProps {
  cards: CardData[];
}

export function DiscardPile({ cards }: DiscardPileProps) {
  return (
    <div className="p-4 rounded-lg bg-gray-800">
      <h3 className="text-lg font-semibold mb-2">Discard Pile</h3>
      <div className="flex flex-col gap-2">
        {cards.map(card => (
          <div key={card.id} className="text-sm p-2 rounded bg-gray-700">{card.title}</div>
        ))}
      </div>
    </div>
  );
}
