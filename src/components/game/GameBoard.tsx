
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
    const initialCardsData = generateInitialCards();
    const shuffledDeck = shuffleDeck(initialCardsData);

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

    let artLoadedCount = 0;
    const totalCardsToLoad = initialCardsData.length;

    initialCardsData.forEach(async (card) => {
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
            collection.map(c => c.id === card.id ? { ...c, isLoadingArt: false } : c);
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInCollection(p.hand) })) as [PlayerData, PlayerData],
            deck: updateCardInCollection(prev.deck),
          };
        });
      } finally {
        artLoadedCount++;
        setArtGenerationProgress((artLoadedCount / totalCardsToLoad) * 100);
        if (artLoadedCount === totalCardsToLoad) {
          setGameState(prev => prev ? { ...prev, gamePhase: 'player1_select_card', battleMessage: "Player 1, select your champion!" } : null);
        }
      }
    });
  }, [toast]);

  useEffect(() => {
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
    const { currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2 } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0 && !selectedCardP1) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, battleMessage: "Player 2, choose your defender!" } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1 && !selectedCardP2) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', battleMessage: "CLASH!" } : null);
      setTimeout(() => resolveCombat(), 1500); 
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
      const card1Combat = { ...selectedCardP1 }; 
      const card2 = { ...selectedCardP2 }; 
      const card2Combat = { ...selectedCardP2 }; 

      const attackP1 = card1Combat.melee + card1Combat.magic;
      const attackP2 = card2Combat.melee + card2Combat.magic;

      const shieldAbsorbedByC2 = Math.min(card2Combat.shield, attackP1);
      card2Combat.shield -= shieldAbsorbedByC2;
      const damageToCard2Hp = Math.max(0, attackP1 - shieldAbsorbedByC2 - card2.defense);
      card2Combat.hp -= damageToCard2Hp;
      battleLog += `${card1Combat.title} attacks ${card2Combat.title} for ${attackP1}. ${card2Combat.title} defense blocks ${card2.defense}, shield absorbs ${shieldAbsorbedByC2}. ${card2Combat.title} takes ${damageToCard2Hp} HP damage.\n`;

      if (card2Combat.hp > 0) {
        const shieldAbsorbedByC1 = Math.min(card1Combat.shield, attackP2);
        card1Combat.shield -= shieldAbsorbedByC1;
        const damageToCard1Hp = Math.max(0, attackP2 - shieldAbsorbedByC1 - card1.defense);
        card1Combat.hp -= damageToCard1Hp;
        battleLog += `${card2Combat.title} counter-attacks ${card1Combat.title} for ${attackP2}. ${card1Combat.title} defense blocks ${card1.defense}, shield absorbs ${shieldAbsorbedByC1}. ${card1Combat.title} takes ${damageToCard1Hp} HP damage.\n`;
      } else {
         battleLog += `${card2Combat.title} was defeated before it could counter-attack.\n`;
      }

      if (card1Combat.hp <= 0) {
        battleLog += `${card1Combat.title} is defeated! `;
      }
       if (card2Combat.hp <= 0) {
        battleLog += `${card2Combat.title} is defeated! `;
        const directDamageToP2 = Math.max(0, (selectedCardP1.melee + selectedCardP1.magic) - selectedCardP2.defense);
        p2.hp = Math.max(0, p2.hp - directDamageToP2);
        battleLog += `Player 2 takes ${directDamageToP2} direct damage.\n`;
      }
      
      p1.hand = p1.hand.filter(c => c.id !== card1Combat.id);
      p2.hand = p2.hand.filter(c => c.id !== card2Combat.id);
      
      discardPile = [...discardPile, selectedCardP1, selectedCardP2]; 
      
      let newGamePhase: GamePhase = 'player1_select_card';
      let winner: PlayerData | undefined = undefined;
      let nextPlayerIdx = 0; 

      if (p1.hp <= 0 && p2.hp <= 0) {
        winner = undefined; 
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
      
      let currentDeck = prev.deck;
      if (newGamePhase !== 'game_over') {
        const p1CardsNeeded = CARDS_IN_HAND - p1.hand.length;
        if (p1CardsNeeded > 0 && currentDeck.length > 0) {
          const p1Deal = dealCards(currentDeck, Math.min(p1CardsNeeded, currentDeck.length));
          p1.hand = [...p1.hand, ...p1Deal.dealtCards];
          currentDeck = p1Deal.remainingDeck;
          battleLog += `\nPlayer 1 draws ${p1Deal.dealtCards.length} card(s).`;
        }
        
        const p2CardsNeeded = CARDS_IN_HAND - p2.hand.length;
        if (p2CardsNeeded > 0 && currentDeck.length > 0) {
          const p2Deal = dealCards(currentDeck, Math.min(p2CardsNeeded, currentDeck.length));
          p2.hand = [...p2.hand, ...p2Deal.dealtCards];
          currentDeck = p2Deal.remainingDeck;
          battleLog += `\nPlayer 2 draws ${p2Deal.dealtCards.length} card(s).`;
        }
        battleLog += `\nPlayer 1's turn. Select a card.`;
        nextPlayerIdx = 0; 
      }
      
      return {
        ...prev,
        players: [p1, p2],
        deck: currentDeck,
        discardPile,
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        gamePhase: newGamePhase,
        currentPlayerIndex: nextPlayerIdx as 0 | 1,
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
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">
      {/* Player 1 Column (Left) */}
      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-2 md:space-y-4 flex-shrink-0">
        <PlayerStatusDisplay 
          player={player1} 
          isCurrentPlayer={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'} 
        />
        <PlayerHand 
          cards={player1.hand} 
          onCardSelect={handleCardSelect} 
          isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'}
          selectedCardId={selectedCardP1?.id}
          hasCommittedCard={!!selectedCardP1}
          isOpponent={false} // Explicitly false for Player 1
        />
      </div>

      {/* Battle Arena (Middle) */}
      <div className="flex-grow flex flex-col items-center justify-center min-w-0">
        <BattleArena 
          player1Card={selectedCardP1} 
          player2Card={selectedCardP2} 
          showClashAnimation={gamePhase === 'combat_animation' && !!selectedCardP1 && !!selectedCardP2}
          battleMessage={battleMessage}
        />
      </div>
      

      {/* Player 2 Column (Right) */}
      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-2 md:space-y-4 flex-shrink-0">
        <div className="w-full flex justify-end">
            <p className="text-xs text-muted-foreground">Deck: {deck.length}</p>
        </div>
        <PlayerStatusDisplay 
            player={player2} 
            isCurrentPlayer={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'} 
            isOpponent={true}
        />
        <PlayerHand 
          cards={player2.hand} 
          onCardSelect={handleCardSelect} 
          isPlayerTurn={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'}
          isOpponent={true}
          selectedCardId={selectedCardP2?.id}
          hasCommittedCard={!!selectedCardP2}
        />
      </div>
      
      <GameOverModal 
        isOpen={gamePhase === 'game_over'} 
        winnerName={winner?.name}
        onRestart={initializeGame} 
      />
    </div>
  );
}
