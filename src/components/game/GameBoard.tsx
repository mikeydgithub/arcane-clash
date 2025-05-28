
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase } from '@/types';
import { generateInitialCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { generateCardArt } from '@/ai/flows/generate-card-art';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Layers3, Trash2 } from 'lucide-react';

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;
const INITIAL_DECK_SIZE_PER_PLAYER = 20;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  // const [artGenerationProgress, setArtGenerationProgress] = useState(0); // No longer needed for initial load
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const artGenerationQueueRef = useRef<Set<string>>(new Set());

  const initializeGame = useCallback(() => {
    hasInitialized.current = true;
    const allGeneratedCards = generateInitialCards(); // Should generate 40 cards, now with isLoadingArt: false

    const shuffledMasterDeck = shuffleDeck(allGeneratedCards);

    const player1DeckFull = shuffledMasterDeck.slice(0, INITIAL_DECK_SIZE_PER_PLAYER);
    const player2DeckFull = shuffledMasterDeck.slice(INITIAL_DECK_SIZE_PER_PLAYER, INITIAL_DECK_SIZE_PER_PLAYER * 2);

    const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1DeckFull, CARDS_IN_HAND);
    const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2DeckFull, CARDS_IN_HAND);

    const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;

    const initialPlayer1: PlayerData = {
      id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP,
      hand: p1InitialHand, // Cards already have isLoadingArt: false
      deck: p1DeckAfterDeal,
      discardPile: []
    };
    const initialPlayer2: PlayerData = {
      id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
      hand: p2InitialHand, // Cards already have isLoadingArt: false
      deck: p2DeckAfterDeal,
      discardPile: []
    };
    
    setGameState({
      players: [initialPlayer1, initialPlayer2],
      currentPlayerIndex: firstPlayerIndex,
      gamePhase: 'coin_flip_animation', // Skip loading_art
      selectedCardP1: undefined,
      selectedCardP2: undefined,
      winner: undefined,
      gameLogMessages: ["Game initialized. Skipping art generation for testing. Flipping coin..."],
    });
    // setArtGenerationProgress(0); // No longer needed
    artGenerationQueueRef.current.clear();
  }, [toast]); // Added toast dependency

  const handleCoinFlipAnimationComplete = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      const nextPhase = prev.currentPlayerIndex === 0 ? 'player1_select_card' : 'player2_select_card';
      return {
        ...prev,
        gamePhase: nextPhase,
        gameLogMessages: [
          ...(prev.gameLogMessages || []),
          `${firstPlayer.name} wins the toss and will go first!`,
          `${firstPlayer.name}, select your champion!`
        ]
      };
    });
  }, []);

  useEffect(() => {
    if (!gameState) { // Initial setup if gameState is null
        initializeGame(); // Directly initialize game
    } else if (gameState.gamePhase === 'initial' && !hasInitialized.current) {
      // This condition should ideally not be met anymore with direct initialization
      initializeGame();
    }
  }, [gameState, initializeGame]);


  // Effect 1: Handles 'loading_art' phase transition for initial card load - SKIPPED FOR TESTING
  // useEffect(() => {
  //   if (!gameState || gameState.gamePhase !== 'loading_art') return;

  //   // ... (logic for art loading progress and transition) ...
  //   // This whole effect is skipped for now
  // }, [gameState?.gamePhase, gameState?.players, toast]);


  // Effect 2: Fetches art for cards in hand (initial load AND for drawn cards)
  useEffect(() => {
    // Allow running for drawn cards in active phases.
    if (!gameState || !gameState.players || gameState.gamePhase === 'initial' || gameState.gamePhase === 'game_over' || gameState.gamePhase === 'coin_flip_animation' || gameState.gamePhase === 'loading_art') {
        // Don't run if game not started, over, during coin flip, or skipped art loading phase.
        return;
    }

    const artQueue = artGenerationQueueRef.current;
    const cardsToFetchArtFor: { playerId: string, cardId: string, cardTitle: string }[] = [];

    gameState.players.forEach(player => {
        player.hand.forEach(card => {
            // Only fetch if isLoadingArt is explicitly true (e.g., for newly drawn cards that need art)
            if (card.isLoadingArt && !card.artUrl && !artQueue.has(card.id)) {
                cardsToFetchArtFor.push({ playerId: player.id, cardId: card.id, cardTitle: card.title });
            }
        });
    });

    if (cardsToFetchArtFor.length > 0) {
        cardsToFetchArtFor.forEach(({ playerId, cardId, cardTitle }) => {
            if (!artQueue.has(cardId)) { 
                artQueue.add(cardId);
                generateCardArt({ cardTitle })
                    .then(artResult => {
                        setTimeout(() => { 
                            setGameState(currentGS => {
                                if (!currentGS) return null;
                                const updatedPlayers = currentGS.players.map(p => {
                                    if (p.id === playerId) {
                                        return {
                                            ...p,
                                            hand: p.hand.map(c =>
                                                c.id === cardId ? { ...c, artUrl: artResult.cardArtDataUri, isLoadingArt: false } : c
                                            ),
                                        };
                                    }
                                    return p;
                                });
                                return { ...currentGS, players: updatedPlayers as [PlayerData, PlayerData] };
                            });
                        }, 0);
                    })
                    .catch(err => {
                        console.error(`Art gen error for card ${cardTitle} (ID: ${cardId}) for player ${playerId}:`, err);
                        setTimeout(() => { 
                            toast({ title: "Art Generation Error", description: `Could not generate art for ${cardTitle}. Using placeholder.`, variant: "destructive" });
                        },0);
                        setTimeout(() => { 
                            setGameState(currentGS => {
                                if (!currentGS) return null;
                                const updatedPlayers = currentGS.players.map(p => {
                                    if (p.id === playerId) {
                                        return {
                                            ...p,
                                            hand: p.hand.map(c =>
                                                c.id === cardId ? { ...c, isLoadingArt: false, artUrl: undefined } : c 
                                            ),
                                        };
                                    }
                                    return p;
                                });
                                return { ...currentGS, players: updatedPlayers as [PlayerData, PlayerData] };
                            });
                        }, 0);
                    })
                    .finally(() => {
                         artQueue.delete(cardId); 
                    });
            }
        });
    }
  }, [gameState?.players, gameState?.gamePhase, toast]); 


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase, players, gameLogMessages } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, gameLogMessages: [...(gameLogMessages || []), `${players[1].name}, choose your defender!`] } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', gameLogMessages: [...(gameLogMessages || []), "Prepare for CLASH!"] } : null);
      setTimeout(() => resolveCombat(), 1200); // Delay combat resolution for bash animation
    }
  };

  const resolveCombat = () => {
    setGameState(prev => {
      if (!prev || !prev.selectedCardP1 || !prev.selectedCardP2) return prev;

      let p1Data = { ...prev.players[0], hand: [...prev.players[0].hand], deck: [...prev.players[0].deck], discardPile: [...prev.players[0].discardPile] };
      let p2Data = { ...prev.players[1], hand: [...prev.players[1].hand], deck: [...prev.players[1].deck], discardPile: [...prev.players[1].discardPile] };

      let card1InCombat = { ...prev.selectedCardP1 };
      let card2InCombat = { ...prev.selectedCardP2 };
      const initialP1CardDefense = prev.selectedCardP1.defense;
      const initialP2CardDefense = prev.selectedCardP2.defense;
      
      const newTurnLogEntries: string[] = [];
      newTurnLogEntries.push(`Combat Begins: ${card1InCombat.title} vs ${card2InCombat.title}!`);

      // Player 1 attacks Player 2's card
      const attackP1 = card1InCombat.melee + card1InCombat.magic;
      const shieldAbsorbedByC2 = Math.min(card2InCombat.shield, attackP1);
      if (shieldAbsorbedByC2 > 0) newTurnLogEntries.push(`${card2InCombat.title}'s shield absorbs ${shieldAbsorbedByC2} damage from ${card1InCombat.title}.`);
      card2InCombat.shield -= shieldAbsorbedByC2;

      const damageToC2AfterShield = attackP1 - shieldAbsorbedByC2;
      const defenseBlockedByC2 = Math.min(card2InCombat.defense, damageToC2AfterShield);
      if (defenseBlockedByC2 > 0 && damageToC2AfterShield > 0) newTurnLogEntries.push(`${card2InCombat.title}'s defense blocks ${defenseBlockedByC2} damage.`);
      
      const damageToCard2Hp = Math.max(0, damageToC2AfterShield - defenseBlockedByC2);
      card2InCombat.hp -= damageToCard2Hp;
      newTurnLogEntries.push(`${card1InCombat.title} attacks ${card2InCombat.title} for ${attackP1}. ${card2InCombat.title} takes ${damageToCard2Hp} HP damage. New HP: ${card2InCombat.hp < 0 ? 0 : card2InCombat.hp}`);

      // Player 2's card counter-attacks if it survived
      if (card2InCombat.hp > 0) {
        const attackP2 = card2InCombat.melee + card2InCombat.magic;
        const shieldAbsorbedByC1 = Math.min(card1InCombat.shield, attackP2);
        if (shieldAbsorbedByC1 > 0) newTurnLogEntries.push(`${card1InCombat.title}'s shield absorbs ${shieldAbsorbedByC1} damage from ${card2InCombat.title}.`);
        card1InCombat.shield -= shieldAbsorbedByC1;

        const damageToC1AfterShield = attackP2 - shieldAbsorbedByC1;
        const defenseBlockedByC1 = Math.min(card1InCombat.defense, damageToC1AfterShield);
         if (defenseBlockedByC1 > 0 && damageToC1AfterShield > 0) newTurnLogEntries.push(`${card1InCombat.title}'s defense blocks ${defenseBlockedByC1} damage.`);
        
        const damageToCard1Hp = Math.max(0, damageToC1AfterShield - defenseBlockedByC1);
        card1InCombat.hp -= damageToCard1Hp;
        newTurnLogEntries.push(`${card2InCombat.title} counter-attacks ${card1InCombat.title} for ${attackP2}. ${card1InCombat.title} takes ${damageToCard1Hp} HP damage. New HP: ${card1InCombat.hp < 0 ? 0 : card1InCombat.hp}`);
      } else {
        newTurnLogEntries.push(`${card2InCombat.title} was defeated before it could counter-attack.`);
      }
      
      // Process outcomes for Player 1's card
      if (card1InCombat.hp <= 0) {
        newTurnLogEntries.push(`${card1InCombat.title} is defeated!`);
        p1Data.discardPile.push(prev.selectedCardP1); 
        p1Data.hand = p1Data.hand.filter(c => c.id !== card1InCombat.id);

        if (card2InCombat.hp > 0) { 
            const directDamageToP1 = Math.max(0, (card2InCombat.melee + card2InCombat.magic) - initialP1CardDefense); 
             if(directDamageToP1 > 0) {
                p1Data.hp = Math.max(0, p1Data.hp - directDamageToP1);
                newTurnLogEntries.push(`${p1Data.name} takes ${directDamageToP1} direct damage. New HP: ${p1Data.hp}`);
            }
        }
        
        if (p1Data.hand.length < CARDS_IN_HAND && p1Data.deck.length > 0) {
          const { dealtCards: newCardsArrP1, remainingDeck: deckAfterDrawP1 } = dealCards(p1Data.deck, 1);
          const newDrawnCardP1 = { ...newCardsArrP1[0], isLoadingArt: true, artUrl: undefined }; // New card needs art
          p1Data.hand.push(newDrawnCardP1);
          p1Data.deck = deckAfterDrawP1;
          newTurnLogEntries.push(`${p1Data.name} draws a new card: ${newDrawnCardP1.title}.`);
        } else if (p1Data.hand.length < CARDS_IN_HAND && p1Data.deck.length === 0) {
            newTurnLogEntries.push(`${p1Data.name} has no cards left in their deck to draw.`);
        }
      } else {
        p1Data.hand = p1Data.hand.map(c => c.id === card1InCombat.id ? card1InCombat : c);
        newTurnLogEntries.push(`${card1InCombat.title} survives the clash.`);
      }

      // Process outcomes for Player 2's card
      if (card2InCombat.hp <= 0) {
        newTurnLogEntries.push(`${card2InCombat.title} is defeated!`);
        p2Data.discardPile.push(prev.selectedCardP2); 
        p2Data.hand = p2Data.hand.filter(c => c.id !== card2InCombat.id);

        const directDamageToP2 = Math.max(0, (card1InCombat.melee + card1InCombat.magic) - initialP2CardDefense); 
        if (directDamageToP2 > 0) { 
            p2Data.hp = Math.max(0, p2Data.hp - directDamageToP2);
            newTurnLogEntries.push(`${p2Data.name} takes ${directDamageToP2} direct damage. New HP: ${p2Data.hp}`);
        }
        
        if (p2Data.hand.length < CARDS_IN_HAND && p2Data.deck.length > 0) {
          const { dealtCards: newCardsArrP2, remainingDeck: deckAfterDrawP2 } = dealCards(p2Data.deck, 1);
          const newDrawnCardP2 = { ...newCardsArrP2[0], isLoadingArt: true, artUrl: undefined }; // New card needs art
          p2Data.hand.push(newDrawnCardP2);
          p2Data.deck = deckAfterDrawP2;
          newTurnLogEntries.push(`${p2Data.name} draws a new card: ${newDrawnCardP2.title}.`);
        } else if (p2Data.hand.length < CARDS_IN_HAND && p2Data.deck.length === 0) {
            newTurnLogEntries.push(`${p2Data.name} has no cards left in their deck to draw.`);
        }
      } else {
        p2Data.hand = p2Data.hand.map(c => c.id === card2InCombat.id ? card2InCombat : c);
        newTurnLogEntries.push(`${card2InCombat.title} survives the clash.`);
      }

      let newGamePhase: GamePhase = 'combat_summary';
      let winner: PlayerData | undefined = undefined;

      if (p1Data.hp <= 0 && p2Data.hp <= 0) {
        winner = undefined; 
        newGamePhase = 'game_over';
        newTurnLogEntries.push("It's a draw! Both players have been defeated.");
      } else if (p1Data.hp <= 0) {
        winner = prev.players[1];
        newGamePhase = 'game_over';
        newTurnLogEntries.push(`${prev.players[1].name} wins! ${prev.players[0].name} has been defeated.`);
      } else if (p2Data.hp <= 0) {
        winner = prev.players[0];
        newGamePhase = 'game_over';
        newTurnLogEntries.push(`${prev.players[0].name} wins! ${prev.players[1].name} has been defeated.`);
      }
      
      const finalSelectedCardP1 = card1InCombat.hp > 0 ? card1InCombat : undefined;
      const finalSelectedCardP2 = card2InCombat.hp > 0 ? card2InCombat : undefined;

      const existingLog = prev.gameLogMessages || [];
      const gameInitializationMessage = existingLog.find(msg => msg.includes("Game initialized.")); // More flexible find
      
      // Keep initial setup messages and coin flip messages if they exist, then add new turn log.
      const persistentMessages = existingLog.filter(msg => msg.includes("Game initialized.") || msg.includes("wins the toss"));
      const logMessagesForThisTurn = [...new Set([...persistentMessages, ...newTurnLogEntries])];


      return {
        ...prev,
        players: [p1Data, p2Data],
        selectedCardP1: finalSelectedCardP1, 
        selectedCardP2: finalSelectedCardP2, 
        gamePhase: newGamePhase,
        winner,
        gameLogMessages: logMessagesForThisTurn,
      };
    });
  };

  const handleProceedToNextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      const nextPlayerToSelect = prev.players[0]; // Always P1 after combat summary
      
      const persistentMessages = (prev.gameLogMessages || []).filter(msg => msg.includes("Game initialized.") || msg.includes("wins the toss"));
      const newLogMessages = [
          ...persistentMessages,
          `A new round begins! ${nextPlayerToSelect.name}, select your champion!`
      ];

      return {
        ...prev,
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        gameLogMessages: newLogMessages,
        currentPlayerIndex: 0, 
        gamePhase: 'player1_select_card',
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
  
  // Landing page / Initial button to start game is skipped by direct initialization.
  // Loading art screen is also skipped.

  const { players, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, gameLogMessages } = gameState;
  const player1 = players[0];
  const player2 = players[1];

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">
      {/* Player 1 Column */}
      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-1 md:space-y-2 flex-shrink-0">
        <div className="w-full flex flex-col items-center space-y-1 text-xs text-muted-foreground mb-1">
          <div className="flex items-center space-x-1">
            <Layers3 className="w-3 h-3" />
            <span>Deck: {player1.deck.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trash2 className="w-3 h-3" />
            <span>Discard: {player1.discardPile.length}</span>
          </div>
        </div>
        <PlayerStatusDisplay
          player={player1}
          isCurrentPlayer={currentPlayerIndex === 0 && (gamePhase === 'player1_select_card' || (gamePhase === 'coin_flip_animation' && gameState.currentPlayerIndex === 0))}
        />
        <PlayerHand
          cards={player1.hand}
          onCardSelect={handleCardSelect}
          isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'}
          selectedCardId={selectedCardP1?.id}
          hasCommittedCard={!!selectedCardP1 && (gamePhase === 'player2_select_card' || gamePhase === 'combat_animation' || gamePhase === 'combat_summary')}
          isOpponent={false}
        />
      </div>

      {/* Center Battle Arena Column */}
      <div className="flex-grow flex flex-col items-center justify-center min-w-0">
        <BattleArena
          player1Card={selectedCardP1}
          player2Card={selectedCardP2}
          player1Name={player1.name}
          player2Name={player2.name}
          showClashAnimation={gamePhase === 'combat_animation' && !!selectedCardP1 && !!selectedCardP2}
          gameLogMessages={gameLogMessages || []}
          gamePhase={gamePhase}
          onProceedToNextTurn={handleProceedToNextTurn}
          onCoinFlipAnimationComplete={handleCoinFlipAnimationComplete}
          winningPlayerNameForCoinFlip={players[gameState.currentPlayerIndex]?.name}
        />
      </div>

      {/* Player 2 Column */}
      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-1 md:space-y-2 flex-shrink-0">
        <div className="w-full flex flex-col items-center space-y-1 text-xs text-muted-foreground mb-1">
          <div className="flex items-center space-x-1">
            <Layers3 className="w-3 h-3" />
            <span>Deck: {player2.deck.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trash2 className="w-3 h-3" />
            <span>Discard: {player2.discardPile.length}</span>
          </div>
        </div>
        <PlayerStatusDisplay
          player={player2}
          isCurrentPlayer={currentPlayerIndex === 1 && (gamePhase === 'player2_select_card' || (gamePhase === 'coin_flip_animation' && gameState.currentPlayerIndex === 1))}
          isOpponent={true}
        />
        <PlayerHand
          cards={player2.hand}
          onCardSelect={handleCardSelect}
          isPlayerTurn={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'}
          isOpponent={true}
          selectedCardId={selectedCardP2?.id}
          hasCommittedCard={!!selectedCardP2 && (gamePhase === 'player1_select_card' || gamePhase === 'combat_animation' || gamePhase === 'combat_summary')}
        />
      </div>

      <GameOverModal
        isOpen={gamePhase === 'game_over'}
        winnerName={winner?.name}
        onRestart={() => {
          hasInitialized.current = false;
          setGameState(null); 
        }}
      />
    </div>
  );
}

    