
'use client';

import type { CardData } from '@/types';
import { CardView } from './CardView';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import React, { useState, useEffect, useRef } from 'react';

interface BattleArenaProps {
  player1Card?: CardData;
  player2Card?: CardData;
  showClashAnimation?: boolean;
  gameLogMessages: string[]; // Changed from turnLogMessages
  gamePhase: string; 
}

export function BattleArena({ player1Card, player2Card, showClashAnimation, gameLogMessages, gamePhase }: BattleArenaProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, type: 'spring' } },
    exit: { opacity: 0, scale: 0.5, y: -50, transition: { duration: 0.3 } }
  };

  const [displayedLogEntries, setDisplayedLogEntries] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entriesToAnimateRef = useRef<string[]>([]);


  useEffect(() => {
    // Clear previous animation timeout if effect re-runs
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  
    // If it's a new game or art loading, reset the displayed log immediately
    if (gamePhase === 'initial' || gamePhase === 'loading_art') {
      setDisplayedLogEntries(gameLogMessages || []);
      entriesToAnimateRef.current = []; // Clear any pending animations
      return;
    }
  
    // Determine new messages to animate
    // Compare gameLogMessages with currently displayed + queued messages
    const currentFullDisplayCandidateLength = displayedLogEntries.length + entriesToAnimateRef.current.length;
    const newMessages = gameLogMessages.slice(currentFullDisplayCandidateLength);
  
    if (newMessages.length > 0) {
      entriesToAnimateRef.current.push(...newMessages);
    }
  
    const animateNextEntry = () => {
      if (entriesToAnimateRef.current.length > 0) {
        const nextEntry = entriesToAnimateRef.current.shift();
        if (nextEntry) {
          setDisplayedLogEntries(prev => [...prev, nextEntry]);
        }
        animationTimeoutRef.current = setTimeout(animateNextEntry, 700); // Adjust delay as needed
      } else {
        animationTimeoutRef.current = null; // No more entries to animate
      }
    };
  
    // If there are entries to animate and no animation is currently scheduled
    if (entriesToAnimateRef.current.length > 0 && !animationTimeoutRef.current) {
      animateNextEntry();
    }
  
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [gameLogMessages, gamePhase]); // Rerun when log messages or game phase changes
  

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedLogEntries]);

  return (
    <div className="flex-grow flex flex-col justify-between items-center relative p-1 md:p-2 min-h-0 w-full h-full">
      <div className="flex-grow flex justify-around items-center w-full max-w-3xl relative min-h-[60%]">
        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player1Card && (
              <motion.div
                key={`p1-${player1Card.id}-${player1Card.hp}-${player1Card.shield}`} 
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(showClashAnimation ? "animate-clash-p1" : "")}
              >
                <CardView card={player1Card} inBattleArena={true} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showClashAnimation && (
          <motion.div
            key="clash-text"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: [1, 1.05, 1], transition: { duration: 0.6, type: 'spring', stiffness: 200 } }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
            className="absolute text-3xl md:text-4xl font-bold text-destructive z-10 uppercase tracking-wider"
            style={{ textShadow: '2px 2px 0px var(--background), 2px 2px 0px hsl(var(--primary))' }}
          >
            Clash!
          </motion.div>
        )}
        
        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player2Card && (
              <motion.div
                key={`p2-${player2Card.id}-${player2Card.hp}-${player2Card.shield}`} 
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(showClashAnimation ? "animate-clash-p2" : "")}
              >
                <CardView card={player2Card} inBattleArena={true} isOpponentCard={true}/>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full max-w-xl h-[30%] max-h-48 md:max-h-56 mt-2 mb-1 md:mb-2">
        <ScrollArea className="h-full w-full bg-background/70 border border-border rounded-md p-2 md:p-3 shadow-inner">
          {displayedLogEntries.length === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'player2_select_card') && (
            <p className="text-sm md:text-base text-center text-muted-foreground italic">
              Waiting for action...
            </p>
          )}
          {displayedLogEntries.map((entry, index) => (
            <motion.p
              key={index} // Using index as key here is acceptable as log entries are append-only and order matters
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs md:text-sm text-foreground mb-1 last:mb-0"
            >
              {entry}
            </motion.p>
          ))}
          <div ref={logEndRef} />
        </ScrollArea>
      </div>

      <style jsx>{`
        @keyframes clash-p1 {
          0% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(6px) rotate(-1.5deg) scale(1.02); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes clash-p2 {
          0% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(-6px) rotate(1.5deg) scale(1.02); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        .animate-clash-p1 { animation: clash-p1 0.6s ease-in-out; }
        .animate-clash-p2 { animation: clash-p2 0.6s ease-in-out; }
      `}</style>
    </div>
  );
}
