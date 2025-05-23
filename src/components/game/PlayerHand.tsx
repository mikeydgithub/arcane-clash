
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
  hasCommittedCard?: boolean;
}

export function PlayerHand({ cards, onCardSelect, isPlayerTurn, isOpponent = false, selectedCardId, hasCommittedCard = false }: PlayerHandProps) {
  if (!cards) return null;

  const committedCardTranslation = isOpponent ? "md:translate-x-10" : "md:-translate-x-10";

  return (
    <div className={cn(
      "flex flex-col items-center space-y-1 md:space-y-2 p-1 md:p-2 transition-all duration-500 ease-in-out w-full overflow-y-auto max-h-[calc(100vh-200px)] flex-shrink-0",
      hasCommittedCard 
        ? `opacity-60 transform-gpu ${committedCardTranslation} scale-90 min-h-[100px] md:min-h-[140px]` 
        : "min-h-[200px] md:min-h-[300px]", 
    )}>
      {cards.map((card) => (
        <div key={card.id} className={cn(
          "transition-opacity duration-300",
          hasCommittedCard && card.id !== selectedCardId ? "opacity-60" : "opacity-100"
        )}>
          <CardView 
            card={card}
            onClick={() => onCardSelect(card)}
            isSelected={selectedCardId === card.id}
            isPlayable={isPlayerTurn && !hasCommittedCard} 
            isOpponentCard={isOpponent}
            // Pass isPlayerTurn to CardView to control its own styling (e.g. fading)
            isPlayerTurnForThisCard={isPlayerTurn && isOpponent} 
          />
        </div>
      ))}
      {cards.length === 0 && isPlayerTurn && !hasCommittedCard && (
        <p className="text-muted-foreground text-center">No cards in hand.</p>
      )}
       {cards.length === 0 && !isPlayerTurn && (
        <p className="text-muted-foreground text-center text-xs italic h-full flex items-center">Waiting for cards...</p>
      )}
    </div>
  );
}
