
'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TurnIndicatorProps {
  currentPlayerIndex: 0 | 1;
}

export function TurnIndicator({ currentPlayerIndex }: TurnIndicatorProps) {
  const isPlayer1Turn = currentPlayerIndex === 0;
  const isPlayer2Turn = currentPlayerIndex === 1;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="flex items-center justify-center w-24 h-24">
        {/* Player 1 Indicator (Left) */}
        <motion.div
          animate={{
            color: isPlayer1Turn ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
            opacity: isPlayer1Turn ? 1 : 0.4,
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className={cn('flex-1 text-right', isPlayer1Turn && 'indicator-active')}
        >
          <ChevronLeft className="w-12 h-12" />
        </motion.div>

        {/* Separator */}
        <div className="w-px h-10 bg-border mx-2" />

        {/* Player 2 Indicator (Right) */}
        <motion.div
          animate={{
            color: isPlayer2Turn ? 'hsl(var(--accent))' : 'hsl(var(--muted))',
            opacity: isPlayer2Turn ? 1 : 0.4,
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className={cn('flex-1 text-left', isPlayer2Turn && 'indicator-active')}
        >
          <ChevronRight className="w-12 h-12" />
        </motion.div>
      </div>
    </div>
  );
}
