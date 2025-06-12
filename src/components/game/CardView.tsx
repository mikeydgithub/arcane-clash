
'use client';

import Image from 'next/image';
import type { CardData, MonsterCardData, SpellCardData } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, ShieldHalf, Heart, ShieldCheck, ShieldAlert, Zap, HelpCircle } from 'lucide-react'; 
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
}

function StatDisplay({ icon, currentValue, maxValue, label, isSingleValue = false, animateStats = false }: StatDisplayProps) {
  const displayCurrentValueNode = animateStats ? <AnimatedNumber value={currentValue} /> : Math.round(currentValue);
  const ariaCurrentValue = Math.round(currentValue);
  const ariaMaxValue = maxValue !== undefined ? Math.round(maxValue) : undefined;

  return (
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

const MotionCard = motion(Card);

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
  const imageSize = "h-24 md:h-32"; 
  const imageSizesProp = "(max-width: 767px) 160px, 192px";
  const contentPadding = "p-2"; 
  const contentTextSize = "text-xs";
  const iconSize = "w-3 h-3 md:w-4 md:h-4";

  const isMonster = card.cardType === 'Monster';

  const cardElement = (
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

      <div className={cn("relative w-full bg-muted/50", imageSize)}>
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
      
      <CardContent className={cn("flex-grow flex flex-col items-center justify-center space-y-0.5", contentPadding, contentTextSize)}>
        {isMonster && (card as MonsterCardData).melee > 0 && <StatDisplay icon={<Swords className={cn(iconSize, "text-red-400")} />} currentValue={(card as MonsterCardData).melee} label="Melee" isSingleValue={true} animateStats={inBattleArena} />}
        {isMonster && (card as MonsterCardData).magic > 0 && <StatDisplay icon={<Sparkles className={cn(iconSize, "text-blue-400")} />} currentValue={(card as MonsterCardData).magic} label="Magic" isSingleValue={true} animateStats={inBattleArena} />}
        {isMonster && (
          <>
            <StatDisplay
              icon={<ShieldHalf className={cn(iconSize, "text-green-400")} />}
              currentValue={(card as MonsterCardData).defense}
              label="Defense"
              isSingleValue={true}
              animateStats={inBattleArena}
            />
            <StatDisplay icon={<Heart className={cn(iconSize, "text-pink-400")} />} currentValue={(card as MonsterCardData).hp} maxValue={(card as MonsterCardData).maxHp} label="HP" animateStats={inBattleArena} />
            {(card as MonsterCardData).maxShield > 0 && <StatDisplay icon={<ShieldCheck className={cn(iconSize, "text-yellow-400")} />} currentValue={(card as MonsterCardData).shield} maxValue={(card as MonsterCardData).maxShield} label="Physical Shield" animateStats={inBattleArena} />}
            {(card as MonsterCardData).maxMagicShield > 0 && <StatDisplay icon={<ShieldAlert className={cn(iconSize, "text-purple-400")} />} currentValue={(card as MonsterCardData).magicShield} maxValue={(card as MonsterCardData).maxMagicShield} label="Magic Shield" animateStats={inBattleArena} />}
          </>
        )}
        {!isMonster && ( 
          <div className="flex flex-col items-center text-center p-2">
            <Zap className={cn(iconSize, "text-yellow-400 mb-1")} />
            <p className="text-xs italic">Spell Effect</p>
          </div>
        )}
      </CardContent>

      {!inBattleArena && (
        <CardFooter className="p-2 mt-auto min-h-[2.5rem] flex items-center justify-center">
          {card.isLoadingDescription ? ( 
            <p className="text-xs text-muted-foreground italic">Generating info...</p>
          ) : card.description ? (
            <p className="text-xs text-muted-foreground italic truncate">
              {isMonster ? "Flavor: " : "Effect: "}
              {card.description}
            </p>
          ) : (
             <p className="text-xs text-muted-foreground italic flex items-center">
              <HelpCircle className="w-3 h-3 mr-1"/> No info yet.
            </p>
          )}
        </CardFooter>
      )}
    </MotionCard>
  );

  if (showDescriptionTooltip && (card.description || card.isLoadingDescription)) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>{cardElement}</TooltipTrigger>
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
      </TooltipProvider>
    );
  }

  return cardElement;
}
