
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
}

export function CardView({ card, onClick, isSelected, isPlayable, isOpponentCard = false, inBattleArena = false }: CardViewProps) {
  // Reduced card sizes for inBattleArena state
  const baseCardSize = inBattleArena ? "w-52 h-72 md:w-60 md:h-80" : "w-40 h-56 md:w-48 md:h-64";
  // Allow hover effect for opponent cards if they are playable (i.e. it's their turn and user is controlling them)
  const cardHoverEffect = isPlayable && !inBattleArena ? "hover:scale-105 hover:shadow-accent transition-transform duration-200 cursor-pointer" : "";

  return (
    <Card 
      className={cn(
        "flex flex-col overflow-hidden shadow-xl",
        baseCardSize,
        cardHoverEffect,
        // Allow selection ring for opponent cards if selected
        isSelected ? "ring-2 ring-accent shadow-accent" : "",
        isOpponentCard && !inBattleArena && !isSelected ? "opacity-70" : "", // Dim opponent card if not selected and in hand
        inBattleArena ? "animate-fadeIn" : ""
      )}
      // Allow click for opponent cards if they are playable
      onClick={isPlayable ? onClick : undefined}
      aria-label={`Card: ${card.title}`}
      // Adjust role and tabIndex based on playability
      role={isPlayable ? "button" : "img"}
      tabIndex={isPlayable ? 0 : -1}
    >
      <CardHeader className={cn("p-2 text-center", inBattleArena ? "pb-1" : "pb-1")}>
        <CardTitle className={cn("truncate", inBattleArena ? "text-base md:text-lg" : "text-sm")}>{card.title}</CardTitle> {/* Adjusted title size for smaller arena cards */}
      </CardHeader>
      
      <div className={cn("relative w-full bg-muted/50", inBattleArena ? "h-36 md:h-40" : "h-24 md:h-32")}> {/* Adjusted image height for smaller arena cards */}
        {card.isLoadingArt ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : card.artUrl ? (
          <Image 
            src={card.artUrl} 
            alt={`Art for ${card.title}`} 
            layout="fill" 
            objectFit="cover" 
            data-ai-hint="fantasy creature"
            className="rounded-t-sm"
          />
        ) : (
          <Image 
            src={`https://placehold.co/300x400.png?text=${encodeURIComponent(card.title)}`} 
            alt={`Placeholder for ${card.title}`} 
            layout="fill" 
            objectFit="cover"
            data-ai-hint="fantasy abstract"
            className="rounded-t-sm"
          />
        )}
      </div>

      <CardContent className={cn("flex-grow p-2 space-y-1", inBattleArena ? "space-y-1 text-sm md:text-base" : "text-xs")}> {/* Adjusted spacing and text size for smaller arena cards */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <StatDisplay icon={<Sparkles className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />} value={card.magic} label="Magic" />
          <StatDisplay icon={<Swords className="w-3 h-3 md:w-4 md:h-4 text-red-400" />} value={card.melee} label="Melee" />
          <StatDisplay icon={<ShieldHalf className="w-3 h-3 md:w-4 md:h-4 text-green-400" />} value={card.defense} label="Defense" />
          <StatDisplay icon={<Heart className="w-3 h-3 md:w-4 md:h-4 text-pink-400" />} value={`${card.hp}/${card.maxHp}`} label="HP" />
        </div>
         { card.maxShield > 0 && <StatDisplay icon={<ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-yellow-400" />} value={`${card.shield}/${card.maxShield}`} label="Shield" /> }
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
