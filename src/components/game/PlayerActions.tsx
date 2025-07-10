
'use client';

import type { PlayerData, MonsterCardData, GamePhase } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, Replace, WandSparkles, LogOut, ShieldPlus, RefreshCw, X, Check } from 'lucide-react'; 

const MULLIGAN_CARD_COUNT = 3;

interface PlayerActionsProps {
  currentPlayer: PlayerData;
  activeMonster?: MonsterCardData;
  opponentActiveMonster?: MonsterCardData;
  onAttack: () => void;
  onInitiateSwap: () => void;
  onEndTurn: () => void;
  canPlayMonsterFromHand: boolean;
  canPlaySpellFromHand: boolean; 
  playerHandFull: boolean;
  spellsPlayedThisTurn: number;
  maxSpellsPerTurn: number;
  isFirstTurn: boolean; // First turn of the game overall
  isEffectivelyFirstTurn: boolean; // Is it this player's turn 0?
  gamePhase: GamePhase;
  onInitiateMulligan: () => void;
  onConfirmMulligan: () => void;
  onCancelMulligan: () => void;
  mulliganCardCount: number;
}

export function PlayerActions({
  currentPlayer,
  activeMonster,
  opponentActiveMonster,
  onAttack,
  onInitiateSwap,
  onEndTurn,
  canPlayMonsterFromHand,
  canPlaySpellFromHand, 
  playerHandFull,
  spellsPlayedThisTurn,
  maxSpellsPerTurn,
  isFirstTurn,
  isEffectivelyFirstTurn,
  gamePhase,
  onInitiateMulligan,
  onConfirmMulligan,
  onCancelMulligan,
  mulliganCardCount
}: PlayerActionsProps) {

  const canAttack = !!activeMonster;
  const hasMonsterInHandToSwapTo = currentPlayer.hand.some(card => card.cardType === 'Monster' && card.id !== activeMonster?.id);
  const canSwap = !!activeMonster && hasMonsterInHandToSwapTo;
  const canStillPlaySpellThisTurn = spellsPlayedThisTurn < maxSpellsPerTurn;

  const canMulligan = currentPlayer.turnCount === 0 && !currentPlayer.hasMulliganed;
  
  if (gamePhase === 'mulligan_phase') {
    return (
      <div className="flex flex-col items-center space-y-2 p-2 md:p-4 my-2 md:my-3 bg-card/50 rounded-lg shadow-md border border-border">
        <h3 className="text-sm md:text-base font-semibold text-center mb-2 text-foreground">
          Mulligan Phase
        </h3>
        <p className="text-xs text-muted-foreground italic text-center">
            Select {MULLIGAN_CARD_COUNT} cards from your hand to shuffle back into your deck.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
            <Button onClick={onConfirmMulligan} className="bg-primary hover:bg-primary/90" disabled={mulliganCardCount !== MULLIGAN_CARD_COUNT}>
                <Check className="mr-2 h-4 w-4" /> Confirm ({mulliganCardCount}/{MULLIGAN_CARD_COUNT})
            </Button>
            <Button onClick={onCancelMulligan} variant="outline">
                <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center space-y-2 p-2 md:p-4 my-2 md:my-3 bg-card/50 rounded-lg shadow-md border border-border">
      <h3 className="text-sm md:text-base font-semibold text-center mb-2 text-foreground">
        {currentPlayer.name}'s Actions
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {canAttack && (
          <Button
            onClick={onAttack}
            disabled={isEffectivelyFirstTurn}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            aria-label="Attack with active monster"
            title={isEffectivelyFirstTurn ? "The first player cannot attack on their first turn." : "Attack with active monster"}
          >
            <Swords className="mr-2 h-4 w-4" /> Attack
          </Button>
        )}
        {canSwap && (
          <Button
            onClick={onInitiateSwap}
            disabled={isEffectivelyFirstTurn}
            variant="outline"
            aria-label="Swap active monster"
            title={isEffectivelyFirstTurn ? "The first player cannot swap on their first turn." : "Swap active monster"}
          >
            <Replace className="mr-2 h-4 w-4" /> Swap Monster
          </Button>
        )}
        {!!activeMonster && !hasMonsterInHandToSwapTo && (
             <Button variant="outline" aria-label="Cannot swap, no other monster in hand" disabled>
                <Replace className="mr-2 h-4 w-4" /> Swap (No Monster)
            </Button>
        )}
        {canMulligan && (
            <Button onClick={onInitiateMulligan} variant="secondary" aria-label="Mulligan your hand">
                <RefreshCw className="mr-2 h-4 w-4" /> Mulligan Hand
            </Button>
        )}
        <Button onClick={onEndTurn} variant="outline" aria-label="End your turn">
            <LogOut className="mr-2 h-4 w-4" /> End Turn
        </Button>
      </div>

      {(!activeMonster && !canPlayMonsterFromHand && (isFirstTurn || !canPlaySpellFromHand || !canStillPlaySpellThisTurn)) && (
         <p className="text-xs text-muted-foreground italic mt-2 text-center">
            No direct actions available. Consider ending turn.
        </p>
      )}

      {(!activeMonster && canPlayMonsterFromHand) && (
        <p className="text-xs text-muted-foreground italic mt-2 text-center">
          Click a <ShieldPlus className="inline h-3 w-3" /> Monster card from your hand to summon.
        </p>
      )}
      
      {isEffectivelyFirstTurn && (
         <p className="text-xs text-muted-foreground italic mt-1 text-center">
          Spells, attacks, and swaps are disabled on the first turn of the game.
        </p>
      )}
      {!isEffectivelyFirstTurn && canPlaySpellFromHand && canStillPlaySpellThisTurn && (
         <p className="text-xs text-muted-foreground italic mt-1 text-center">
          Click a <WandSparkles className="inline h-3 w-3" /> Spell card to cast. ({maxSpellsPerTurn - spellsPlayedThisTurn} remaining this turn)
        </p>
      )}
      {!isEffectivelyFirstTurn && canPlaySpellFromHand && !canStillPlaySpellThisTurn && (
         <p className="text-xs text-muted-foreground italic mt-1 text-center">
          No more spells can be played this turn. ({spellsPlayedThisTurn}/{maxSpellsPerTurn} played)
        </p>
      )}

       {activeMonster && !canPlayMonsterFromHand && (isFirstTurn || !canPlaySpellFromHand || !canStillPlaySpellThisTurn) && !canAttack && !canSwap && (
         <p className="text-xs text-muted-foreground italic mt-2 text-center">
            No further actions with current hand or active monster. End turn or summon if possible.
        </p>
      )}
      {canSwap && playerHandFull && (
        <p className="text-xs text-muted-foreground italic mt-1 text-center">
          Note: Swapping with a full hand will discard the active monster.
        </p>
      )}
    </div>
  );
}
