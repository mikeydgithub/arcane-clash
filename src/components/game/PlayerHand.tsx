
'use client';

import type { CardData, MonsterCardData } from '@/types';
import { CardView } from './CardView';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  cards: CardData[];
  onCardSelect: (card: CardData) => void; // Called when a card is clicked for playing
  isPlayerTurn: boolean;
  isOpponent?: boolean;
  canPlayMonster?: boolean; // True if the player can play a monster (e.g., arena slot empty)
  // selectedCardId and hasCommittedCard are no longer relevant in the new system
}

export function PlayerHand({ cards, onCardSelect, isPlayerTurn, isOpponent = false, canPlayMonster = true }: PlayerHandProps) {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex flex-col items-center space-y-1 md:space-y-2 p-1 md:p-2 transition-all duration-500 ease-in-out w-full overflow-y-auto max-h-[calc(100vh-200px)] flex-shrink-0",
      "min-h-[200px] md:min-h-[300px]", 
    )}>
      {cards.map((card) => {
        // Determine if the card is playable based on turn and type
        let cardIsActuallyPlayable = false;
        if (isPlayerTurn) {
          if (card.cardType === 'Monster' && canPlayMonster) {
            cardIsActuallyPlayable = true;
          } else if (card.cardType === 'Spell') {
            cardIsActuallyPlayable = true;
          }
        }

        return (
          <div key={card.id} className="transition-opacity duration-300">
            <CardView 
              card={card}
              onClick={() => cardIsActuallyPlayable && onCardSelect(card)}
              isPlayable={cardIsActuallyPlayable} 
              isOpponentCard={isOpponent}
              // isPlayerTurnForThisCard is mainly for opponent's hand visual cue, might be less relevant now
              isPlayerTurnForThisCard={isPlayerTurn && isOpponent} 
            />
          </div>
        );
      })}
      {cards.length === 0 && isPlayerTurn && (
        <p className="text-muted-foreground text-center">No cards in hand.</p>
      )}
       {cards.length === 0 && !isPlayerTurn && (
        <p className="text-muted-foreground text-center text-xs italic h-full flex items-center">Waiting for cards...</p>
      )}
    </div>
  );
}
