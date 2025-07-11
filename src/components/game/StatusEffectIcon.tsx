
'use client';

import type { StatusEffect } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, HeartPulse, ZapOff, MicOff, Ghost, Power } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatusEffectIconProps {
  effect: StatusEffect;
}

const effectDetails = {
  shield: {
    icon: Shield,
    label: 'Shield',
    description: (value: number) => `Absorbs up to ${value} damage.`,
    color: 'text-sky-400',
  },
  regenerate: {
    icon: HeartPulse,
    label: 'Regenerate',
    description: (value: number) => `Heals ${value} HP at the start of the owner's turn.`,
    color: 'text-emerald-400',
  },
  stun: {
    icon: ZapOff,
    label: 'Stun',
    description: () => `Cannot perform actions.`,
    color: 'text-yellow-400',
  },
  silence: {
    icon: MicOff,
    label: 'Silence',
    description: () => `Cannot use abilities.`,
    color: 'text-purple-400',
  },
  ethereal: {
    icon: Ghost,
    label: 'Ethereal',
    description: (value: number) => `Takes ${value}% reduced damage.`,
    color: 'text-slate-400',
  },
  empower: {
    icon: Power,
    label: 'Empower Weapon',
    description: (value: number) => `Next melee attack deals x${value} damage.`,
    color: 'text-orange-500',
  },
};

export function StatusEffectIcon({ effect }: StatusEffectIconProps) {
  const details = effectDetails[effect.type];
  if (!details) return null;

  const IconComponent = details.icon;

  const tooltipContent = (
    <div className="text-center">
      <p className="font-bold">{details.label}</p>
      <p className="text-xs">{details.description(effect.value)}</p>
      <p className="text-xs text-muted-foreground italic">
        {effect.duration > 90 ? 'Lasts until broken' : effect.type === 'empower' ? 'Consumed on next melee attack' : `Turns remaining: ${effect.duration}`}
      </p>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-background/80 border border-border"
          >
            <IconComponent className={cn('h-5 w-5', details.color)} />
            <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {effect.type === 'shield' ? effect.value : effect.type === 'empower' ? `x${effect.value}` : (effect.duration > 90 ? '∞' : effect.duration)}
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-[180px] p-2">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
