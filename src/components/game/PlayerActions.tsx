
'use client';

import type { PlayerData, MonsterCardData } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, RotateCcw, ShieldPlus, WandSparkles, Replace } from 'lucide-react'; // Added Replace icon

interface PlayerActionsProps {
  currentPlayer: PlayerData;
  activeMonster?: MonsterCardData; 
  onAttack: () => void;
  onInitiateSwap: () => void; // Changed from onRetreat
  canPlayMonsterFromHand: boolean;
  canPlaySpellFromHand: boolean;
  playerHandFull: boolean;
}

export function PlayerActions({
  currentPlayer,
  activeMonster,
  onAttack,
  onInitiateSwap, // Changed from onRetreat
  canPlayMonsterFromHand,
  canPlaySpellFromHand,
  playerHandFull,
}: PlayerActionsProps) {

  const canAttack = !!activeMonster;
  // Can swap if: active monster exists, hand is not full (to receive active monster), and has another monster in hand to swap to.
  const hasMonsterInHandToSwapTo = currentPlayer.hand.some(card => card.cardType === 'Monster' && card.id !== activeMonster?.id);
  const canSwap = !!activeMonster && !playerHandFull && hasMonsterInHandToSwapTo;

  return (
    <div className="flex flex-col items-center space-y-2 p-2 md:p-4 my-2 md:my-3 bg-card/50 rounded-lg shadow-md border border-border">
      <h3 className="text-sm md:text-base font-semibold text-center mb-2 text-foreground">
        {currentPlayer.name}'s Actions
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {canAttack && (
          <Button onClick={onAttack} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" aria-label="Attack with active monster">
            <Swords className="mr-2 h-4 w-4" /> Attack
          </Button>
        )}
        {canSwap && (
          <Button onClick={onInitiateSwap} variant="outline" aria-label="Swap active monster">
            <Replace className="mr-2 h-4 w-4" /> Swap Monster
          </Button>
        )}
        {!!activeMonster && !playerHandFull && !hasMonsterInHandToSwapTo && (
             <Button variant="outline" aria-label="Cannot swap, no other monster in hand" disabled>
                <Replace className="mr-2 h-4 w-4" /> Swap (No Monster)
            </Button>
        )}
         {!!activeMonster && playerHandFull && ( // Show disabled swap if hand is full, regardless of other monsters
             <Button variant="outline" aria-label="Cannot swap, hand full" disabled>
                <Replace className="mr-2 h-4 w-4" /> Swap (Hand Full)
            </Button>
        )}
      </div>
      
      {!activeMonster && !canPlayMonsterFromHand && !canPlaySpellFromHand && (
         <p className="text-xs text-muted-foreground italic mt-2 text-center">
            No actions available. Waiting for cards or opponent.
        </p>
      )}

      {(!activeMonster && canPlayMonsterFromHand) && (
        <p className="text-xs text-muted-foreground italic mt-2 text-center">
          Click a <ShieldPlus className="inline h-3 w-3" /> Monster card from your hand to summon.
        </p>
      )}
      {canPlaySpellFromHand && (
         <p className="text-xs text-muted-foreground italic mt-1 text-center">
          Click a <WandSparkles className="inline h-3 w-3" /> Spell card from your hand to cast.
        </p>
      )}
       {activeMonster && !canPlayMonsterFromHand && !canPlaySpellFromHand && !canAttack && !canSwap && (
         <p className="text-xs text-muted-foreground italic mt-2 text-center">
            No further actions with current hand or active monster. Consider ending turn.
        </p>
      )}
    </div>
  );
}
