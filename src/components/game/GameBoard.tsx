
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
    const initialCardsData = generateInitialCards(); // Should now generate 20 unique cards
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
    const totalCardsToLoad = p1InitialHand.length + p2InitialHand.length; // Only load art for cards in hand initially

    const cardsToLoadArtFor = [...p1InitialHand, ...p2InitialHand];

    if (cardsToLoadArtFor.length === 0) {
        setGameState(prev => prev ? { ...prev, gamePhase: 'player1_select_card', battleMessage: `${prev.players[0].name}, select your champion!` } : null);
        return;
    }
    
    cardsToLoadArtFor.forEach(async (card) => {
      try {
        const artInput: GenerateCardArtInput = { cardTitle: card.title };
        // Simulate art generation delay if needed for testing, or call actual function
        // For now, assume generateCardArt is quick enough or handles its own loading state indication if long
        const result = await generateCardArt(artInput);
        
        setGameState(prev => {
          if (!prev) return null;
          const updateCardInHand = (hand: CardData[]) => 
            hand.map(c => c.id === card.id ? { ...c, artUrl: result.cardArtDataUri, isLoadingArt: false } : c);
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInHand(p.hand) })) as [PlayerData, PlayerData],
            // Optionally update in deck too, but primary focus is on visible cards
            // deck: prev.deck.map(c => c.id === card.id ? { ...c, artUrl: result.cardArtDataUri, isLoadingArt: false } : c),
          };
        });
      } catch (error) {
        console.error(`Failed to generate art for ${card.title}:`, error);
        toast({ title: "Art Generation Error", description: `Could not generate art for ${card.title}. Using placeholder.`, variant: "destructive" });
        setGameState(prev => {
           if (!prev) return null;
           const updateCardInHand = (hand: CardData[]) => 
            hand.map(c => c.id === card.id ? { ...c, isLoadingArt: false } : c);
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInHand(p.hand) })) as [PlayerData, PlayerData],
            // deck: prev.deck.map(c => c.id === card.id ? { ...c, isLoadingArt: false } : c),
          };
        });
      } finally {
        artLoadedCount++;
        setArtGenerationProgress((artLoadedCount / totalCardsToLoad) * 100);
        if (artLoadedCount === totalCardsToLoad) {
          setGameState(prev => prev ? { ...prev, gamePhase: 'player1_select_card', battleMessage: `${prev.players[0].name}, select your champion!` } : null);
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
    const { currentPlayerIndex, gamePhase, players } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0 ) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, battleMessage: `${players[1].name}, choose your defender!` } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1 ) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', battleMessage: "CLASH!" } : null);
      setTimeout(() => resolveCombat(), 1500); 
    }
  };

  const resolveCombat = () => {
    setGameState(prev => {
      if (!prev || !prev.selectedCardP1 || !prev.selectedCardP2) return prev;

      let { players, selectedCardP1, selectedCardP2, discardPile, deck: currentDeck } = { ...prev };
      let battleLog = "";

      let p1Data = { ...players[0] };
      let p2Data = { ...players[1] };
      
      let card1InCombat = { ...selectedCardP1 };
      let card2InCombat = { ...selectedCardP2 };

      const initialP1CardDefense = selectedCardP1.defense;
      const initialP2CardDefense = selectedCardP2.defense;

      // --- COMBAT LOGIC ---
      const attackP1 = card1InCombat.melee + card1InCombat.magic;
      const attackP2 = card2InCombat.melee + card2InCombat.magic;

      // P1 attacks P2
      const shieldAbsorbedByC2 = Math.min(card2InCombat.shield, attackP1);
      card2InCombat.shield -= shieldAbsorbedByC2;
      const damageToCard2Hp = Math.max(0, attackP1 - shieldAbsorbedByC2 - card2InCombat.defense);
      card2InCombat.hp -= damageToCard2Hp;
      battleLog += `${card1InCombat.title} attacks ${card2InCombat.title} for ${attackP1}. ${card2InCombat.title}'s defense blocks ${card2InCombat.defense}, shield absorbs ${shieldAbsorbedByC2}. ${card2InCombat.title} takes ${damageToCard2Hp} HP damage.\n`;

      // P2 counter-attacks P1 (if P2 survived)
      if (card2InCombat.hp > 0) {
        const shieldAbsorbedByC1 = Math.min(card1InCombat.shield, attackP2);
        card1InCombat.shield -= shieldAbsorbedByC1;
        const damageToCard1Hp = Math.max(0, attackP2 - shieldAbsorbedByC1 - card1InCombat.defense);
        card1InCombat.hp -= damageToCard1Hp;
        battleLog += `${card2InCombat.title} counter-attacks ${card1InCombat.title} for ${attackP2}. ${card1InCombat.title}'s defense blocks ${card1InCombat.defense}, shield absorbs ${shieldAbsorbedByC1}. ${card1InCombat.title} takes ${damageToCard1Hp} HP damage.\n`;
      } else {
         battleLog += `${card2InCombat.title} was defeated before it could counter-attack.\n`;
      }

      // --- POST-COMBAT RESOLUTION ---
      let p1NewHand = [...p1Data.hand];
      let p2NewHand = [...p2Data.hand];
      let newDiscardPile = [...discardPile];

      // Resolve Player 1's card
      if (card1InCombat.hp <= 0) {
        battleLog += `${card1InCombat.title} is defeated! `;
        newDiscardPile.push(card1InCombat); // Add original card to discard
        p1NewHand = p1NewHand.filter(c => c.id !== card1InCombat.id);
        
        if (p1NewHand.length < CARDS_IN_HAND && currentDeck.length > 0) {
          const { dealtCards: p1NewCards, remainingDeck: deckAfterP1Draw } = dealCards(currentDeck, 1);
          p1NewHand.push(p1NewCards[0]);
          currentDeck = deckAfterP1Draw;
          battleLog += `${p1Data.name} draws a card. `;
        }
      } else {
        p1NewHand = p1NewHand.map(c => c.id === card1InCombat.id ? card1InCombat : c); // Update survived card in hand
        battleLog += `${card1InCombat.title} survives. `;
      }

      // Resolve Player 2's card
      if (card2InCombat.hp <= 0) {
        battleLog += `${card2InCombat.title} is defeated! `;
        newDiscardPile.push(card2InCombat); // Add original card to discard
        p2NewHand = p2NewHand.filter(c => c.id !== card2InCombat.id);

        // Direct damage to player if their card is defeated
        const directDamageToP2 = Math.max(0, attackP1 - initialP2CardDefense); 
        p2Data.hp = Math.max(0, p2Data.hp - directDamageToP2);
        battleLog += `${p2Data.name} takes ${directDamageToP2} direct damage. `;
        
        if (p2NewHand.length < CARDS_IN_HAND && currentDeck.length > 0) {
          const { dealtCards: p2NewCards, remainingDeck: deckAfterP2Draw } = dealCards(currentDeck, 1);
          p2NewHand.push(p2NewCards[0]);
          currentDeck = deckAfterP2Draw;
          battleLog += `${p2Data.name} draws a card. `;
        }
      } else {
        p2NewHand = p2NewHand.map(c => c.id === card2InCombat.id ? card2InCombat : c); // Update survived card in hand
        battleLog += `${card2InCombat.title} survives. `;
      }
      
      p1Data.hand = p1NewHand;
      p2Data.hand = p2NewHand;
      
      // --- GAME OVER CHECK ---
      let newGamePhase: GamePhase = 'player1_select_card'; // Default to P1's turn
      let winner: PlayerData | undefined = undefined;
      let nextPlayerIdx = 0; // P1 starts next round by default

      if (p1Data.hp <= 0 && p2Data.hp <= 0) {
        winner = undefined; 
        newGamePhase = 'game_over';
        battleLog += "It's a draw!";
      } else if (p1Data.hp <= 0) {
        winner = players[1];
        newGamePhase = 'game_over';
        battleLog += `${players[1].name} wins!`;
      } else if (p2Data.hp <= 0) {
        winner = players[0];
        newGamePhase = 'game_over';
        battleLog += `${players[0].name} wins!`;
      }
      
      if (newGamePhase !== 'game_over') {
        // Determine whose turn it is (e.g., alternate or loser starts, for now, P1 always starts)
        // For simplicity, let's always make it player 1's turn after combat resolution.
        // Or, use prev.currentPlayerIndex to alternate if desired for next round.
        // For now, P1 (index 0) always starts the new selection phase.
        nextPlayerIdx = 0;
        battleLog += `\n${players[nextPlayerIdx].name}'s turn. Select a card.`;
      }
      
      return {
        ...prev,
        players: [p1Data, p2Data],
        deck: currentDeck,
        discardPile: newDiscardPile,
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
  
  const { players, deck, discardPile, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, battleMessage } = gameState;
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
          isCurrentPlayer={currentPlayerIndex === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'combat_resolution')} 
        />
        <PlayerHand 
          cards={player1.hand} 
          onCardSelect={handleCardSelect} 
          isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'}
          selectedCardId={selectedCardP1?.id}
          hasCommittedCard={!!selectedCardP1}
          isOpponent={false}
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
        <div className="w-full flex justify-end space-x-4"> {/* Added discard pile count */}
            <p className="text-xs text-muted-foreground">Deck: {deck.length}</p>
            <p className="text-xs text-muted-foreground">Discard: {discardPile.length}</p>
        </div>
        <PlayerStatusDisplay 
            player={player2} 
            isCurrentPlayer={currentPlayerIndex === 1 && (gamePhase === 'player2_select_card' || gamePhase === 'combat_resolution')} 
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
