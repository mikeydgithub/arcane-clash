
'use client';

import Image from 'next/image';
import type { CardData, MonsterCardData, SpellCardData, StatusEffect } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Swords, Sparkles, Heart, Zap, HelpCircle, Wind, Flame, Sprout } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import React, { useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusEffectIcon } from './StatusEffectIcon';

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

interface BuffIconProps {
  icon: React.ReactNode;
  tooltipText: string;
}

function BuffIcon({ icon, tooltipText }: BuffIconProps) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>{icon}</TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-[180px] text-xs p-2">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}


interface StatDisplayProps {
  icon: React.ReactNode;
  currentValue: number;
  maxValue?: number;
  label: string;
  isSingleValue?: boolean;
  animateStats?: boolean;
  tooltipText?: string;
  buffIcons?: BuffIconProps[];
  isDominant?: boolean;
  dominantStatType?: 'melee' | 'magic';
}

function StatDisplay({ icon, currentValue, maxValue, label, isSingleValue = false, animateStats = false, tooltipText, buffIcons, isDominant = false, dominantStatType }: StatDisplayProps) {
  const displayCurrentValueNode = animateStats ? <AnimatedNumber value={currentValue} /> : Math.round(currentValue);
  const ariaCurrentValue = Math.round(currentValue);
  const ariaMaxValue = maxValue !== undefined ? Math.round(maxValue) : undefined;
  const glowClass = isDominant
  ? dominantStatType === 'melee' ? 'animate-glow-red' : 'animate-glow-blue'
  : '';


  const statElement = (
    <div
      className="flex items-center space-x-1 cursor-default"
      aria-label={`${label}: ${ariaCurrentValue}${!isSingleValue && ariaMaxValue !== undefined ? ` / ${ariaMaxValue}` : ''}`}
    >
      <div className={cn('flex items-center', glowClass)}>
        {icon}
      </div>
      <span className={cn('font-semibold', glowClass)}>
        {displayCurrentValueNode}
        {!isSingleValue && maxValue !== undefined && ` / ${Math.round(maxValue)}`}
      </span>
      {buffIcons && buffIcons.map((buff, index) => <BuffIcon key={index} {...buff} />)}
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
  statusEffects?: StatusEffect[];
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
  statusEffects = [],
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
  const monsterCard = isMonster ? (card as MonsterCardData) : null;
  const hasAbilities = monsterCard && (monsterCard.hasAmbush || monsterCard.hasLifeSteal || monsterCard.hasSpikedArmor || monsterCard.hasFinalGift);

  let dominantAttack: 'melee' | 'magic' | 'none' = 'none';
  if (isMonster && inBattleArena) {
    if (monsterCard.magic > monsterCard.melee) {
      dominantAttack = 'magic';
    } else if (monsterCard.melee >= monsterCard.magic && monsterCard.melee > 0) {
      dominantAttack = 'melee';
    }
  }


  const cardElementInner = (
    <MotionCard
      className={cn(
        "flex flex-col overflow-visible shadow-xl relative", // overflow-visible to allow icons to hang off
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
                  <StatDisplay 
                    icon={<Swords className={cn(iconSize, "text-red-400")} />} 
                    currentValue={(card as MonsterCardData).melee} 
                    label="Melee" 
                    isSingleValue={true} 
                    animateStats={inBattleArena} 
                    tooltipText="Melee Attack: Physical damage dealt."
                    isDominant={dominantAttack === 'melee'}
                    dominantStatType="melee"
                    buffIcons={[
                      ...((card as MonsterCardData).hasSwiftnessAura ? [{ icon: <Wind className={cn(iconSize, "text-green-400")} />, tooltipText: "Swiftness Aura: +3 Melee" }] : []),
                      ...((card as MonsterCardData).hasMightInfusion ? [{ icon: <Flame className={cn(iconSize, "text-orange-400")} />, tooltipText: "Might Infusion: +4 Melee & Magic" }] : []),
                    ]}
                  />
              )}
            </div>
            {/* Column 2 */}
            <div className="flex flex-col gap-y-0.5">
              {(card as MonsterCardData).magic > 0 && (
                  <StatDisplay 
                    icon={<Sparkles className={cn(iconSize, "text-blue-400")} />} 
                    currentValue={(card as MonsterCardData).magic} 
                    label="Magic" 
                    isSingleValue={true} 
                    animateStats={inBattleArena} 
                    tooltipText="Magic Attack: Magical damage dealt." 
                    isDominant={dominantAttack === 'magic'}
                    dominantStatType="magic"
                    buffIcons={[
                       ...((card as MonsterCardData).hasMightInfusion ? [{ icon: <Flame className={cn(iconSize, "text-orange-400")} />, tooltipText: "Might Infusion: +4 Melee & Magic" }] : []),
                    ]}
                  />
              )}
               <StatDisplay
                  icon={<Heart className={cn(iconSize, "text-pink-400")} />}
                  currentValue={(card as MonsterCardData).hp}
                  maxValue={(card as MonsterCardData).maxHp}
                  label="HP"
                  animateStats={inBattleArena}
                  tooltipText={`Hit Points: Current ${Math.round((card as MonsterCardData).hp)} / Max ${Math.round((card as MonsterCardData).maxHp)}`}
                  buffIcons={[
                      ...((card as MonsterCardData).hasGrowthSpurt ? [{ icon: <Sprout className={cn(iconSize, "text-lime-400")} />, tooltipText: "Growth Spurt: +10 Max HP" }] : []),
                  ]}
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

      <div className="mt-auto flex-shrink-0 min-h-[3rem]">
        {inBattleArena && isMonster && statusEffects.length > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 w-full px-1 z-20" style={{bottom: '-14px'}}>
                <div className="flex items-center justify-center space-x-1 p-1">
                    <AnimatePresence>
                        {statusEffects.map(effect => (
                            <StatusEffectIcon key={effect.id} effect={effect} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        )}
        <CardFooter className="p-1.5 flex items-center justify-center text-center leading-tight">
          {card.isLoadingDescription ? (
            <p className="text-xs text-muted-foreground italic">Generating info...</p>
          ) : card.cardType === 'Spell' ? (
              !card.description ? (
                <p className="text-xs text-muted-foreground italic flex items-center">
                  <HelpCircle className="w-3 h-3 mr-1"/> Effect: No info yet.
                </p>
              ) : null
          ) : (card.cardType === 'Monster' && !card.description && !hasAbilities) ? (
            <p className="text-xs text-muted-foreground italic flex items-center">
                <HelpCircle className="w-3 h-3 mr-1"/> Flavor: No info yet.
            </p>
          ) : null}
          {hasAbilities && (
            <div className="flex items-center text-xs text-amber-400 italic">
              <Sparkles className="w-3 h-3 mr-1" />
              <span>Special Ability</span>
            </div>
          )}
        </CardFooter>
      </div>
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
            <p className="text-xs italic mb-2">{card.description}</p>
          ) : null}
          {hasAbilities && (
            <div className="border-t border-border pt-2 mt-2">
              <p className="font-semibold text-sm mb-1 text-amber-300">Abilities:</p>
              <ul className="list-none pl-0 text-xs space-y-1">
                {monsterCard?.hasAmbush && <li><strong className="font-semibold">Ambush:</strong> On play, deals 5 damage to the enemy monster.</li>}
                {monsterCard?.hasLifeSteal && <li><strong className="font-semibold">Life Steal:</strong> Heals for 50% of damage dealt on attack.</li>}
                {monsterCard?.hasSpikedArmor && <li><strong className="font-semibold">Spiked Armor:</strong> Deals 4 damage back when hit by a melee attack.</li>}
                {monsterCard?.hasFinalGift && <li><strong className="font-semibold">Final Gift:</strong> On death, draw 2 cards.</li>}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
  );

  const shouldShowTooltip = (showDescriptionTooltip || (isMonster && inBattleArena)) && (card.description || card.isLoadingDescription || hasAbilities);

  return (
    <TooltipProvider>
      {shouldShowTooltip ? cardWithMainTooltip : cardElementInner}
    </TooltipProvider>
  );
}

    