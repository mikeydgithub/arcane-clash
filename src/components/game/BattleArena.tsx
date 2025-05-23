
'use client';

import type { CardData } from '@/types';
import { CardView } from './CardView';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BattleArenaProps {
  player1Card?: CardData;
  player2Card?: CardData;
  showClashAnimation?: boolean;
  battleMessage?: string;
}

export function BattleArena({ player1Card, player2Card, showClashAnimation, battleMessage }: BattleArenaProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, type: 'spring' } },
    exit: { opacity: 0, scale: 0.5, y: -50, transition: { duration: 0.3 } }
  };

  return (
    <div className="flex-grow flex flex-col justify-center items-center relative p-2 md:p-4 min-h-0 w-full">
      <div className="flex justify-around items-center w-full max-w-3xl h-full relative">
        {/* Player 1 Card Slot (Left side of Arena) */}
        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player1Card && (
              <motion.div
                key={`p1-${player1Card.id}`}
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
            animate={{ opacity: 1, scale: [1, 1.1, 1], transition: { duration: 0.7, type: 'spring', stiffness: 250 } }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
            className="absolute text-4xl md:text-5xl font-bold text-destructive z-10 uppercase tracking-wider"
            style={{ textShadow: '2px 2px 0px var(--background), 2px 2px 0px hsl(var(--primary))' }}
          >
            Clash!
          </motion.div>
        )}
        {battleMessage && !showClashAnimation && (
           <motion.div
            key="battle-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
            className="absolute text-center text-sm md:text-base font-semibold text-foreground bg-background/80 p-2 rounded-md shadow-lg z-10 max-w-xs md:max-w-sm"
          >
            {battleMessage}
          </motion.div>
        )}

        {/* Player 2 Card Slot (Right side of Arena) */}
        <div className="w-1/2 flex justify-center items-center h-full">
          <AnimatePresence>
            {player2Card && (
              <motion.div
                key={`p2-${player2Card.id}`}
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
      <style jsx>{`
        @keyframes clash-p1 {
          0% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(8px) rotate(-2deg) scale(1.03); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes clash-p2 {
          0% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(-8px) rotate(2deg) scale(1.03); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        .animate-clash-p1 { animation: clash-p1 0.7s ease-in-out; }
        .animate-clash-p2 { animation: clash-p2 0.7s ease-in-out; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
