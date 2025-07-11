
'use client';

import Image from 'next/image';
import type { CardData, MonsterCardData, SpellCardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, Heart, Zap, HelpCircle } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import React, { useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AnimatedNumberProps {
  value: number;
}

function AnimatedNumber({ value }: AnimatedNumberProps) {
  const numericValue = Number.isFinite(value) ? value : 0;
  const numberMotionValue = useMotionValue(numericValue);

  useEffect(() => {
    const newNumericTarget = Number.isFinite(value) ? value : 0;
    const currentMotionNumericValue = Number.isFinite(numberMotionValue.get()) ? numberMotionValue.get() : 0;

    const controls = animate(numberMotionValue, newNumericTarget, {
      duration: Math.max(0.2, Math.abs(newNumericTarget - currentMotionNumericValue) * 0.15),
      type: "tween",
      ease: "linear",
    });

    return () => controls.stop();
  }, [value, numberMotionValue]);

  const displayTransformed = useTransform(numberMotionValue, (v) => {
    const currentDisplayNum = Number.isFinite(v) ? Math.round(v) : 0;
    return String(currentDisplayNum);
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
  tooltipText?: string;
}

function StatDisplay({ icon, currentValue, maxValue, label, isSingleValue = false, animateStats = false, tooltipText }: StatDisplayProps) {
  const displayCurrentValueNode = animateStats ? <AnimatedNumber value={currentValue} /> : Math.round(currentValue);
  const ariaCurrentValue = Math.round(currentValue);
  const ariaMaxValue = maxValue !== undefined ? Math.round(maxValue) : undefined;

  const statElement = (
    <div
      className="flex items-center space-x-1 cursor-default"
      aria-label={`${label}: ${ariaCurrentValue}${!isSingleValue && ariaMaxValue !== undefined ? ` / ${ariaMaxValue}` : ''}`}
    >
      {icon}
      <span className="font-semibold">
        {displayCurrentValueNode}
        {!isSingleValue && maxValue !== undefined && ` / ${Math.round(maxValue)}`}
      </span>
    </div>
  );

  if (tooltipText) {
    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{statElement}</TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-[180px] text-xs p-2">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return statElement;
}

interface CardViewProps {
  card: CardData;
  onClick?: () => void;
  isSelected?: boolean;
  isPlayable?: boolean;
  isOpponentCard?: boolean;
  inBattleArena?: boolean;
  isPlayerTurnForThisCard?: boolean;
  showDescriptionTooltip?: boolean;
}

const MotionCard = motion.create(Card);

const ghastlyGlowVariants = {
  selected: {
    boxShadow: [
      "0 0 10px 3px hsla(170, 70%, 60%, 0.5)",
      "0 0 22px 7px hsla(170, 70%, 60%, 0.8)",
      "0 0 10px 3px hsla(170, 70%, 60%, 0.5)",
    ],
    transition: {
      duration: 2.0,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  initial: {},
};

export function CardView({
  card,
  onClick,
  isSelected,
  isPlayable,
  isOpponentCard = false,
  inBattleArena = false,
  isPlayerTurnForThisCard = false,
  showDescriptionTooltip = false,
}: CardViewProps) {
  const baseCardSize = "w-40 h-56 md:w-48 md:h-64";
  const cardHoverEffect = isPlayable && !inBattleArena ? "hover:scale-105 hover:shadow-lg transition-transform duration-200 cursor-pointer" : "";

  const headerPadding = "pb-1 p-2";
  const titleSize = "text-sm";
  const imageSizesProp = "(max-width: 767px) 160px, 192px";
  const contentPadding = "p-1.5"; 
  const contentTextSize = "text-xs";
  const iconSize = "w-3 h-3 md:w-4 md:h-4";

  const isMonster = card.cardType === 'Monster';

  const cardElementInner = (
    <MotionCard
      className={cn(
        "flex flex-col overflow-hidden shadow-xl",
        baseCardSize,
        cardHoverEffect,
        isSelected && !inBattleArena ? "ring-2 ring-accent" : "",
        isOpponentCard && !inBattleArena && !isSelected && !isPlayerTurnForThisCard ? "opacity-70" : "",
        isOpponentCard && isPlayerTurnForThisCard && !inBattleArena ? "opacity-100" : "",
        !isMonster ? "border-purple-500/50 ring-purple-500/30" : ""
      )}
      onClick={isPlayable ? onClick : undefined}
      aria-label={`Card: ${card.title} (${card.cardType})`}
      role={isPlayable ? "button" : "img"}
      tabIndex={isPlayable ? 0 : -1}
      variants={ghastlyGlowVariants}
      animate={inBattleArena && isMonster ? "selected" : "initial"}
      initial="initial"
    >
      <CardHeader className={cn("text-center", headerPadding)}>
        <CardTitle className={cn("truncate", titleSize)}>{card.title}</CardTitle>
      </CardHeader>

      <div className="relative w-full aspect-[4/3] bg-muted/50">
        {card.isLoadingArt ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : card.artUrl ? (
          <Image
            src={card.artUrl}
            alt={`Art for ${card.title}`}
            fill
            sizes={imageSizesProp}
            style={{ objectFit: 'contain' }}
            data-ai-hint={isMonster ? "fantasy creature" : "magical spell"}
            className="rounded-t-sm"
            priority={true}
          />
        ) : (
          <Image
            src={isMonster ? "https://placehold.co/300x400.png" : "https://placehold.co/300x400.png"}
            alt={`Placeholder for ${card.title}`}
            fill
            sizes={imageSizesProp}
            style={{ objectFit: 'contain' }}
            data-ai-hint={isMonster ? "fantasy abstract" : "spell icon"}
            className="rounded-t-sm"
            priority={true}
          />
        )}
      </div>

      <CardContent className={cn(
          "flex-grow leading-none", 
          contentPadding, 
          contentTextSize, 
          isMonster ? "grid grid-cols-2 gap-x-2 gap-y-0.5 items-start justify-start" : "flex flex-col items-center justify-center" 
      )}>
        {isMonster && (
          <>
            {/* Column 1 */}
            <div className="flex flex-col gap-y-0.5">
              {(card as MonsterCardData).melee > 0 && (
                  <StatDisplay icon={<Swords className={cn(iconSize, "text-red-400")} />} currentValue={(card as MonsterCardData).melee} label="Melee" isSingleValue={true} animateStats={inBattleArena} tooltipText="Melee Attack: Physical damage dealt." />
              )}
            </div>
            {/* Column 2 */}
            <div className="flex flex-col gap-y-0.5">
              {(card as MonsterCardData).magic > 0 && (
                  <StatDisplay icon={<Sparkles className={cn(iconSize, "text-blue-400")} />} currentValue={(card as MonsterCardData).magic} label="Magic" isSingleValue={true} animateStats={inBattleArena} tooltipText="Magic Attack: Magical damage dealt." />
              )}
               <StatDisplay
                  icon={<Heart className={cn(iconSize, "text-pink-400")} />}
                  currentValue={(card as MonsterCardData).hp}
                  maxValue={(card as MonsterCardData).maxHp}
                  label="HP"
                  animateStats={inBattleArena}
                  tooltipText={`Hit Points: Current ${Math.round((card as MonsterCardData).hp)} / Max ${Math.round((card as MonsterCardData).maxHp)}`}
              />
            </div>
          </>
        )}
        {!isMonster && (
          <div className="flex flex-col items-center text-center p-1">
            <Zap className={cn(iconSize, "text-yellow-400 mb-0.5")} />
            <p className="text-xs italic">Spell Effect</p>
          </div>
        )}
      </CardContent>

      {!inBattleArena && (
        <CardFooter className="p-1.5 mt-auto flex items-center justify-center text-center leading-tight">
          {card.isLoadingDescription ? (
            <p className="text-xs text-muted-foreground italic">Generating info...</p>
          ) : card.cardType === 'Spell' ? (
              card.description ? (
                <p className="text-xs text-muted-foreground italic">
                  Effect: {card.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic flex items-center">
                  <HelpCircle className="w-3 h-3 mr-1"/> Effect: No info yet.
                </p>
              )
          ) : card.cardType === 'Monster' && !card.description ? (
            // Only show "No info" for monster if description is truly absent AND not loading.
            // If monster has description, it's in the tooltip, so footer remains empty for this part.
            <p className="text-xs text-muted-foreground italic flex items-center">
                <HelpCircle className="w-3 h-3 mr-1"/> Flavor: No info yet.
            </p>
          ) : null}
        </CardFooter>
      )}
    </MotionCard>
  );

  const cardWithMainTooltip = (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{cardElementInner}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-[200px] break-words bg-popover text-popover-foreground p-3 rounded-md shadow-lg text-sm border border-border"
        >
          <p className="font-bold text-base mb-1">{card.title}</p>
          {card.isLoadingDescription ? (
            <p className="text-xs italic">Generating details...</p>
          ) : card.description ? (
            <p className="text-xs italic">{card.description}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
  );

  return (
    <TooltipProvider>
      {showDescriptionTooltip && (card.description || card.isLoadingDescription)
        ? cardWithMainTooltip
        : cardElementInner}
    </TooltipProvider>
  );
}
