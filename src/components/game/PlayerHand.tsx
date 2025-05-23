
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

  // Estimate card width for min-w calculation (w-40 is 10rem, w-48 is 12rem)
  // Let's use a slightly larger value for padding/margins.
  const cardNominalWidth = "w-40 md:w-48"; // Keep this consistent with CardView's baseCardSize
  const committedCardTranslation = isOpponent ? "md:translate-x-10" : "md:-translate-x-10";

  return (
    <div className={cn(
      "flex flex-col items-center space-y-1 md:space-y-2 p-1 md:p-2 transition-all duration-500 ease-in-out w-full overflow-y-auto max-h-[calc(100vh-200px)]", // Allow vertical scroll if many cards
      // When a card is committed, the hand recedes horizontally
      hasCommittedCard 
        ? `opacity-60 transform-gpu ${committedCardTranslation} scale-90` 
        : "",
      // Ensure the hand still has some presence even when receded, but mostly determined by card content
      "min-h-[200px]" // A fallback min-height, actual height driven by cards
    )}>
      {cards.map((card) => (
        <div key={card.id} className={cn(
          // No y-scaling needed for side hands
          "transition-opacity duration-300",
          hasCommittedCard && card.id !== selectedCardId ? "opacity-60" : "opacity-100"
        )}>
          <CardView 
            card={card}
            onClick={() => onCardSelect(card)}
            isSelected={selectedCardId === card.id}
            isPlayable={isPlayerTurn && !hasCommittedCard} 
            isOpponentCard={isOpponent} // This prop is still useful for CardView's internal styling/behavior
          />
        </div>
      ))}
      {cards.length === 0 && isPlayerTurn && !hasCommittedCard && (
        <p className="text-muted-foreground text-center">No cards in hand.</p>
      )}
    </div>
  );
}
