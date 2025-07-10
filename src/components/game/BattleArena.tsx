
'use client';

import type { CardData, MonsterCardData, DamageIndicatorState, GameLogEntry } from '@/types';
import { CardView } from './CardView';
import { CoinFlipAnimation } from './CoinFlipAnimation';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DamageIndicator } from './DamageIndicator';

import { ScrollArea } from '@/components/ui/scroll-area';

interface BattleArenaProps {
  player1Card?: MonsterCardData;
  player2Card?: MonsterCardData;
  player1Name: string;
  player2Name: string;
  showClashAnimation?: boolean;
  gameLogMessages: GameLogEntry[];
  gamePhase: string;
  damageIndicators: DamageIndicatorState;

  onCoinFlipAnimationComplete?: () => void;
  winningPlayerNameForCoinFlip?: string;
}

export function BattleArena({
  player1Card,
  player2Card,
  player1Name,
  player2Name,
  showClashAnimation,
  gameLogMessages,
  gamePhase,
  damageIndicators,
  onCoinFlipAnimationComplete,
  winningPlayerNameForCoinFlip,
}: BattleArenaProps) {

  const [displayedLogEntries, setDisplayedLogEntries] = useState<GameLogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entriesToAnimateRef = useRef<GameLogEntry[]>([]);

  const [clashTextVisible, setClashTextVisible] = useState(false);
  const hideClashTextTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isCombatPhase = gamePhase === 'combat_phase';

  useEffect(() => {
    if (showClashAnimation && player1Card && player2Card) {
      setClashTextVisible(true);
      if (hideClashTextTimerRef.current) clearTimeout(hideClashTextTimerRef.current);
      hideClashTextTimerRef.current = setTimeout(() => setClashTextVisible(false), 2000);
    } else {
      setClashTextVisible(false);
    }
  }, [showClashAnimation, player1Card, player2Card]);


  useEffect(() => {
    return () => {
      if (hideClashTextTimerRef.current) clearTimeout(hideClashTextTimerRef.current);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);


  const animateNextEntry = () => {
    if (entriesToAnimateRef.current.length > 0) {
      const nextEntry = entriesToAnimateRef.current.shift();
      if (nextEntry) {
        setDisplayedLogEntries(prev => {
            const entryExists = prev.some(e => e.id === nextEntry.id);
            if (entryExists) {
                return prev;
            }
            return [...prev, nextEntry];
        });
      }

      if (entriesToAnimateRef.current.length > 0) {
        animationTimeoutRef.current = setTimeout(animateNextEntry, 300);
      } else {
        animationTimeoutRef.current = null;
      }
    } else {
      animationTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (
      (gamePhase === 'initial' || gamePhase === 'loading_art' || gamePhase === 'coin_flip_animation')
    ) {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
      entriesToAnimateRef.current = [];
      setDisplayedLogEntries([...gameLogMessages]);
      return;
    }
    
    // Quick reset if log shrinks
    if (gameLogMessages.length < displayedLogEntries.length) {
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
        entriesToAnimateRef.current = [];
        setDisplayedLogEntries([...gameLogMessages]);
        return;
    }
    
    const displayedIds = new Set(displayedLogEntries.map(e => e.id));
    const newEntriesToPotentiallyQueue = gameLogMessages.filter(msg => !displayedIds.has(msg.id));

    if (newEntriesToPotentiallyQueue.length > 0) {
        entriesToAnimateRef.current = [...entriesToAnimateRef.current, ...newEntriesToPotentiallyQueue];

        if (!animationTimeoutRef.current) {
            animateNextEntry();
        }
    } else if (gameLogMessages.length === displayedLogEntries.length) {
        // Handle case where log content changes but length does not (e.g. state reset)
        const logIdsMatch = gameLogMessages.every((msg, index) => displayedLogEntries[index]?.id === msg.id);
        if(!logIdsMatch) {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
            animationTimeoutRef.current = null;
            entriesToAnimateRef.current = [];
            setDisplayedLogEntries([...gameLogMessages]);
        }
    }

  }, [gameLogMessages, gamePhase]);


  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLogEntries]);

  const getLogTextStyle = (type: GameLogEntry['type']) => {
    switch (type) {
        case 'player1':
            return 'text-primary-foreground/90 font-semibold';
        case 'player2':
            return 'text-accent-foreground/90 font-semibold';
        case 'damage':
            return 'text-destructive font-bold';
        case 'heal':
            return 'text-emerald-400 font-semibold';
        case 'info':
            return 'text-cyan-400';
        case 'system':
        default:
            return 'text-muted-foreground italic';
    }
  };


  if (gamePhase === 'coin_flip_animation' && onCoinFlipAnimationComplete && winningPlayerNameForCoinFlip) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center relative p-1 md:p-2 min-h-0 w-full h-full">
        <CoinFlipAnimation
          winningPlayerName={winningPlayerNameForCoinFlip}
          player1Name={player1Name}
          player2Name={player2Name}
          onAnimationComplete={onCoinFlipAnimationComplete}
        />
        <div className="w-full max-w-xl h-[30%] max-h-40 md:max-h-48 mb-1 md:mb-2 mt-4">
          <ScrollArea className="h-full w-full bg-background/70 border border-border rounded-md p-2 md:p-3 shadow-inner">
            {displayedLogEntries.map((entry) => (
              <motion.p
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "text-[10px] md:text-xs mb-1 last:mb-0 text-center",
                  getLogTextStyle(entry.type)
                )}
              >
                {entry.text}
              </motion.p>
            ))}
            <div ref={logEndRef} />
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col justify-center items-center relative p-1 md:p-2 min-h-0 w-full h-full">
      <AnimatePresence>
        {clashTextVisible && (
          <motion.div
            key="clash-text-bubble"
            initial={{ opacity: 0, scale: 0.3, y: -60, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0, transition: { delay: 0.4, duration: 0.5, type: 'spring', stiffness: 120, damping: 8 }}}
            exit={{ opacity: 0, scale: 0.8, y: -30, rotate: 5, transition: { duration: 1.0, ease: "easeInOut" } }}
            className="absolute top-[10%] md:top-[15%] z-20 bg-destructive text-destructive-foreground font-black text-3xl md:text-5xl uppercase tracking-wider px-6 py-3 rounded-2xl shadow-2xl transform -skew-y-3"
            style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}
          >
            Clash!
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-grow flex justify-around items-center w-full max-w-3xl relative min-h-[50%] md:min-h-[60%]">

        <motion.div
            key={player1Card ? `p1-active-${player1Card.id}`: 'p1-empty'}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
            transition={{ duration: 0.5 }}
            className="relative w-1/2 flex justify-center items-center h-full"
          >
          <DamageIndicator damage={damageIndicators.p1Monster} />
            {player1Card && (
                <div className={cn(isCombatPhase && 'box-left')}>
                  <CardView card={player1Card} inBattleArena={true} />
                </div>
            )}
        </motion.div>


        <motion.div
            key={player2Card ? `p2-active-${player2Card.id}`: 'p2-empty'}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
            transition={{ duration: 0.5 }}
            className="relative w-1/2 flex justify-center items-center h-full"
          >
          <DamageIndicator damage={damageIndicators.p2Monster} />
            {player2Card && (
                <div className={cn(isCombatPhase && 'box-right')}>
                  <CardView card={player2Card} inBattleArena={true} isOpponentCard={true} />
                </div>
            )}
        </motion.div>
      </div>



      <div className="w-full max-w-xl h-[30%] max-h-40 md:max-h-48 mb-1 md:mb-2">
        <ScrollArea className="h-full w-full bg-background/70 border border-border rounded-md p-2 md:p-3 shadow-inner">
          {displayedLogEntries.length === 0 && gamePhase === 'player_action_phase' && (
            <p className="text-xs md:text-sm text-center text-muted-foreground italic">
              Waiting for player action...
            </p>
          )}
          {displayedLogEntries.map((entry) => (
            <motion.p
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "text-[10px] md:text-xs mb-1 last:mb-0 whitespace-pre-line",
                getLogTextStyle(entry.type)
              )}
            >
              {entry.text}
            </motion.p>
          ))}
          <div ref={logEndRef} />
        </ScrollArea>
      </div>
    </div>
  );
}
