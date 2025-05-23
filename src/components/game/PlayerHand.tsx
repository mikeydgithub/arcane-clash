'use client';

import type { CardData } from '@/types';
import { CardView } from './CardView';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  cards: CardData[];
  onCardSelect: (card: CardData) => void;
  isPlayerTurn: boolean;
  isOpponent?: boolean;
  selectedCardId?: string;
}

export function PlayerHand({ cards, onCardSelect, isPlayerTurn, isOpponent = false, selectedCardId }: PlayerHandProps) {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex justify-center items-end space-x-1 md:space-x-2 p-2 md:p-4 min-h-[180px] md:min-h-[280px]",
      isOpponent ? "transform scale-y-[-1]" : "" // Flip opponent's hand for top display
    )}>
      {cards.map((card, index) => (
        <div key={card.id} className={cn(isOpponent ? "transform scale-y-[-1]" : "")}>
          <CardView 
            card={card}
            onClick={() => onCardSelect(card)}
            isSelected={selectedCardId === card.id}
            isPlayable={isPlayerTurn && !isOpponent}
            isOpponentCard={isOpponent}
          />
        </div>
      ))}
      {cards.length === 0 && isPlayerTurn && !isOpponent && (
        <p className="text-muted-foreground">No cards in hand.</p>
      )}
    </div>
  );
}
