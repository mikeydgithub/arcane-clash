
export interface CardData {
  id: string;
  title: string;
  artUrl?: string;
  isLoadingArt: boolean;
  magic: number;
  melee: number;
  defense: number; // Physical defense
  hp: number;
  maxHp: number;
  shield: number; // Physical shield
  maxShield: number; // Max physical shield
  magicShield: number;
  maxMagicShield: number;
  description: string;
}

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
  | "combat_animation"
  | "combat_resolution" // This phase might be implicitly handled by combat_animation now
  | "combat_summary"
  | "game_over";

export interface GameState {
  players: [PlayerData, PlayerData];
  currentPlayerIndex: 0 | 1;
  gamePhase: GamePhase;
  selectedCardP1?: CardData;
  selectedCardP2?: CardData;
  winner?: PlayerData;
  gameLogMessages: string[];
}
