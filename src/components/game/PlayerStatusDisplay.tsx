'use client';

import type { PlayerData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';
import { DamageIndicator } from './DamageIndicator';
import { HealingIndicator } from './HealingIndicator';

interface PlayerStatusDisplayProps {
  player: PlayerData;
  isCurrentPlayer: boolean;
  isOpponent?: boolean;
  damage: number | null;
  healing: number | null;
}

export function PlayerStatusDisplay({ player, isCurrentPlayer, isOpponent = false, damage, healing }: PlayerStatusDisplayProps) {
  const MAX_HP = 30; // Initial HP

  return (
      <Card 
        className={cn(
          "w-full md:w-72 shadow-lg transition-all duration-300 relative bg-cover bg-center",
          isCurrentPlayer ? "bg-primary/10 border-accent ring-2 ring-accent" : "bg-card/60 border-transparent",
        )}
        style={{ backgroundImage: `url(${player.avatarUrl})` }}
      >
         <div className="absolute inset-0 bg-black/50" />
         <DamageIndicator damage={damage} />
         <HealingIndicator healing={healing} />
        <CardHeader className="pb-2 pt-4 px-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <CardTitle className={cn(
                    "text-xl text-white",
                    isOpponent && "text-right"
                )}>
                    {player.name}
                </CardTitle>
            </div>
            <div className="flex items-center text-lg font-bold text-white">
              <Heart className="mr-1.5 h-5 w-5 text-red-500" />
              <span>{player.hp}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 relative">
          <Progress value={(player.hp / MAX_HP) * 100} className="h-2 w-full" />
           <div className="text-xs text-muted-foreground mt-1 text-white/80">
                Deck: {player.deck.length} | Discard: {player.discardPile.length}
            </div>
        </CardContent>
      </Card>
  );
}
