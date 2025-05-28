
'use client';

import Image from 'next/image';
import type { CardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, ShieldHalf, Heart, ShieldCheck, ShieldAlert } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import React, { useEffect, useRef } from 'react';

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
  const numericTargetValue = Number(targetValue);
  const initialMotionValue = isNaN(numericTargetValue) ? 0 : numericTargetValue;

  const numberMotionValue = useMotionValue(initialMotionValue);
  const prevTargetValueRef = useRef(initialMotionValue);

  useEffect(() => {
    const previousValueOnEffectStart = prevTargetValueRef.current;
    // Ensure the animation starts from the value held by the motion value if different, or previous ref
    numberMotionValue.set(Number(numberMotionValue.get()) || previousValueOnEffectStart);


    const currentNumericTarget = Number(targetValue);

    if (isNaN(currentNumericTarget)) {
        // If the target value is not a number, set motion value to a fallback (e.g., 0 or last valid)
        // and update ref to prevent NaN propagation.
        const fallbackValue = isNaN(Number(prevTargetValueRef.current)) ? 0 : Number(prevTargetValueRef.current);
        numberMotionValue.set(fallbackValue);
        prevTargetValueRef.current = fallbackValue;
        return;
    }

    const diff = Math.abs(currentNumericTarget - (Number(prevTargetValueRef.current))); // Diff from previous *numeric* ref
    let animationDuration = Math.max(0.2, diff * 0.15); // 150ms per unit, min 200ms
    animationDuration = Math.min(animationDuration, 2); // Max 2 seconds

    const controls = animate(numberMotionValue, currentNumericTarget, {
      duration: animationDuration,
      type: "tween",
      ease: "linear",
    });

    prevTargetValueRef.current = currentNumericTarget; // Store the current numeric target for next run

    return () => controls.stop();
  }, [targetValue, numberMotionValue]);

  const displayTransformed = useTransform(numberMotionValue, v => {
    const rounded = Math.round(Number(v));
    return isNaN(rounded) ? 0 : rounded; // Display 0 if calculation results in NaN
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
  const cardSizeClass = "w-40 h-56 md:w-48 md:h-64"; // Reverted to original default size
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
      <CardContent className={cn("flex-grow space-y-1", contentPadding, contentTextSize)}>
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
