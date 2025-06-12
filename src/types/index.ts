
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
  defense: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  magicShield: number;
  maxMagicShield: number;
}

export interface SpellCardData extends BaseCardData {
  cardType: 'Spell';
}

export type CardData = MonsterCardData | SpellCardData;

export interface PlayerData {
  id: string;
  name: string;
  hp: number;
  hand: CardData[];
  deck: CardData[];
  discardPile: CardData[];
  avatarUrl?: string;
}

export type GamePhase =
  | "initial"
  | "coin_flip_animation"
  | "loading_art"
  | "player_action_phase" // Player decides to play monster, spell, attack, or retreat
  | "spell_effect_phase"  // Visualizing spell effect (mostly logging for now)
  | "combat_phase"        // Monster vs Monster or Monster vs Player
  | "turn_resolution_phase" // After action: check defeated monsters, draw card, check game over
  | "game_over_phase";

export interface GameState {
  players: [PlayerData, PlayerData];
  currentPlayerIndex: 0 | 1; // Index of the player whose turn it is to act
  gamePhase: GamePhase;
  activeMonsterP1?: MonsterCardData; // Monster P1 has in the arena
  activeMonsterP2?: MonsterCardData; // Monster P2 has in the arena
  winner?: PlayerData;
  gameLogMessages: string[];
  isProcessingAction?: boolean; // To disable inputs during animations/AI calls
  isInitialMonsterEngagement: boolean; // True if no monster has been played yet, false otherwise
}

