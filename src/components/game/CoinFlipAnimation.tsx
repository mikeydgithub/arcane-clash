
'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface CoinFlipAnimationProps {
  winningPlayerName: string; // "Player 1" or "Player 2"
  player1Name: string;
  player2Name: string;
  onAnimationComplete: () => void;
}

export function CoinFlipAnimation({ winningPlayerName, player1Name, player2Name, onAnimationComplete }: CoinFlipAnimationProps) {
  const [isFlipping, setIsFlipping] = useState(true);
  const [showWinner, setShowWinner] = useState(false);

  const coinTextP1 = player1Name.substring(0, 10); // Max 10 chars for coin face
  const coinTextP2 = player2Name.substring(0, 10); // Max 10 chars for coin face


  useEffect(() => {
    const flipDuration = 3000; // Duration of coin spinning animation (ms)
    const postFlipDelay = 1500; // Delay after coin settles before calling onAnimationComplete (ms)

    const flipTimer = setTimeout(() => {
      setIsFlipping(false);
      setShowWinner(true);
      const completeTimer = setTimeout(() => {
        onAnimationComplete();
      }, postFlipDelay); 
      return () => clearTimeout(completeTimer);
    }, flipDuration); 

    return () => clearTimeout(flipTimer);
  }, [onAnimationComplete]);

  const coinVariants = {
    flipping: {
      rotateY: [0, 360 * 3 + (winningPlayerName === player2Name ? 180 : 0)], // Spin multiple times and land on winner
      transition: { duration: 3, ease: 'linear' }, // Corresponds to flipDuration
    },
    still: {
      rotateY: winningPlayerName === player2Name ? 180 : 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      {/* Message is now handled by GameBoard's gameLogMessages, shown in BattleArena's log */}
      <div style={{ perspective: '1000px' }} className="mt-4 mb-4 md:mt-6 md:mb-6">
        <motion.div
          className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-yellow-400 shadow-xl"
          style={{ transformStyle: 'preserve-3d' }}
          variants={coinVariants}
          initial={false}
          animate={isFlipping ? 'flipping' : 'still'}
        >
          {/* Player 1 Face */}
          <motion.div
            className="absolute w-full h-full rounded-full bg-primary flex items-center justify-center text-center text-primary-foreground font-bold text-base md:text-lg p-1"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {coinTextP1}
          </motion.div>
          {/* Player 2 Face */}
          <motion.div
            className="absolute w-full h-full rounded-full bg-accent flex items-center justify-center text-center text-accent-foreground font-bold text-base md:text-lg p-1"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {coinTextP2}
          </motion.div>
        </motion.div>
      </div>
      {/* Winner announcement is now part of the game log messages */}
    </div>
  );
}
