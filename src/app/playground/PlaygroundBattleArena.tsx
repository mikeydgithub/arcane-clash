'use client';

import { MonsterCardData } from '@/types';
import { CardView } from '@/components/game/CardView';

interface PlaygroundBattleArenaProps {
  player1Card?: MonsterCardData;
  player2Card?: MonsterCardData;
  onHpChange: (monster: 'p1' | 'p2', amount: number) => void;
}

export function PlaygroundBattleArena({ player1Card, player2Card, onHpChange }: PlaygroundBattleArenaProps) {
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <h3 className="text-xl font-semibold mb-4">Player 1 Active Monster</h3>
        {player1Card ? (
          <div>
            <CardView card={player1Card} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => onHpChange('p1', -1)} className="px-2 py-1 bg-red-500 rounded">-1 HP</button>
              <button onClick={() => onHpChange('p1', 1)} className="px-2 py-1 bg-green-500 rounded">+1 HP</button>
            </div>
          </div>
        ) : <div className="w-48 h-64 bg-gray-800 rounded-lg flex items-center justify-center">No active monster</div>}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-4">Player 2 Active Monster</h3>
        {player2Card ? (
          <div>
            <CardView card={player2Card} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => onHpChange('p2', -1)} className="px-2 py-1 bg-red-500 rounded">-1 HP</button>
              <button onClick={() => onHpChange('p2', 1)} className="px-2 py-1 bg-green-500 rounded">+1 HP</button>
            </div>
          </div>
        ) : <div className="w-48 h-64 bg-gray-800 rounded-lg flex items-center justify-center">No active monster</div>}
      </div>
    </div>
  );
}
