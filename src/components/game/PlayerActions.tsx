
'use client';

import type { PlayerData, MonsterCardData } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, RotateCcw, ShieldPlus, WandSparkles } from 'lucide-react'; // Added ShieldPlus, WandSparkles

interface PlayerActionsProps {
  currentPlayer: PlayerData;
  activeMonster?: MonsterCardData; 
  onAttack: () => void;
  onRetreat: () => void;
  canPlayMonsterFromHand: boolean; // New: if player has a monster card and arena slot is free
  canPlaySpellFromHand: boolean;   // New: if player has a spell card
  playerHandFull: boolean; // New: To disable retreat if hand is full
}

export function PlayerActions({
  currentPlayer,
  activeMonster,
  onAttack,
  onRetreat,
  canPlayMonsterFromHand,
  canPlaySpellFromHand,
  playerHandFull,
}: PlayerActionsProps) {

  const canAttack = !!activeMonster;
  const canRetreat = !!activeMonster && !playerHandFull; // Can only retreat if hand is not full
  const monsterSlotAvailable = !activeMonster;

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
        {canRetreat && (
          <Button onClick={onRetreat} variant="outline" aria-label="Retreat active monster">
            <RotateCcw className="mr-2 h-4 w-4" /> Retreat
          </Button>
        )}
        {!canRetreat && !!activeMonster && playerHandFull && (
             <Button variant="outline" aria-label="Cannot retreat, hand full" disabled>
                <RotateCcw className="mr-2 h-4 w-4" /> Retreat (Hand Full)
            </Button>
        )}
      </div>
      
      {!activeMonster && !canPlayMonsterFromHand && !canPlaySpellFromHand && (
         <p className="text-xs text-muted-foreground italic mt-2 text-center">
            No actions available. Waiting for cards or opponent.
        </p>
      )}

      {(monsterSlotAvailable && canPlayMonsterFromHand) && (
        <p className="text-xs text-muted-foreground italic mt-2 text-center">
          Click a <ShieldPlus className="inline h-3 w-3" /> Monster card from your hand to summon.
        </p>
      )}
      {canPlaySpellFromHand && (
         <p className="text-xs text-muted-foreground italic mt-1 text-center">
          Click a <WandSparkles className="inline h-3 w-3" /> Spell card from your hand to cast.
        </p>
      )}
       {activeMonster && !canPlayMonsterFromHand && !canPlaySpellFromHand && !canAttack && (
         <p className="text-xs text-muted-foreground italic mt-2 text-center">
            No further actions with current hand. Consider ending turn.
        </p>
      )}


    </div>
  );
}
