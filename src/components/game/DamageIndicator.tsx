
'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface DamageIndicatorProps {
  damage: number | null;
}

export function DamageIndicator({ damage }: DamageIndicatorProps) {
  return (
    <AnimatePresence>
      {damage !== null && damage > 0 && (
        <motion.div
          key={`damage-${damage}`} // Re-trigger animation only when the damage value changes, not on every render.
          initial={{ opacity: 1, y: 0, scale: 0.8 }}
          animate={{ opacity: 0, y: -60, scale: 1.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute z-30 flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-destructive rounded-full shadow-2xl pointer-events-none"
          style={{ 
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
           }}
        >
          <span className="text-2xl md:text-3xl font-black text-destructive-foreground">
            -{damage}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

    