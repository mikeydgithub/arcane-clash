
export interface BaseCardData {
  id: string;
  title: string;
  artUrl?: string;
  isLoadingArt: boolean;
  description?: string; // For Monsters: flavor text. For Spells: effect description.
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
  // Future: Specific effect properties like target, power, duration could be added here.
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
  | "player1_select_card"
  | "player2_select_card"
  | "combat_animation" // This phase will now also show spells being "cast"
  | "combat_resolution" // Renamed from combat_summary to reflect turn resolution
  | "game_over";

export interface GameState {
  players: [PlayerData, PlayerData];
  currentPlayerIndex: 0 | 1;
  gamePhase: GamePhase;
  selectedCardP1?: CardData; // Can be Monster or Spell
  selectedCardP2?: CardData; // Can be Monster or Spell
  winner?: PlayerData;
  gameLogMessages: string[];
}
