
'use client';

import Image from 'next/image';
import type { CardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, ShieldHalf, Heart, ShieldCheck, ShieldAlert } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import React, { useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number; // Expect a number
}

function AnimatedNumber({ value: targetValue }: AnimatedNumberProps) {
  // Ensure targetValue is treated as a number from the start.
  const numericTarget = Number(targetValue);
  const initialValue = isNaN(numericTarget) ? 0 : numericTarget;

  const numberMotionValue = useMotionValue(initialValue);
  // useRef should store the numeric value that was last targeted for animation.
  const prevTargetRef = useRef(initialValue);

  useEffect(() => {
    const newNumericTarget = Number(targetValue); 

    let valueToAnimateTo: number;
    if (isNaN(newNumericTarget)) {
      // If current target is NaN, set to last known good numeric value or 0
      valueToAnimateTo = isNaN(prevTargetRef.current) ? 0 : prevTargetRef.current;
    } else {
      valueToAnimateTo = newNumericTarget;
    }
    
    // Get current numeric value of motion value, default to 0 if NaN
    const currentMotionNumericValue = Number(numberMotionValue.get());
    const startValue = isNaN(currentMotionNumericValue) ? 0 : currentMotionNumericValue;

    const controls = animate(numberMotionValue, valueToAnimateTo, {
      duration: Math.max(0.2, Math.abs(valueToAnimateTo - startValue) * 0.15),
      type: "tween",
      ease: "linear",
    });

    // Store the value we are animating towards as the new "previous" target
    // if it was a valid number, otherwise keep the last valid one.
    if (!isNaN(newNumericTarget)) {
        prevTargetRef.current = newNumericTarget;
    }


    return () => controls.stop();
  }, [targetValue, numberMotionValue]); 

  const displayTransformed = useTransform(numberMotionValue, (v) => {
    const rounded = Math.round(Number(v));
    // Explicitly convert to string for motion.span to avoid potential issues
    return String(isNaN(rounded) ? 0 : rounded); 
  });

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

  return (
    <div
      className="flex items-center space-x-1 cursor-default"
      aria-label={`${label}: ${Math.round(currentValue)}${!isSingleValue && maxValue !== undefined ? `/${Math.round(maxValue)}` : ''}`}
    >
      {icon}
      <span className="font-semibold">
        {displayCurrentValueNode}
        {!isSingleValue && maxValue !== undefined && ` / ${Math.round(maxValue)}`}
      </span>
    </div>
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
  const baseCardSize = "w-40 h-56 md:w-48 md:h-64"; 
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
        baseCardSize,
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
            style={{ objectFit: 'contain' }}
            data-ai-hint="fantasy creature"
            className="rounded-t-sm"
          />
        ) : (
          <Image
            src="https://placehold.co/300x400.png"
            alt={`Placeholder for ${card.title}`}
            fill
            style={{ objectFit: 'contain' }}
            data-ai-hint="fantasy abstract"
            className="rounded-t-sm"
          />
        )}
      </div>
      <CardContent className={cn("flex-grow", contentPadding, contentTextSize)}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {card.melee > 0 && (
             <div className="flex items-center space-x-1 cursor-default" aria-label={`Melee: ${Math.round(card.melee)}`}>
                <Swords className={cn(iconSize, "text-red-400")} />
                <span className="font-semibold">
                  {inBattleArena ? <AnimatedNumber value={card.melee} /> : Math.round(card.melee)}
                </span>
              </div>
          )}
          {card.magic > 0 && <StatDisplay icon={<Sparkles className={cn(iconSize, "text-blue-400")} />} currentValue={card.magic} label="Magic" isSingleValue={true} animateStats={inBattleArena} />}
          
          {/* Defense Stat */}
          <StatDisplay icon={<ShieldHalf className={cn(iconSize, "text-green-400")} />} currentValue={card.defense} label="Defense" isSingleValue={true} animateStats={inBattleArena} />}
          
          {/* HP Stat */}
          <StatDisplay icon={<Heart className={cn(iconSize, "text-pink-400")} />} currentValue={card.hp} maxValue={card.maxHp} label="HP" animateStats={inBattleArena} />}
        </div>
        { card.maxShield > 0 && <StatDisplay icon={<ShieldCheck className={cn(iconSize, "text-yellow-400")} />} currentValue={card.shield} maxValue={card.maxShield} label="Physical Shield" animateStats={inBattleArena} /> }
        { card.maxMagicShield > 0 && <StatDisplay icon={<ShieldAlert className={cn(iconSize, "text-purple-400")} />} currentValue={card.magicShield} maxValue={card.maxMagicShield} label="Magic Shield" animateStats={inBattleArena} /> }
      </CardContent>

      {card.description && !inBattleArena && (
        <CardFooter className="p-2 mt-auto">
          <p className="text-xs text-muted-foreground italic truncate">{card.description}</p>
        </CardFooter>
      )}
    </Card>
  );
}
