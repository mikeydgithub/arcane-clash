'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CardSelector } from './CardSelector';
import { createInitialPlaygroundState } from './playground-state';
import { generateMonsterCards, generateSpellCards } from '@/lib/game-utils';
import { CardData, MonsterCardData, PlayerData, SpellCardData } from '@/types';
import { PlaygroundPlayerHand } from '@/components/game/PlaygroundPlayerHand';
import { PlaygroundBattleArena } from './PlaygroundBattleArena';
import { DiscardPile } from './DiscardPile';
import { CardFilter, CardFilterState } from './CardFilter';
import { Button } from '@/components/ui/button';
import { RotateCcw, Home } from 'lucide-react';

export default function PlaygroundPage() {
  const [gameState, setGameState] = useState(createInitialPlaygroundState());
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<'p1' | 'p2'>('p1');
  const [filterState, setFilterState] = useState<CardFilterState>({ monster: true, monster_effects: true, spell: true });

  useEffect(() => {
    async function loadCards() {
      const monsters = await generateMonsterCards();
      const spells = await generateSpellCards();
      setAllCards([...monsters, ...spells]);
    }
    loadCards();
  }, []);

  const handleAddCardToHand = (card: CardData) => {
    setGameState(prevState => {
      const newPlayers = prevState.players.map(p => {
        if (p.id === selectedPlayer) {
          const newHand = [...p.hand, { ...card, id: `${card.id}-${Date.now()}` }];
          return { ...p, hand: newHand };
        }
        return p;
      }) as [PlayerData, PlayerData];
      return { ...prevState, players: newPlayers };
    });
  };

  const handlePlayCardFromHand = (card: CardData, playerId: 'p1' | 'p2') => {
    setGameState(prevState => {
      const playerIndex = prevState.players.findIndex(p => p.id === playerId);
      const newPlayers = [...prevState.players] as [PlayerData, PlayerData];
      const player = newPlayers[playerIndex];
      const newHand = player.hand.filter(c => c.id !== card.id);
      newPlayers[playerIndex] = { ...player, hand: newHand };

      if (card.cardType === 'Monster') {
        const activeMonsterKey = playerId === 'p1' ? 'activeMonsterP1' : 'activeMonsterP2';
        return {
          ...prevState,
          players: newPlayers,
          [activeMonsterKey]: card as MonsterCardData,
        };
      } else if (card.cardType === 'Spell') {
        const spell = card as SpellCardData;
        let newActiveMonsterP1 = prevState.activeMonsterP1;
        let newActiveMonsterP2 = prevState.activeMonsterP2;

        switch (spell.title) {
          case 'Fireball':
            if (playerId === 'p1' && newActiveMonsterP2) {
              newActiveMonsterP2 = { ...newActiveMonsterP2, hp: newActiveMonsterP2.hp - 15 };
            } else if (playerId === 'p2' && newActiveMonsterP1) {
              newActiveMonsterP1 = { ...newActiveMonsterP1, hp: newActiveMonsterP1.hp - 15 };
            }
            break;
          case 'Healing Light':
            if (playerId === 'p1' && newActiveMonsterP1) {
              newActiveMonsterP1 = { ...newActiveMonsterP1, hp: newActiveMonsterP1.hp + 20 };
            } else if (playerId === 'p2' && newActiveMonsterP2) {
              newActiveMonsterP2 = { ...newActiveMonsterP2, hp: newActiveMonsterP2.hp + 20 };
            }
            break;
          case 'Terrify':
            if (playerId === 'p1' && newActiveMonsterP2) {
              newPlayers[1].discardPile.push(newActiveMonsterP2);
              newActiveMonsterP2 = undefined;
            } else if (playerId === 'p2' && newActiveMonsterP1) {
              newPlayers[0].discardPile.push(newActiveMonsterP1);
              newActiveMonsterP1 = undefined;
            }
            break;
        }
        newPlayers[playerIndex].discardPile.push(card);
        return {
          ...prevState,
          players: newPlayers,
          activeMonsterP1: newActiveMonsterP1,
          activeMonsterP2: newActiveMonsterP2,
        };
      }
      return prevState;
    });
  };

  const handleHpChange = (monster: 'p1' | 'p2', amount: number) => {
    setGameState(prevState => {
      const key = monster === 'p1' ? 'activeMonsterP1' : 'activeMonsterP2';
      const activeMonster = prevState[key];
      if (!activeMonster) return prevState;

      const newMonster = { ...activeMonster, hp: activeMonster.hp + amount };
      return { ...prevState, [key]: newMonster };
    });
  };

  const handleResetPlayground = () => {
    setGameState(createInitialPlaygroundState());
  };

  const filteredCards = allCards.filter(card => {
    if (filterState.monster && card.cardType === 'Monster' && !(card as MonsterCardData).hasAmbush && !(card as MonsterCardData).hasLifeSteal && !(card as MonsterCardData).hasSpikedArmor && !(card as MonsterCardData).hasFinalGift) return true;
    if (filterState.monster_effects && card.cardType === 'Monster' && ((card as MonsterCardData).hasAmbush || (card as MonsterCardData).hasLifeSteal || (card as MonsterCardData).hasSpikedArmor || (card as MonsterCardData).hasFinalGift)) return true;
    if (filterState.spell && card.cardType === 'Spell') return true;
    return false;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Card Playground</h1>
        <div className="flex gap-2">
          <Button onClick={handleResetPlayground} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Playground
          </Button>
          <Link href="/" passHref>
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Back to Game
            </Button>
          </Link>
        </div>
      </div>
      
      <PlaygroundBattleArena 
        player1Card={gameState.activeMonsterP1} 
        player2Card={gameState.activeMonsterP2} 
        onHpChange={handleHpChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Player 1 Hand</h2>
          <PlaygroundPlayerHand 
            cards={gameState.players[0].hand} 
            onCardSelect={(card) => handlePlayCardFromHand(card, 'p1')} 
            isPlayerTurn={true}
          />
          <div className="mt-4">
            <DiscardPile cards={gameState.players[0].discardPile} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Player 2 Hand</h2>
          <PlaygroundPlayerHand 
            cards={gameState.players[1].hand} 
            onCardSelect={(card) => handlePlayCardFromHand(card, 'p2')} 
            isPlayerTurn={true}
          />
          <div className="mt-4">
            <DiscardPile cards={gameState.players[1].discardPile} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center mb-4">
            <h2 className="text-2xl font-semibold">Add card to:</h2>
            <div className="ml-4 flex gap-2">
                <button onClick={() => setSelectedPlayer('p1')} className={`px-4 py-2 rounded ${selectedPlayer === 'p1' ? 'bg-blue-500' : 'bg-gray-700'}`}>Player 1</button>
                <button onClick={() => setSelectedPlayer('p2')} className={`px-4 py-2 rounded ${selectedPlayer === 'p2' ? 'bg-blue-500' : 'bg-gray-700'}`}>Player 2</button>
            </div>
        </div>
        <div className="mb-4">
          <CardFilter filterState={filterState} onFilterChange={setFilterState} />
        </div>
        <CardSelector cards={filteredCards} onCardSelected={handleAddCardToHand} />
      </div>
    </div>
  );
}
