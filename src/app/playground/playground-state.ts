import { GameState, PlayerData, CardData } from '@/types';

export function createInitialPlaygroundState(): GameState {
  // For now, we'll create a simplified initial state.
  // We can expand this later to allow for more complex scenarios.
  const player1: PlayerData = {
    id: 'p1',
    name: 'Player 1',
    hp: 30,
    hand: [],
    deck: [],
    discardPile: [],
    avatarUrl: '/avatars/arcane-warrior.png',
    spellsPlayedThisTurn: 0,
    turnCount: 0,
    hasMulliganed: true,
    monsterJustPlayed: false,
  };

  const player2: PlayerData = {
    id: 'p2',
    name: 'Player 2',
    hp: 30,
    hand: [],
    deck: [],
    discardPile: [],
    avatarUrl: '/avatars/arcane-mage.png',
    spellsPlayedThisTurn: 0,
    turnCount: 0,
    hasMulliganed: true,
    monsterJustPlayed: false,
  };

  return {
    players: [player1, player2],
    currentPlayerIndex: 0,
    gamePhase: 'player_action_phase',
    activeMonsterP1: undefined,
    activeMonsterP2: undefined,
    winner: undefined,
    gameLogMessages: [],
    isProcessingAction: false,
    indicators: {
        p1MonsterDamage: null,
        p2MonsterDamage: null,
        p1PlayerDamage: null,
        p2PlayerDamage: null,
        p1MonsterHeal: null,
        p2MonsterHeal: null,
        p1PlayerHeal: null,
        p2PlayerHeal: null,
    },
  };
}
