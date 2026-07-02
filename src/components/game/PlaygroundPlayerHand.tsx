'use client';

import type { CardData } from '@/types';
import { CardView } from './CardView';
import { cn } from '@/lib/utils';

interface PlaygroundPlayerHandProps {
  cards: CardData[];
  onCardSelect: (card: CardData) => void;
  isPlayerTurn: boolean;
}

export function PlaygroundPlayerHand({ 
  cards, 
  onCardSelect, 
  isPlayerTurn, 
}: PlaygroundPlayerHandProps) {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex flex-col items-center space-y-1 md:space-y-2 p-1 md:p-2 transition-all duration-500 ease-in-out w-full",
      "min-h-[200px] md:min-h-[300px]", 
      isPlayerTurn ? "bg-primary/5" : ""
    )}>
      {cards.map((card) => {
        const isPlayable = true; // Always playable in the playground

        return (
          <div key={card.id} className={cn(
            "transition-all duration-300",
            isPlayable ? "cursor-pointer" : "cursor-not-allowed"
          )}>
            <CardView 
              card={card}
              onClick={() => isPlayable && onCardSelect(card)}
              isPlayable={isPlayable} 
              showDescriptionTooltip={true}
              isDimmed={!isPlayable}
            />
          </div>
        );
      })}
      {cards.length === 0 && (
        <p className="text-muted-foreground text-center text-xs italic h-full flex items-center p-4">
          Hand is empty.
        </p>
      )}
    </div>
  );
}
