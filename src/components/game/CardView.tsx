
'use client';

import Image from 'next/image';
import type { CardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, ShieldHalf, Heart, ShieldCheck, ShieldAlert } from 'lucide-react';
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
    numberMotionValue.set(previousValue);

    // Ensure targetValue is a number for calculation
    const numericTargetValue = Number(targetValue);
    const numericPreviousValue = Number(previousValue);

    if (isNaN(numericTargetValue) || isNaN(numericPreviousValue)) {
        // Fallback if values are not numeric, set directly
        numberMotionValue.set(isNaN(numericTargetValue) ? 0 : numericTargetValue); 
        prevTargetValueRef.current = isNaN(numericTargetValue) ? 0 : numericTargetValue;
        return;
    }
    
    const diff = Math.abs(numericTargetValue - numericPreviousValue);
    let animationDuration = Math.max(0.2, diff * 0.15); 
    animationDuration = Math.min(animationDuration, 2); 


    const controls = animate(numberMotionValue, numericTargetValue, {
      duration: animationDuration,
      type: "tween", 
      ease: "linear",
    });

    prevTargetValueRef.current = numericTargetValue; 

    return () => controls.stop();
  }, [targetValue, numberMotionValue]);

  const displayTransformed = useTransform(numberMotionValue, v => Math.round(Number(v))); // Ensure v is treated as number
  return <motion.span>{displayTransformed}</motion.span>;
}


interface StatDisplayProps {
  icon: React.ReactNode;
  currentValue: number;
  maxValue?: number;
  label: string;
  isSingleValue?: boolean;
  animateStats?: boolean;
}

function StatDisplay({ icon, currentValue, maxValue, label, isSingleValue = false, animateStats = false }: StatDisplayProps) {
  const displayCurrentValueNode = animateStats ? <AnimatedNumber value={currentValue} /> : Math.round(currentValue);
  const ariaCurrentValue = Math.round(currentValue);
  const ariaMaxValuePart = !isSingleValue && maxValue !== undefined ? `/${Math.round(maxValue)}` : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center space-x-1 cursor-default"
          aria-label={`${label}: ${ariaCurrentValue}${ariaMaxValuePart}`}
        >
          {icon}
          <span className="font-semibold">
            {displayCurrentValueNode}
            {!isSingleValue && maxValue !== undefined ? ` / ${Math.round(maxValue)}` : null}
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
  const cardSizeClass = "w-40 h-56 md:w-48 md:h-64";
  const cardHoverEffect = isPlayable && !inBattleArena ? "hover:scale-105 hover:shadow-accent transition-transform duration-200 cursor-pointer" : "";

  const headerPadding = "pb-1 p-2";
  const titleSize = "text-sm";
  const imageSize = "h-24 md:h-32";
  const contentPadding = "p-2 space-y-1";
  const contentTextSize = "text-xs";
  const iconSize = "w-3 h-3 md:w-4 md:h-4";

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden shadow-xl",
        cardSizeClass,
        cardHoverEffect,
        isSelected ? "ring-2 ring-accent shadow-accent" : "",
        isOpponentCard && !inBattleArena && !isSelected && !isPlayerTurnForThisCard ? "opacity-70" : "",
        isOpponentCard && isPlayerTurnForThisCard && !inBattleArena ? "opacity-100" : ""
      )}
      onClick={isPlayable ? onClick : undefined}
      aria-label={`Card: ${card.title}`}
      role={isPlayable ? "button" : "img"}
      tabIndex={isPlayable ? 0 : -1}
    >
      <CardHeader className={cn("text-center", headerPadding)}>
        <CardTitle className={cn("truncate", titleSize)}>{card.title}</CardTitle>
      </CardHeader>

      <div className={cn("relative w-full bg-muted/50", imageSize)}>
        {card.isLoadingArt ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : card.artUrl ? (
          <Image
            src={card.artUrl}
            alt={`Art for ${card.title}`}
            fill
            objectFit="contain" 
            data-ai-hint="fantasy creature"
            className="rounded-t-sm"
          />
        ) : (
          <Image
            src="https://placehold.co/300x400.png"
            alt={`Placeholder for ${card.title}`}
            fill
            objectFit="contain"
            data-ai-hint="fantasy abstract"
            className="rounded-t-sm"
          />
        )}
      </div>
      <TooltipProvider delayDuration={300}>
        <CardContent className={cn("flex-grow space-y-1", contentPadding, contentTextSize)}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {/* DIAGNOSTIC: Direct rendering for Melee stat */}
            {card.melee > 0 && (
              <div className="flex items-center space-x-1 cursor-default" aria-label={`Melee: ${Math.round(card.melee)}`}>
                <Swords className={cn(iconSize, "text-red-400")} />
                <span className="font-semibold">
                  {inBattleArena ? <AnimatedNumber value={card.melee} /> : Math.round(card.melee)}
                </span>
              </div>
            )}
            {card.magic > 0 && <StatDisplay icon={<Sparkles className={cn(iconSize, "text-blue-400")} />} currentValue={card.magic} label="Magic" isSingleValue={true} animateStats={inBattleArena} />}
            <StatDisplay icon={<ShieldHalf className={cn(iconSize, "text-green-400")} />} currentValue={card.defense} label="Defense" isSingleValue={true} animateStats={inBattleArena} />}
            <StatDisplay icon={<Heart className={cn(iconSize, "text-pink-400")} />} currentValue={card.hp} maxValue={card.maxHp} label="HP" animateStats={inBattleArena} />}
          </div>
          { card.maxShield > 0 && <StatDisplay icon={<ShieldCheck className={cn(iconSize, "text-yellow-400")} />} currentValue={card.shield} maxValue={card.maxShield} label="Physical Shield" animateStats={inBattleArena} /> }
          { card.maxMagicShield > 0 && <StatDisplay icon={<ShieldAlert className={cn(iconSize, "text-purple-400")} />} currentValue={card.magicShield} maxValue={card.maxMagicShield} label="Magic Shield" animateStats={inBattleArena} /> }
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
