
'use client';

import type { PlayerData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { Heart, ShieldCheck } from 'lucide-react';

interface PlayerStatusDisplayProps {
  player: PlayerData;
  isCurrentPlayer: boolean;
  isOpponent?: boolean;
}

export function PlayerStatusDisplay({ player, isCurrentPlayer, isOpponent = false }: PlayerStatusDisplayProps) {
  const MAX_HP = 100; // Initial HP

  return (
    <Card className={cn(
      "w-full md:w-72 shadow-lg transition-all duration-300",
      isCurrentPlayer ? "border-accent ring-2 ring-accent" : "border-transparent",
      isOpponent ? "bg-card/70" : "bg-card"
    )}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={player.avatarUrl || `https://placehold.co/64x64.png?text=${player.name.substring(0,1)}`} 
                alt={player.name} 
                data-ai-hint="player avatar" 
              />
              <AvatarFallback>{player.name.substring(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle className={cn(
              "text-xl",
              isCurrentPlayer ? "text-accent-foreground" : "", // This applies to the text color of the name based on current player
              isOpponent && !isCurrentPlayer ? "text-muted-foreground" : "" // Muted if opponent and not current turn
            )}>
              {player.name}
            </CardTitle>
          </div>
          {isCurrentPlayer && <ShieldCheck className="w-6 h-6 text-accent animate-pulse" />}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-center space-x-2 mb-2">
          <Heart className="w-5 h-5 text-red-500" />
          <span className="font-semibold text-lg">{player.hp} / {MAX_HP}</span>
        </div>
        <Progress value={(player.hp / MAX_HP) * 100} className="h-3 bg-destructive/30 [&>div]:bg-red-500" aria-label={`${player.name} HP`} />
      </CardContent>
    </Card>
  );
}
