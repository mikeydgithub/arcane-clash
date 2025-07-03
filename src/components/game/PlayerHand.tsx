
'use client';

import type { CardData, MonsterCardData, GamePhase } from '@/types'; 
import { CardView } from './CardView';
import { cn } from '@/lib/utils';

const SPELLS_PER_TURN_LIMIT = 1; // Consistent with GameBoard

interface PlayerHandProps {
  cards: CardData[];
  onCardSelect: (card: CardData) => void; 
  isPlayerTurn: boolean;
  isOpponent?: boolean;
  canPlayMonster?: boolean; 
  currentPhase: GamePhase; 
  spellsPlayedThisTurn: number;
  currentPlayerTurnCount: number; // Added to check first turn rule
  isMulliganPhase?: boolean;
  selectedCardIds?: string[];
}

export function PlayerHand({ 
  cards, 
  onCardSelect, 
  isPlayerTurn, 
  isOpponent = false, 
  canPlayMonster = true,
  currentPhase,
  spellsPlayedThisTurn,
  currentPlayerTurnCount,
  isMulliganPhase = false,
  selectedCardIds = [],
}: PlayerHandProps) {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex flex-col items-center space-y-1 md:space-y-2 p-1 md:p-2 transition-all duration-500 ease-in-out w-full",
      "min-h-[200px] md:min-h-[300px]", 
      isPlayerTurn ? "bg-primary/5" : "" 
    )}>
      {(currentPhase === 'selecting_swap_monster_phase' || isMulliganPhase) && isPlayerTurn && (
        <p className="text-center text-sm text-accent p-2 bg-accent/10 rounded-md my-1">
          {isMulliganPhase 
            ? `Select cards to mulligan (${selectedCardIds.length}/3)`
            : "Select a Monster from your hand to swap in."
          }
        </p>
      )}
      {cards.map((card) => {
        let cardIsActuallyPlayable = false;
        if (isPlayerTurn) {
          if (isMulliganPhase) {
            cardIsActuallyPlayable = true; // All cards are selectable
          } else if (currentPhase === 'selecting_swap_monster_phase') {
            if (card.cardType === 'Monster') {
              cardIsActuallyPlayable = true; // Only monsters are selectable for swap
            }
          } else if (currentPhase === 'player_action_phase') { // Standard player_action_phase
            if (card.cardType === 'Monster' && canPlayMonster) {
              cardIsActuallyPlayable = true;
            } else if (card.cardType === 'Spell') {
              cardIsActuallyPlayable = currentPlayerTurnCount > 0 &&
                                     (spellsPlayedThisTurn === undefined || spellsPlayedThisTurn < SPELLS_PER_TURN_LIMIT);
            }
          }
        }

        const isSelectedForMulligan = isMulliganPhase && selectedCardIds.includes(card.id);

        return (
          <div key={card.id} className={cn(
            "transition-opacity duration-300",
            cardIsActuallyPlayable ? "cursor-pointer" : "cursor-not-allowed opacity-80"
          )}>
            <CardView 
              card={card}
              onClick={() => cardIsActuallyPlayable && onCardSelect(card)}
              isPlayable={cardIsActuallyPlayable} 
              isSelected={isSelectedForMulligan}
              isOpponentCard={isOpponent}
              isPlayerTurnForThisCard={isPlayerTurn && isOpponent} 
              showDescriptionTooltip={true}
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
