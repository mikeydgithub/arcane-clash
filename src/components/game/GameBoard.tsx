'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CardData, GameState, PlayerData, GamePhase } from '@/types';
import { generateInitialCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { generateCardArt, type GenerateCardArtInput } from '@/ai/flows/generate-card-art';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [artGenerationProgress, setArtGenerationProgress] = useState(0);
  const { toast } = useToast();

  const initializeGame = useCallback(() => {
    const initialCards = generateInitialCards();
    const shuffledDeck = shuffleDeck(initialCards);

    const p1CardsToDeal = Math.min(CARDS_IN_HAND, shuffledDeck.length);
    const { dealtCards: p1InitialHand, remainingDeck: deckAfterP1Deal } = dealCards(shuffledDeck, p1CardsToDeal);
    
    const p2CardsToDeal = Math.min(CARDS_IN_HAND, deckAfterP1Deal.length);
    const { dealtCards: p2InitialHand, remainingDeck: finalDeck } = dealCards(deckAfterP1Deal, p2CardsToDeal);

    setGameState({
      players: [
        { id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP, hand: p1InitialHand },
        { id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP, hand: p2InitialHand },
      ],
      deck: finalDeck,
      discardPile: [],
      currentPlayerIndex: 0,
      gamePhase: 'loading_art',
      selectedCardP1: undefined,
      selectedCardP2: undefined,
      winner: undefined,
      battleMessage: "Let the arcane clash begin!",
    });
    setArtGenerationProgress(0);

    // Generate card art
    let artLoadedCount = 0;
    const totalCards = initialCards.length;

    initialCards.forEach(async (card) => {
      try {
        const artInput: GenerateCardArtInput = { cardTitle: card.title };
        const result = await generateCardArt(artInput);
        
        setGameState(prev => {
          if (!prev) return null;
          const updateCardInCollection = (collection: CardData[]) => 
            collection.map(c => c.id === card.id ? { ...c, artUrl: result.cardArtDataUri, isLoadingArt: false } : c);
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInCollection(p.hand) })) as [PlayerData, PlayerData],
            deck: updateCardInCollection(prev.deck),
          };
        });
      } catch (error) {
        console.error(`Failed to generate art for ${card.title}:`, error);
        toast({ title: "Art Generation Error", description: `Could not generate art for ${card.title}. Using placeholder.`, variant: "destructive" });
        setGameState(prev => {
           if (!prev) return null;
           const updateCardInCollection = (collection: CardData[]) => 
            collection.map(c => c.id === card.id ? { ...c, isLoadingArt: false } : c); // Mark as not loading even on error
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInCollection(p.hand) })) as [PlayerData, PlayerData],
            deck: updateCardInCollection(prev.deck),
          };
        });
      } finally {
        artLoadedCount++;
        setArtGenerationProgress((artLoadedCount / totalCards) * 100);
        if (artLoadedCount === totalCards) {
          setGameState(prev => prev ? { ...prev, gamePhase: 'player1_select_card', battleMessage: "Player 1, select your champion!" } : null);
        }
      }
    });
  }, [toast]);

  useEffect(() => {
    // This effect only runs once on mount to set the initial state if no game is active.
    // It doesn't auto-start the game to allow a "Start Game" button.
    if (!gameState) {
      setGameState({
        players: [
          { id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP, hand: [] },
          { id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP, hand: [] },
        ],
        deck: [],
        discardPile: [],
        currentPlayerIndex: 0,
        gamePhase: 'initial',
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        winner: undefined,
        battleMessage: "Welcome to Arcane Clash!",
      });
    }
  }, [gameState]);


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', battleMessage: "Player 2, choose your defender!" } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation' } : null);
      // Trigger combat after a short delay for animation
      setTimeout(() => resolveCombat(), 1500); // Delay for "CLASH" animation
    }
  };

  const resolveCombat = () => {
    setGameState(prev => {
      if (!prev || !prev.selectedCardP1 || !prev.selectedCardP2) return prev;

      let { players, selectedCardP1, selectedCardP2, discardPile } = { ...prev };
      let battleLog = "";

      const p1 = { ...players[0] };
      const p2 = { ...players[1] };
      const card1 = { ...selectedCardP1 };
      const card2 = { ...selectedCardP2 };

      // Combat logic
      const attackP1 = card1.melee + card1.magic;
      const attackP2 = card2.melee + card2.magic;

      // Card 1 attacks Card 2
      let damageToCard2 = Math.max(0, attackP1 - card2.shield);
      card2.shield = Math.max(0, card2.shield - attackP1);
      card2.hp -= damageToCard2;
      battleLog += `${card1.title} attacks ${card2.title} for ${attackP1} (shield absorbs ${selectedCardP2.shield - card2.shield}).\n`;


      // Card 2 attacks Card 1
      let damageToCard1 = Math.max(0, attackP2 - card1.shield);
      card1.shield = Math.max(0, card1.shield - attackP2);
      card1.hp -= damageToCard1;
      battleLog += `${card2.title} counter-attacks ${card1.title} for ${attackP2} (shield absorbs ${selectedCardP1.shield - card1.shield}).\n`;


      if (card2.hp <= 0) {
        const damageToP2 = Math.max(0, attackP1 - selectedCardP2.defense);
        p2.hp = Math.max(0, p2.hp - damageToP2);
        battleLog += `${card2.title} is defeated! Player 2 takes ${damageToP2} damage.\n`;
      }
      if (card1.hp <= 0) {
        const damageToP1 = Math.max(0, attackP2 - selectedCardP1.defense);
        p1.hp = Math.max(0, p1.hp - damageToP1);
        battleLog += `${card1.title} is defeated! Player 1 takes ${damageToP1} damage.\n`;
      }
      
      // Update hands and discard pile
      p1.hand = p1.hand.filter(c => c.id !== card1.id);
      p2.hand = p2.hand.filter(c => c.id !== card2.id);
      discardPile = [...discardPile, selectedCardP1, selectedCardP2];
      
      let newGamePhase: GamePhase = prev.currentPlayerIndex === 0 ? 'player2_select_card' : 'player1_select_card';
      let winner: PlayerData | undefined = undefined;

      if (p1.hp <= 0 && p2.hp <= 0) {
        winner = undefined; // Draw
        newGamePhase = 'game_over';
        battleLog += "It's a draw!";
      } else if (p1.hp <= 0) {
        winner = players[1];
        newGamePhase = 'game_over';
        battleLog += `${players[1].name} wins!`;
      } else if (p2.hp <= 0) {
        winner = players[0];
        newGamePhase = 'game_over';
        battleLog += `${players[0].name} wins!`;
      }
      
      // Next turn logic if game not over
      let nextPlayerIndex = prev.currentPlayerIndex;
      let currentDeck = prev.deck;
      if (newGamePhase !== 'game_over') {
        nextPlayerIndex = prev.currentPlayerIndex === 0 ? 1 : 0;
        
        // Draw cards for current player (who just finished attacking/defending)
        const playerToDrawFor = players[prev.currentPlayerIndex];
        const cardsNeeded = CARDS_IN_HAND - playerToDrawFor.hand.length;
        if (cardsNeeded > 0 && currentDeck.length > 0) {
          const cardsToDeal = Math.min(cardsNeeded, currentDeck.length);
          const { dealtCards, remainingDeck } = dealCards(currentDeck, cardsToDeal);
          if (prev.currentPlayerIndex === 0) p1.hand = [...p1.hand, ...dealtCards];
          else p2.hand = [...p2.hand, ...dealtCards];
          currentDeck = remainingDeck;
          battleLog += `\n${playerToDrawFor.name} draws ${dealtCards.length} card(s).`;
        }
        
        // Draw cards for next player
        const nextPlayerToDrawFor = players[nextPlayerIndex];
        const nextPlayerCardsNeeded = CARDS_IN_HAND - nextPlayerToDrawFor.hand.length;
         if (nextPlayerCardsNeeded > 0 && currentDeck.length > 0) {
          const cardsToDeal = Math.min(nextPlayerCardsNeeded, currentDeck.length);
          const { dealtCards, remainingDeck } = dealCards(currentDeck, cardsToDeal);
          if (nextPlayerIndex === 0) p1.hand = [...p1.hand, ...dealtCards];
          else p2.hand = [...p2.hand, ...dealtCards];
          currentDeck = remainingDeck;
          battleLog += `\n${nextPlayerToDrawFor.name} draws ${dealtCards.length} card(s).`;
        }
        battleLog += `\n${players[nextPlayerIndex].name}'s turn. Select a card.`;
      }
      
      return {
        ...prev,
        players: [p1, p2],
        deck: currentDeck,
        discardPile,
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        gamePhase: newGamePhase,
        currentPlayerIndex: nextPlayerIndex as 0 | 1,
        winner,
        battleMessage: battleLog.trim(),
      };
    });
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">Loading Arcane Clash...</p>
      </div>
    );
  }
  
  const { players, deck, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, battleMessage } = gameState;
  const player1 = players[0];
  const player2 = players[1];

  if (gamePhase === 'initial') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <h1 className="text-5xl font-bold text-primary mb-8 tracking-wide">Arcane Clash</h1>
        <Button onClick={initializeGame} size="lg" className="px-10 py-6 text-2xl bg-accent hover:bg-accent/90">
          Start Battle
        </Button>
      </div>
    );
  }

  if (gamePhase === 'loading_art') {
     return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl mb-2">Conjuring Card Artwork...</p>
        <div className="w-1/2 bg-muted rounded-full h-4">
          <div 
            className="bg-primary h-4 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${artGenerationProgress}%`}}
          ></div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{Math.round(artGenerationProgress)}% Complete</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground p-2 md:p-4">
      {/* Player 2 Area (Top) */}
      <div className="flex justify-between items-start mb-2 md:mb-4">
        <PlayerStatusDisplay player={player2} isCurrentPlayer={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'} isOpponent={true}/>
        {/* Optionally show a message or deck count here */}
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Deck: {deck.length}</p>
        </div>
      </div>
      <PlayerHand 
        cards={player2.hand} 
        onCardSelect={handleCardSelect} 
        isPlayerTurn={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'}
        isOpponent={true}
        selectedCardId={selectedCardP2?.id}
      />

      {/* Battle Arena (Middle) */}
      <BattleArena 
        player1Card={selectedCardP1} 
        player2Card={selectedCardP2} 
        showClashAnimation={gamePhase === 'combat_animation'}
        battleMessage={battleMessage}
      />

      {/* Player 1 Area (Bottom) */}
      <PlayerHand 
        cards={player1.hand} 
        onCardSelect={handleCardSelect} 
        isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'}
        selectedCardId={selectedCardP1?.id}
      />
      <div className="flex justify-between items-end mt-2 md:mt-4">
         <PlayerStatusDisplay player={player1} isCurrentPlayer={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'} />
         {/* Other controls or info */}
      </div>
      
      <GameOverModal 
        isOpen={gamePhase === 'game_over'} 
        winnerName={winner?.name}
        onRestart={initializeGame} 
      />
    </div>
  );
}
