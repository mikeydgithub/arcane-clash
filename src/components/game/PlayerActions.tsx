
'use client';

import type { PlayerData, MonsterCardData } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, ShieldDash, Zap, RotateCcw } from 'lucide-react';

interface PlayerActionsProps {
  currentPlayer: PlayerData;
  activeMonster?: MonsterCardData; // Current player's monster in the arena
  onAttack: () => void;
  onRetreat: () => void;
  // Play Monster/Spell actions are now implicitly handled by clicking cards in PlayerHand
  // onPlayMonster: () => void; // If we want a dedicated button later
  // onPlaySpell: () => void;   // If we want a dedicated button later
}

export function PlayerActions({
  currentPlayer,
  activeMonster,
  onAttack,
  onRetreat,
}: PlayerActionsProps) {

  const canAttack = !!activeMonster;
  const canRetreat = !!activeMonster;
  // canPlayMonster would be true if !activeMonster and hand contains a monster
  // canPlaySpell would be true if hand contains a spell

  return (
    <div className="flex flex-col items-center space-y-2 p-2 md:p-4 my-2 md:my-3">
      <h3 className="text-sm md:text-base font-semibold text-center mb-2">
        {currentPlayer.name}'s Actions
      </h3>
      <div className="flex space-x-2">
        {canAttack && (
          <Button onClick={onAttack} className="bg-destructive hover:bg-destructive/90" aria-label="Attack with active monster">
            <Swords className="mr-2 h-4 w-4" /> Attack
          </Button>
        )}
        {canRetreat && (
          <Button onClick={onRetreat} variant="outline" aria-label="Retreat active monster">
            <RotateCcw className="mr-2 h-4 w-4" /> Retreat
          </Button>
        )}
        {/* 
          Future dedicated buttons, if needed:
          {!activeMonster && (
            <Button onClick={onPlayMonster} variant="secondary"> Play Monster </Button>
          )}
          <Button onClick={onPlaySpell} variant="secondary"> <Zap className="mr-2 h-4 w-4" /> Play Spell </Button>
        */}
      </div>
       {!activeMonster && (
        <p className="text-xs text-muted-foreground italic mt-2 text-center">
          Select a Monster card from your hand to summon, or a Spell card to cast.
        </p>
      )}
    </div>
  );
}
