
export interface CardData {
  id: string;
  title: string;
  artUrl?: string; 
  isLoadingArt: boolean;
  magic: number;
  melee: number;
  defense: number;
  hp: number; 
  maxHp: number; 
  shield: number; 
  maxShield: number;
  description: string; 
}

export interface PlayerData {
  id: string;
  name: string;
  hp: number;
  hand: CardData[];
  deck: CardData[];
  discardPile: CardData[];
}

export type GamePhase = 
  | "initial"
  | "loading_art"
  | "player1_select_card" 
  | "player2_select_card" 
  | "combat_animation"
  | "combat_resolution" // This phase might be very short or merged into combat_summary
  | "combat_summary" // New: After combat, showing results, waiting for player to continue
  | "game_over";

export interface GameState {
  players: [PlayerData, PlayerData];
  currentPlayerIndex: 0 | 1;
  gamePhase: GamePhase;
  selectedCardP1?: CardData; // Card in arena for P1
  selectedCardP2?: CardData; // Card in arena for P2
  winner?: PlayerData;
  turnLogMessages: string[]; // Changed from battleMessage: string
}
