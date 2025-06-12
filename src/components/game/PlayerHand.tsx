
'use client';

import type { CardData, MonsterCardData } from '@/types';
import { CardView } from './CardView';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  cards: CardData[];
  onCardSelect: (card: CardData) => void; 
  isPlayerTurn: boolean;
  isOpponent?: boolean;
  canPlayMonster?: boolean; 
}

export function PlayerHand({ cards, onCardSelect, isPlayerTurn, isOpponent = false, canPlayMonster = true }: PlayerHandProps) {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex flex-col items-center space-y-1 md:space-y-2 p-1 md:p-2 transition-all duration-500 ease-in-out w-full overflow-y-auto max-h-[calc(100vh-200px)] flex-shrink-0",
      "min-h-[200px] md:min-h-[300px]", 
      isPlayerTurn ? "bg-primary/5" : "" // Subtle indication of active player's hand
    )}>
      {cards.map((card) => {
        let cardIsActuallyPlayable = false;
        if (isPlayerTurn) {
          if (card.cardType === 'Monster' && canPlayMonster) {
            cardIsActuallyPlayable = true;
          } else if (card.cardType === 'Spell') {
            cardIsActuallyPlayable = true;
          }
        }

        return (
          <div key={card.id} className={cn(
            "transition-opacity duration-300",
            cardIsActuallyPlayable ? "cursor-pointer" : "cursor-not-allowed opacity-80"
          )}>
            <CardView 
              card={card}
              onClick={() => cardIsActuallyPlayable && onCardSelect(card)}
              isPlayable={cardIsActuallyPlayable} 
              isOpponentCard={isOpponent}
              isPlayerTurnForThisCard={isPlayerTurn && isOpponent} 
              showDescriptionTooltip={true} // Enable tooltip for cards in hand
            />
          </div>
        );
      })}
      {cards.length === 0 && (
        <p className="text-muted-foreground text-center text-xs italic h-full flex items-center p-4">
          {isPlayerTurn ? "No cards in hand. Waiting to draw..." : "Hand is empty."}
        </p>
      )}
    </div>
  );
}
