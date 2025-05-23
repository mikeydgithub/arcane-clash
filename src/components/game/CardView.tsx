
'use client';

import Image from 'next/image';
import type { CardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, ShieldHalf, Heart, ShieldCheck } from 'lucide-react';

interface CardViewProps {
  card: CardData;
  onClick?: () => void;
  isSelected?: boolean;
  isPlayable?: boolean;
  isOpponentCard?: boolean;
  inBattleArena?: boolean;
  isPlayerTurnForThisCard?: boolean;
}

export function CardView({ 
  card, 
  onClick, 
  isSelected, 
  isPlayable, 
  isOpponentCard = false, 
  inBattleArena = false,
  isPlayerTurnForThisCard = false 
}: CardViewProps) {
  const baseCardSize = inBattleArena ? "w-36 h-52 md:w-40 md:h-56" : "w-40 h-56 md:w-48 md:h-64";
  const cardHoverEffect = isPlayable && !inBattleArena ? "hover:scale-105 hover:shadow-accent transition-transform duration-200 cursor-pointer" : "";

  return (
    <Card 
      className={cn(
        "flex flex-col overflow-hidden shadow-xl",
        baseCardSize,
        cardHoverEffect,
        isSelected ? "ring-2 ring-accent shadow-accent" : "",
        isOpponentCard && !inBattleArena && !isSelected && !isPlayerTurnForThisCard ? "opacity-70" : "",
        inBattleArena ? "animate-fadeIn" : ""
      )}
      onClick={isPlayable ? onClick : undefined}
      aria-label={`Card: ${card.title}`}
      role={isPlayable ? "button" : "img"}
      tabIndex={isPlayable ? 0 : -1}
    >
      <CardHeader className={cn("p-2 text-center", inBattleArena ? "pb-0.5 pt-1 text-xs md:text-sm" : "pb-1")}>
        <CardTitle className={cn("truncate", inBattleArena ? "text-xs md:text-sm" : "text-sm")}>{card.title}</CardTitle>
      </CardHeader>
      
      <div className={cn("relative w-full bg-muted/50", inBattleArena ? "h-24 md:h-28" : "h-24 md:h-32")}>
        {card.isLoadingArt ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : card.artUrl ? (
          <Image 
            src={card.artUrl} 
            alt={`Art for ${card.title}`} 
            layout="fill" 
            objectFit="contain" 
            data-ai-hint="fantasy creature"
            className="rounded-t-sm"
          />
        ) : (
          <Image 
            src={`https://placehold.co/300x400.png`} 
            alt={`Placeholder for ${card.title}`} 
            layout="fill" 
            objectFit="contain"
            data-ai-hint="fantasy abstract"
            className="rounded-t-sm"
          />
        )}
      </div>

      <CardContent className={cn("flex-grow p-2 space-y-1", inBattleArena ? "space-y-0.5 text-xs" : "text-xs")}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <StatDisplay icon={<Sparkles className="w-3 h-3 text-blue-400" />} value={card.magic} label="Magic" />
          <StatDisplay icon={<Swords className="w-3 h-3 text-red-400" />} value={card.melee} label="Melee" />
          <StatDisplay icon={<ShieldHalf className="w-3 h-3 text-green-400" />} value={card.defense} label="Defense" />
          <StatDisplay icon={<Heart className="w-3 h-3 text-pink-400" />} value={`${card.hp}/${card.maxHp}`} label="HP" />
        </div>
         { card.maxShield > 0 && <StatDisplay icon={<ShieldCheck className="w-3 h-3 text-yellow-400" />} value={`${card.shield}/${card.maxShield}`} label="Shield" /> }
      </CardContent>
      
      {card.description && !inBattleArena && (
        <CardFooter className="p-2 mt-auto">
          <p className="text-xs text-muted-foreground italic truncate">{card.description}</p>
        </CardFooter>
      )}
    </Card>
  );
}

interface StatDisplayProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}

function StatDisplay({ icon, value, label }: StatDisplayProps) {
  return (
    <div className="flex items-center space-x-1" aria-label={`${label}: ${value}`}>
      {icon}
      <span className="font-semibold">{value}</span>
    </div>
  );
}
