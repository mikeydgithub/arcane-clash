
export interface StatusEffect {
  id: string; // Unique ID for this specific application of the effect
  type: 'regenerate'; // Can be expanded to other types like 'poison', 'stunned', etc.
  duration: number; // Number of turns remaining for the effect
  value: number; // Potency of the effect (e.g., HP healed per turn for regenerate)
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
  defense: number;
  hp: number;
  maxHp: number;
  statusEffects?: StatusEffect[];
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
  spellsPlayedThisTurn: number;
  turnCount: number; // Added to track player's turn number
  hasMulliganed: boolean;
}

export type GamePhase =
  | "initial"
  | "coin_flip_animation"
  | "loading_art"
  | "mulligan_phase"
  | "player_action_phase" // Player decides to play monster, spell, attack, or initiate swap
  | "selecting_swap_monster_phase" // Player is selecting a monster from hand to swap with active one
  | "spell_effect_phase"  // Visualizing spell effect (mostly logging for now) - May be used less if turn doesn't always end
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
