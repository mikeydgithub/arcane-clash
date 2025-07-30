
export interface StatusEffect {
  id: string; // Unique ID for this specific application of the effect
  type: 'regenerate' | 'shield' | 'stun' | 'silence' | 'ethereal' | 'empower' | 'frostbite'; // Can be expanded to other types like 'poison'
  duration: number; // Number of turns remaining for the effect
  value: number; // Potency of the effect (e.g., HP healed per turn for regenerate, shield health for shield, 50 for 50% ethereal reduction)
  // Potentially add sourceCardId if needed for complex interactions later
}

export interface BaseCardData {
  id: string;
  title: string;
  artUrl?: string;
  isLoadingArt: boolean;
  description?: string;
  isLoadingDescription?: boolean;
}

export interface MonsterCardData extends BaseCardData {
  cardType: 'Monster';
  melee: number;
  magic: number;
  hp: number;
  maxHp: number;
  statusEffects?: StatusEffect[];
  hasDominantStatAura?: boolean;
  hasFocusedMindBuff?: boolean;
  hasMightInfusion?: boolean;
  hasGrowthSpurt?: boolean;
  hasAmbush?: boolean; // On Play
  hasLifeSteal?: boolean; // On Attack
  hasSpikedArmor?: boolean; // On Damage
  hasFinalGift?: boolean; // On Death
}

export interface SpellCardData extends BaseCardData {
  cardType: 'Spell';
}

export type CardData = MonsterCardData | SpellCardData;

export interface PlayerData {
  id: 'p1' | 'p2';
  name: string;
  hp: number;
  hand: CardData[];
  deck: CardData[];
  discardPile: CardData[];
  avatarUrl?: string;
  spellsPlayedThisTurn: number;
  turnCount: number; // Added to track player's turn number
  hasMulliganed: boolean;
  monsterJustPlayed: boolean; // Flag for "summoning sickness"
}

export type GamePhase =
  | "initial"
  | "coin_flip_animation"
  | "loading_art"
  | "mulligan_phase"
  | "player_action_phase" // Player decides to play monster, spell, attack, or initiate swap
  | "selecting_swap_monster_phase" // Player is selecting a monster from hand to swap with active one
  | "combat_phase"        // Monster vs Monster or Monster vs Player
  | "game_over_phase"
  | "turn_transition";

export interface IndicatorState {
  p1MonsterDamage: number | null;
  p2MonsterDamage: number | null;
  p1PlayerDamage: number | null;
  p2PlayerDamage: number | null;
  p1MonsterHeal: number | null;
  p2MonsterHeal: number | null;
  p1PlayerHeal: number | null;
  p2PlayerHeal: number | null;
}

export type LogEntryType = 'system' | 'player1' | 'player2' | 'damage' | 'heal' | 'info';

export interface GameLogEntry {
  id: string;
  text: string;
  type: LogEntryType;
}

export interface GameState {
  players: [PlayerData, PlayerData];
  currentPlayerIndex: 0 | 1; // Index of the player whose turn it is to act
  gamePhase: GamePhase;
  activeMonsterP1?: MonsterCardData; // Monster P1 has in the arena
  activeMonsterP2?: MonsterCardData; // Monster P2 has in the arena
  winner?: PlayerData;
  gameLogMessages: GameLogEntry[];
  isProcessingAction?: boolean; // To disable inputs during animations/AI calls
  indicators: IndicatorState;
}

    
