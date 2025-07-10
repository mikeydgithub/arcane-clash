
'use client';

import type { CardData, MonsterCardData } from '@/types';
import { CardView } from './CardView';
import { CoinFlipAnimation } from './CoinFlipAnimation';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

import { ScrollArea } from '@/components/ui/scroll-area';

interface BattleArenaProps {
  player1Card?: MonsterCardData;
  player2Card?: MonsterCardData;
  player1Name: string;
  player2Name: string;
  showClashAnimation?: boolean;
  gameLogMessages: string[];
  gamePhase: string;

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
  onCoinFlipAnimationComplete,
  winningPlayerNameForCoinFlip,
}: BattleArenaProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 50, x: 0 },
    visible: { opacity: 1, scale: 1, y: 0, x: 0, transition: { duration: 0.5, type: 'spring', stiffness: 120 } },
    exit: { opacity: 0, scale: 0.5, y: -50, x: 0, transition: { duration: 0.3 } },
  };

  const [displayedLogEntries, setDisplayedLogEntries] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entriesToAnimateRef = useRef<string[]>([]);

  const [clashTextVisible, setClashTextVisible] = useState(false);
  const hideClashTextTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        console.log('[BattleArena] Animating next entry from queue:', nextEntry.length > 70 ? nextEntry.substring(0,70) + "..." : nextEntry);
        setDisplayedLogEntries(prev => {
            if (prev.length > 0 && prev[prev.length -1] === nextEntry) {
                console.warn(`[BattleArena] Prevented adding duplicate log entry: ${nextEntry.substring(0,30)}...`);
                return prev;
            }
            return [...prev, nextEntry];
        });
      }

      if (entriesToAnimateRef.current.length > 0) {
        animationTimeoutRef.current = setTimeout(animateNextEntry, 300);
      } else {
        console.log('[BattleArena] Animation queue empty.');
        animationTimeoutRef.current = null;
      }
    } else {
      console.log('[BattleArena] animateNextEntry called but queue is empty.');
      animationTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    console.log(`[BattleArena] Log effect triggered. gameLogMessages length: ${gameLogMessages.length}, displayedLogEntries length: ${displayedLogEntries.length}, gamePhase: ${gamePhase}`);

    if (
      (gamePhase === 'initial' || gamePhase === 'loading_art' || gamePhase === 'coin_flip_animation')
    ) {
      console.log('[BattleArena] Initial/reset phase detected. Syncing displayedLogEntries.');
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
      entriesToAnimateRef.current = [];
      setDisplayedLogEntries([...gameLogMessages]);
      return;
    }

    if (gameLogMessages.length < displayedLogEntries.length) {
        console.log('[BattleArena] gameLogMessages shorter than displayed. Resetting display and queue.');
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
        entriesToAnimateRef.current = [];
        setDisplayedLogEntries([...gameLogMessages]);
        return;
    }

    const newEntriesToPotentiallyQueue = gameLogMessages.slice(displayedLogEntries.length);

    if (newEntriesToPotentiallyQueue.length > 0) {
        console.log('[BattleArena] New entries to potentially queue:', newEntriesToPotentiallyQueue);
        entriesToAnimateRef.current = [...newEntriesToPotentiallyQueue];

        if (!animationTimeoutRef.current) {
            console.log('[BattleArena] Starting animation chain for queue of length:', entriesToAnimateRef.current.length);
            animateNextEntry();
        } else {
            console.log('[BattleArena] Animation already in progress. Queue ref updated. Current queue length:', entriesToAnimateRef.current.length);
        }
    } else if (gameLogMessages.length === displayedLogEntries.length && JSON.stringify(gameLogMessages) !== JSON.stringify(displayedLogEntries)) {
        console.warn('[BattleArena] Log content mismatch at same length. Re-syncing display and queue.');
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
        setDisplayedLogEntries([...gameLogMessages]);
        entriesToAnimateRef.current = [];
    } else {
        console.log('[BattleArena] No new log entries to animate, or display is already in sync.');
    }

  }, [gameLogMessages, gamePhase]);


  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLogEntries]);


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
            {displayedLogEntries.map((entry, index) => (
              <motion.p
                key={`coin-log-${index}-${entry.slice(0,20)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-[10px] md:text-xs text-foreground mb-1 last:mb-0 text-center"
              >
                {entry}
              </motion.p>
            ))}
            <div ref={logEndRef} />
          </ScrollArea>
        </div>
      </div>
    );
  }

  const isCombatPhase = gamePhase === 'combat_phase';

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

        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player1Card && (
              <motion.div
                key={`p1-active-${player1Card.id}`}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(isCombatPhase && 'box-right')}
                style={{ transformOrigin: 'center top' }}
              >
                <CardView card={player1Card} inBattleArena={true} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player2Card && (
              <motion.div
                key={`p2-active-${player2Card.id}`}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(isCombatPhase && 'box-left')}
                style={{ transformOrigin: 'center top' }}
              >
                <CardView card={player2Card} inBattleArena={true} isOpponentCard={true} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>



      <div className="w-full max-w-xl h-[30%] max-h-40 md:max-h-48 mb-1 md:mb-2">
        <ScrollArea className="h-full w-full bg-background/70 border border-border rounded-md p-2 md:p-3 shadow-inner">
          {displayedLogEntries.length === 0 && gamePhase === 'player_action_phase' && (
            <p className="text-xs md:text-sm text-center text-muted-foreground italic">
              Waiting for player action...
            </p>
          )}
          {displayedLogEntries.map((entry, index) => (
            <motion.p
              key={`log-entry-${index}-${entry}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] md:text-xs text-foreground mb-1 last:mb-0 whitespace-pre-line"
            >
              {entry}
            </motion.p>
          ))}
          <div ref={logEndRef} />
        </ScrollArea>
      </div>
    </div>
  );
}
