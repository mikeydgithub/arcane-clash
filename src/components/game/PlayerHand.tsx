
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
  hasCommittedCard?: boolean; // New prop
}

export function PlayerHand({ cards, onCardSelect, isPlayerTurn, isOpponent = false, selectedCardId, hasCommittedCard = false }: PlayerHandProps) {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex justify-center items-end space-x-1 md:space-x-2 p-2 md:p-4 flex-shrink-0 transition-all duration-500 ease-in-out",
      isOpponent ? "transform scale-y-[-1]" : "",
      hasCommittedCard 
        ? "opacity-60 transform-gpu md:translate-y-10 scale-90 min-h-[100px] md:min-h-[140px]" // Reduced min-h, increased translate-y
        : "min-h-[180px] md:min-h-[280px]" // Approx. card height + padding
    )}>
      {cards.map((card) => (
        <div key={card.id} className={cn(
          isOpponent ? "transform scale-y-[-1]" : "", // Counter-flip individual cards
          "transition-opacity duration-300",
          // Dim non-selected cards in a hand that has a committed card, but highlight the committed one if it's still "selected" visually
          hasCommittedCard && card.id !== selectedCardId ? "opacity-60" : "opacity-100"
        )}>
          <CardView 
            card={card}
            onClick={() => onCardSelect(card)}
            isSelected={selectedCardId === card.id}
            // A player can only play if it's their turn AND they haven't already committed a card from this hand.
            isPlayable={isPlayerTurn && !hasCommittedCard} 
            isOpponentCard={isOpponent}
          />
        </div>
      ))}
      {cards.length === 0 && isPlayerTurn && !isOpponent && !hasCommittedCard && (
        <p className="text-muted-foreground">No cards in hand.</p>
      )}
       {cards.length === 0 && isPlayerTurn && isOpponent && !hasCommittedCard && ( // Message for opponent's empty hand if playable
        <p className={cn("text-muted-foreground", isOpponent ? "transform scale-y-[-1]" : "")}>No cards in hand.</p>
      )}
    </div>
  );
}

