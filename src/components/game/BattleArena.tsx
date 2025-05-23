
'use client';

import type { CardData } from '@/types';
import { CardView } from './CardView';
import { CoinFlipAnimation } from './CoinFlipAnimation';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BattleArenaProps {
  player1Card?: CardData;
  player2Card?: CardData;
  player1Name: string;
  player2Name: string;
  showClashAnimation?: boolean;
  gameLogMessages: string[];
  gamePhase: string;
  onProceedToNextTurn?: () => void;
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
  onProceedToNextTurn,
  onCoinFlipAnimationComplete,
  winningPlayerNameForCoinFlip,
}: BattleArenaProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 50, x: 0 },
    visible: { opacity: 1, scale: 1, y: 0, x: 0, transition: { duration: 0.5, type: 'spring', stiffness: 120 } },
    clashP1: {
      opacity: 1,
      x: ['0%', '60%', '0%'], // Move right, then back
      rotate: [0, -2, 0],    // Slight tilt
      scale: [1, 1.05, 1],   // Slightly enlarge on impact
      zIndex: [0, 10, 0],     // Bring to front during clash
      transition: { delay: 0.5, duration: 0.7, ease: 'easeInOut', times: [0, 0.5, 1] },
    },
    clashP2: {
      opacity: 1,
      x: ['0%', '-60%', '0%'], // Move left, then back
      rotate: [0, 2, 0],     // Slight tilt
      scale: [1, 1.05, 1],    // Slightly enlarge on impact
      zIndex: [0, 5, 0],      // Behind P1 card during clash
      transition: { delay: 0.5, duration: 0.7, ease: 'easeInOut', times: [0, 0.5, 1] },
    },
    exit: { opacity: 0, scale: 0.5, y: -50, x: 0, transition: { duration: 0.3 } },
  };

  const [displayedLogEntries, setDisplayedLogEntries] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entriesToAnimateRef = useRef<string[]>([]);

  useEffect(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    
    if (gamePhase === 'initial' || gamePhase === 'loading_art') {
        setDisplayedLogEntries(gameLogMessages || []);
        entriesToAnimateRef.current = [];
        return;
    }
    if (gamePhase === 'coin_flip_animation') {
        const coinFlipMessages = gameLogMessages.filter(msg => msg.toLowerCase().includes("coin"));
        if(gameLogMessages.length > 0 && !gameLogMessages[gameLogMessages.length -1].toLowerCase().includes("coin")){
            setDisplayedLogEntries(prev => [...prev, ...coinFlipMessages.filter(cfm => !prev.includes(cfm))]);
        } else {
            setDisplayedLogEntries(coinFlipMessages);
        }
        entriesToAnimateRef.current = []; 
        return;
    }


    const currentFullDisplayCandidateLength = displayedLogEntries.length + entriesToAnimateRef.current.length;

    if (gameLogMessages.length > currentFullDisplayCandidateLength) {
      const newMessages = gameLogMessages.slice(currentFullDisplayCandidateLength);
      entriesToAnimateRef.current.push(...newMessages);
    } else if (gameLogMessages.length < displayedLogEntries.length && gameLogMessages.length <=1 ) {
      setDisplayedLogEntries(gameLogMessages.slice(0, gameLogMessages.length));
      entriesToAnimateRef.current = [];
    }


    const animateNextEntry = () => {
      if (entriesToAnimateRef.current.length > 0) {
        const nextEntry = entriesToAnimateRef.current.shift();
        if (nextEntry) {
          setDisplayedLogEntries(prev => [...prev, nextEntry]);
        }
        animationTimeoutRef.current = setTimeout(animateNextEntry, 700); 
      } else {
        animationTimeoutRef.current = null;
      }
    };

    if (entriesToAnimateRef.current.length > 0 && !animationTimeoutRef.current) {
      animateNextEntry();
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
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
                key={`coin-log-${index}`}
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

  return (
    <div className="flex-grow flex flex-col justify-center items-center relative p-1 md:p-2 min-h-0 w-full h-full">
      <AnimatePresence>
        {showClashAnimation && (
          <motion.div
            key="clash-text-bubble"
            initial={{ opacity: 0, scale: 0.3, y: -60, rotate: -10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              rotate: 0,
              transition: {
                delay: 0.4, // Slightly before cards hit
                duration: 0.5, // Animation duration
                type: 'spring',
                stiffness: 120,
                damping: 8,
              },
            }}
            exit={{ opacity: 0, scale: 0.5, y: -30, rotate: 5, transition: { duration: 0.3 } }}
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
                key={`p1-${player1Card.id}`}
                variants={cardVariants}
                initial="hidden"
                animate={showClashAnimation ? 'clashP1' : 'visible'}
                exit="exit"
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
                key={`p2-${player2Card.id}`}
                variants={cardVariants}
                initial="hidden"
                animate={showClashAnimation ? 'clashP2' : 'visible'}
                exit="exit"
                style={{ transformOrigin: 'center top' }}
              >
                <CardView card={player2Card} inBattleArena={true} isOpponentCard={true} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {gamePhase === 'combat_summary' && onProceedToNextTurn && (
        <div className="my-2 md:my-3">
          <Button onClick={onProceedToNextTurn} className="bg-accent hover:bg-accent/90">
            <Play className="mr-2 h-4 w-4" /> Continue
          </Button>
        </div>
      )}

      <div className="w-full max-w-xl h-[30%] max-h-40 md:max-h-48 mb-1 md:mb-2">
        <ScrollArea className="h-full w-full bg-background/70 border border-border rounded-md p-2 md:p-3 shadow-inner">
          {displayedLogEntries.length === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'player2_select_card') && (
            <p className="text-xs md:text-sm text-center text-muted-foreground italic">
              Waiting for action...
            </p>
          )}
          {displayedLogEntries.map((entry, index) => (
            <motion.p
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] md:text-xs text-foreground mb-1 last:mb-0"
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
