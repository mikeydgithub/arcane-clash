
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
  turnLogMessages: string[];
  gamePhase: string; // To help manage log display
}

export function BattleArena({ player1Card, player2Card, showClashAnimation, turnLogMessages, gamePhase }: BattleArenaProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, type: 'spring' } },
    exit: { opacity: 0, scale: 0.5, y: -50, transition: { duration: 0.3 } }
  };

  const [displayedLogEntries, setDisplayedLogEntries] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset displayed log when a new turn starts (indicated by player1_select_card phase or gamePhase change to combat_animation/resolution)
    // Or when turnLogMessages becomes very short (e.g. initial turn message)
    if (gamePhase === 'player1_select_card' || gamePhase === 'initial' || gamePhase === 'loading_art') {
      setDisplayedLogEntries(turnLogMessages || []);
      return;
    }

    if (gamePhase === 'combat_summary' || gamePhase === 'combat_animation' || gamePhase === 'combat_resolution') {
      setDisplayedLogEntries([]); // Clear previous log for combat sequence
      let currentEntryIndex = 0;
      const intervalId = setInterval(() => {
        if (currentEntryIndex < turnLogMessages.length) {
          setDisplayedLogEntries(prev => [...prev, turnLogMessages[currentEntryIndex]]);
          currentEntryIndex++;
        } else {
          clearInterval(intervalId);
        }
      }, 700); // Adjust delay as needed (e.g., 700ms)

      return () => clearInterval(intervalId);
    }
  }, [turnLogMessages, gamePhase]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedLogEntries]);

  return (
    <div className="flex-grow flex flex-col justify-between items-center relative p-1 md:p-2 min-h-0 w-full h-full">
      {/* Top section for cards */}
      <div className="flex-grow flex justify-around items-center w-full max-w-3xl relative min-h-[60%]"> {/* Ensure card area has enough space */}
        {/* Player 1 Card Slot (Left side of Arena) */}
        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player1Card && (
              <motion.div
                key={`p1-${player1Card.id}-${player1Card.hp}-${player1Card.shield}`} // Key change forces re-render on stat change
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

        {/* Clash Animation / Battle Message */}
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
        
        {/* Player 2 Card Slot (Right side of Arena) */}
        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player2Card && (
              <motion.div
                key={`p2-${player2Card.id}-${player2Card.hp}-${player2Card.shield}`} // Key change forces re-render on stat change
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

      {/* Bottom section for combat log */}
      <div className="w-full max-w-xl h-[30%] max-h-48 md:max-h-56 mt-2 mb-1 md:mb-2">
        <ScrollArea className="h-full w-full bg-background/70 border border-border rounded-md p-2 md:p-3 shadow-inner">
          {displayedLogEntries.length === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'player2_select_card') && (
            <p className="text-sm md:text-base text-center text-muted-foreground italic">
              {turnLogMessages[0] || "Waiting for action..."}
            </p>
          )}
          {displayedLogEntries.map((entry, index) => (
            <motion.p
              key={index}
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
