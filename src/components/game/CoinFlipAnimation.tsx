
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

  const coinTextP1 = player1Name;
  const coinTextP2 = player2Name;

  useEffect(() => {
    const flipTimer = setTimeout(() => {
      setIsFlipping(false);
      setShowWinner(true);
      const completeTimer = setTimeout(() => {
        onAnimationComplete();
      }, 1500); // Hold the result for 1.5s
      return () => clearTimeout(completeTimer);
    }, 3000); // Flip for 3 seconds

    return () => clearTimeout(flipTimer);
  }, [onAnimationComplete]);

  const coinVariants = {
    flipping: {
      rotateY: [0, 360 * 3 + (winningPlayerName === player2Name ? 180 : 0)], // Spin multiple times and land on winner
      transition: { duration: 3, ease: 'linear' },
    },
    still: {
      rotateY: winningPlayerName === player2Name ? 180 : 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <p className="text-xl font-semibold mb-6 text-foreground animate-pulse">
        Flipping coin to decide who goes first...
      </p>
      <div style={{ perspective: '1000px' }}>
        <motion.div
          className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-yellow-400 shadow-xl"
          style={{ transformStyle: 'preserve-3d' }}
          variants={coinVariants}
          initial={false}
          animate={isFlipping ? 'flipping' : 'still'}
        >
          {/* Player 1 Face */}
          <motion.div
            className="absolute w-full h-full rounded-full bg-primary flex items-center justify-center text-center text-primary-foreground font-bold text-lg md:text-xl p-2"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {coinTextP1}
          </motion.div>
          {/* Player 2 Face */}
          <motion.div
            className="absolute w-full h-full rounded-full bg-accent flex items-center justify-center text-center text-accent-foreground font-bold text-lg md:text-xl p-2"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {coinTextP2}
          </motion.div>
        </motion.div>
      </div>
      {showWinner && !isFlipping && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-6 text-2xl font-bold text-accent"
        >
          {(winningPlayerName === player1Name ? player1Name : player2Name)} wins the toss!
        </motion.p>
      )}
    </div>
  );
}
