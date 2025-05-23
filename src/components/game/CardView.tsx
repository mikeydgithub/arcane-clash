
'use client';

import Image from 'next/image';
import type { CardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, ShieldHalf, Heart, ShieldCheck } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import React, { useEffect, useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CardViewProps {
  card: CardData;
  onClick?: () => void;
  isSelected?: boolean;
  isPlayable?: boolean;
  isOpponentCard?: boolean;
  inBattleArena?: boolean;
  isPlayerTurnForThisCard?: boolean;
}

interface AnimatedNumberProps {
  value: number;
}

function AnimatedNumber({ value: targetValue }: AnimatedNumberProps) {
  const numberMotionValue = useMotionValue(targetValue);
  const prevTargetValueRef = useRef(targetValue);

  useEffect(() => {
    const previousValue = prevTargetValueRef.current;
    // Set the motion value to the previous prop value before starting animation
    numberMotionValue.set(previousValue);

    const controls = animate(numberMotionValue, targetValue, {
      duration: Math.max(0.2, Math.abs(targetValue - previousValue) * 0.15), // 150ms per unit change, min 200ms
      type: "tween",
      ease: "linear", 
    });
    
    prevTargetValueRef.current = targetValue; // Update ref for the next change

    return () => controls.stop();
  }, [targetValue, numberMotionValue]);

  const displayTransformed = useTransform(numberMotionValue, v => Math.round(v));
  return <motion.span>{displayTransformed}</motion.span>;
}


interface StatDisplayProps {
  icon: React.ReactNode;
  currentValue: number;
  maxValue?: number;
  label: string;
  isSingleValue?: boolean;
  animate?: boolean; 
}

function StatDisplay({ icon, currentValue, maxValue, label, isSingleValue = false, animate = false }: StatDisplayProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center space-x-1 cursor-default" aria-label={`${label}: ${currentValue}${!isSingleValue && maxValue !== undefined ? `/${maxValue}` : ''}`}>
          {icon}
          <span className="font-semibold">
            {animate ? <AnimatedNumber value={currentValue} /> : currentValue}
            {!isSingleValue && maxValue !== undefined && `/${maxValue}`}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
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
  // Adjusted sizes: smaller in arena
  const baseCardSize = inBattleArena ? "w-32 h-48 md:w-36 md:h-52" : "w-40 h-56 md:w-48 md:h-64";
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
      <CardHeader className={cn("p-2 text-center", inBattleArena ? "pb-0.5 pt-1 text-[10px] md:text-xs" : "pb-1")}>
        <CardTitle className={cn("truncate", inBattleArena ? "text-[10px] md:text-xs" : "text-sm")}>{card.title}</CardTitle>
      </CardHeader>
      
      <div className={cn("relative w-full bg-muted/50", inBattleArena ? "h-16 md:h-20" : "h-24 md:h-32")}>
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
      <TooltipProvider delayDuration={300}>
        <CardContent className={cn("flex-grow p-2 space-y-1", inBattleArena ? "space-y-0.5 text-[9px] md:text-[10px]" : "text-xs")}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <StatDisplay icon={<Sparkles className="w-3 h-3 text-blue-400" />} currentValue={card.magic} label="Magic" isSingleValue={true} animate={inBattleArena} />
            <StatDisplay icon={<Swords className="w-3 h-3 text-red-400" />} currentValue={card.melee} label="Melee" isSingleValue={true} animate={inBattleArena} />
            <StatDisplay icon={<ShieldHalf className="w-3 h-3 text-green-400" />} currentValue={card.defense} label="Defense" isSingleValue={true} animate={inBattleArena} />
            <StatDisplay icon={<Heart className="w-3 h-3 text-pink-400" />} currentValue={card.hp} maxValue={card.maxHp} label="HP" animate={inBattleArena} />
          </div>
          { card.maxShield > 0 && <StatDisplay icon={<ShieldCheck className="w-3 h-3 text-yellow-400" />} currentValue={card.shield} maxValue={card.maxShield} label="Shield" animate={inBattleArena} /> }
        </CardContent>
      </TooltipProvider>
      
      {card.description && !inBattleArena && (
        <CardFooter className="p-2 mt-auto">
          <p className="text-xs text-muted-foreground italic truncate">{card.description}</p>
        </CardFooter>
      )}
    </Card>
  );
}

    