
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
const INITIAL_DECK_SIZE_PER_PLAYER = 20; // Each player has their own deck

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [artGenerationProgress, setArtGenerationProgress] = useState(0);
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const artGenerationQueueRef = useRef<Set<string>>(new Set());

  const initializeGame = useCallback(() => {
    hasInitialized.current = true;
    const allGeneratedCards = generateInitialCards(); // Generates 40 cards
    const shuffledMasterDeck = shuffleDeck(allGeneratedCards);

    const player1DeckFull = shuffledMasterDeck.slice(0, INITIAL_DECK_SIZE_PER_PLAYER);
    const player2DeckFull = shuffledMasterDeck.slice(INITIAL_DECK_SIZE_PER_PLAYER, INITIAL_DECK_SIZE_PER_PLAYER * 2);

    const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1DeckFull, CARDS_IN_HAND);
    const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2DeckFull, CARDS_IN_HAND);

    const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1; // Pre-determine who will win the coin flip

    const initialPlayer1: PlayerData = {
      id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP,
      hand: p1InitialHand.map(c => ({ ...c, isLoadingArt: true, artUrl: undefined })),
      deck: p1DeckAfterDeal,
      discardPile: []
    };
    const initialPlayer2: PlayerData = {
      id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
      hand: p2InitialHand.map(c => ({ ...c, isLoadingArt: true, artUrl: undefined })),
      deck: p2DeckAfterDeal,
      discardPile: []
    };
    
    setGameState({
      players: [initialPlayer1, initialPlayer2],
      currentPlayerIndex: firstPlayerIndex, // Winner of the upcoming coin flip
      gamePhase: 'loading_art', // Start with art loading
      selectedCardP1: undefined,
      selectedCardP2: undefined,
      winner: undefined,
      gameLogMessages: ["Game initialized. Conjuring card artwork..."],
    });
    setArtGenerationProgress(0);
    artGenerationQueueRef.current.clear();
  }, [toast]);

  const handleCoinFlipAnimationComplete = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      const nextPhase = prev.currentPlayerIndex === 0 ? 'player1_select_card' : 'player2_select_card';
      return {
        ...prev,
        gamePhase: nextPhase,
        gameLogMessages: [
          ...prev.gameLogMessages,
          `${firstPlayer.name} wins the toss and will go first!`,
          `${firstPlayer.name}, select your champion!`
        ]
      };
    });
  }, []);


  useEffect(() => {
    if (!gameState) {
      setGameState({
        players: [
          { id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP, hand: [], deck: [], discardPile: [] },
          { id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP, hand: [], deck: [], discardPile: [] },
        ],
        currentPlayerIndex: 0,
        gamePhase: 'initial',
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        winner: undefined,
        gameLogMessages: ["Welcome to Arcane Clash!"],
      });
    } else if (gameState.gamePhase === 'initial' && !hasInitialized.current) {
      // Do nothing here, initializeGame will be called by button
    }
  }, [gameState]);


 useEffect(() => {
    if (!gameState || gameState.gamePhase === 'initial' || gameState.gamePhase === 'game_over') return;

    const artQueue = artGenerationQueueRef.current;
    const cardsToFetchArtFor: { playerId: string, cardId: string, cardTitle: string }[] = [];

    gameState.players.forEach(player => {
      player.hand.forEach(card => {
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
                artQueue.delete(cardId);
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
                artQueue.delete(cardId);
              }, 0);
            });
        }
      });
    }
    
    if (gameState.gamePhase === 'loading_art') {
      const stillLoadingArt = gameState.players.some(p => p.hand.some(c => c.isLoadingArt));
      const totalCardsInHands = gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
      const loadedCardsCount = gameState.players.reduce((sum, p) => sum + p.hand.filter(c => !c.isLoadingArt).length, 0);

      if (totalCardsInHands > 0) {
         setTimeout(() => setArtGenerationProgress((loadedCardsCount / totalCardsInHands) * 100), 0);
      }

      if (!stillLoadingArt && totalCardsInHands > 0) {
        setTimeout(() => { // Ensure this update happens after current render cycle
          setGameState(prev => {
            if (!prev || prev.gamePhase !== 'loading_art') return prev;
            return {
              ...prev,
              gamePhase: 'coin_flip_animation', // Transition to coin flip after art
              gameLogMessages: [
                ...prev.gameLogMessages,
                "Card art conjured! Flipping coin to decide who goes first..."
              ]
            };
          });
        }, 500); 
      } else if (totalCardsInHands === 0 && gameState.players.every(p => p.deck.length === 0)) {
         setTimeout(() => {
          setGameState(prev => {
            if (!prev || prev.gamePhase !== 'loading_art') return prev;
            return {
              ...prev,
              gamePhase: 'coin_flip_animation', // Also transition if no cards
              gameLogMessages: [
                ...prev.gameLogMessages,
                "Card art phase complete (no cards). Flipping coin..."
              ]
            };
          });
        }, 500);
      }
    }
  }, [gameState, toast]);


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase, players, gameLogMessages } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, gameLogMessages: [...gameLogMessages, `${players[1].name}, choose your defender!`] } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', gameLogMessages: [...gameLogMessages, "Prepare for CLASH!"] } : null);
      setTimeout(() => resolveCombat(), 1200); // Delay combat resolution for animation
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

      const attackP1 = card1InCombat.melee + card1InCombat.magic;
      const attackP2 = card2InCombat.melee + card2InCombat.magic;

      const shieldAbsorbedByC2 = Math.min(card2InCombat.shield, attackP1);
      if (shieldAbsorbedByC2 > 0) newTurnLogEntries.push(`${card2InCombat.title}'s shield absorbs ${shieldAbsorbedByC2} damage.`);
      card2InCombat.shield -= shieldAbsorbedByC2;

      const damageToC2AfterShield = attackP1 - shieldAbsorbedByC2;
      const defenseBlockedByC2 = Math.min(card2InCombat.defense, damageToC2AfterShield);
      if (defenseBlockedByC2 > 0 && damageToC2AfterShield > 0) newTurnLogEntries.push(`${card2InCombat.title}'s defense blocks ${defenseBlockedByC2} damage.`);
      
      const damageToCard2Hp = Math.max(0, damageToC2AfterShield - defenseBlockedByC2);
      card2InCombat.hp -= damageToCard2Hp;
      newTurnLogEntries.push(`${card1InCombat.title} attacks ${card2InCombat.title} for ${attackP1}. ${card2InCombat.title} takes ${damageToCard2Hp} HP damage. New HP: ${card2InCombat.hp}`);

      if (card2InCombat.hp > 0) { // Card 2 counter-attacks if it survived
        const shieldAbsorbedByC1 = Math.min(card1InCombat.shield, attackP2);
        if (shieldAbsorbedByC1 > 0) newTurnLogEntries.push(`${card1InCombat.title}'s shield absorbs ${shieldAbsorbedByC1} damage.`);
        card1InCombat.shield -= shieldAbsorbedByC1;

        const damageToC1AfterShield = attackP2 - shieldAbsorbedByC1;
        const defenseBlockedByC1 = Math.min(card1InCombat.defense, damageToC1AfterShield);
         if (defenseBlockedByC1 > 0 && damageToC1AfterShield > 0) newTurnLogEntries.push(`${card1InCombat.title}'s defense blocks ${defenseBlockedByC1} damage.`);
        
        const damageToCard1Hp = Math.max(0, damageToC1AfterShield - defenseBlockedByC1);
        card1InCombat.hp -= damageToCard1Hp;
        newTurnLogEntries.push(`${card2InCombat.title} counter-attacks ${card1InCombat.title} for ${attackP2}. ${card1InCombat.title} takes ${damageToCard1Hp} HP damage. New HP: ${card1InCombat.hp}`);
      } else {
        newTurnLogEntries.push(`${card2InCombat.title} was defeated before it could counter-attack.`);
      }
      
      // Handle card 1 defeat and player 1 direct damage / draw
      if (card1InCombat.hp <= 0) {
        newTurnLogEntries.push(`${card1InCombat.title} is defeated!`);
        p1Data.discardPile.push(prev.selectedCardP1);
        p1Data.hand = p1Data.hand.filter(c => c.id !== card1InCombat.id);

        if (card2InCombat.hp > 0) { // If card 2 survived, it deals direct damage
            const directDamageToP1 = Math.max(0, attackP2 - initialP1CardDefense); // Damage bypassing defeated card's original defense
             if(directDamageToP1 > 0) {
                p1Data.hp = Math.max(0, p1Data.hp - directDamageToP1);
                newTurnLogEntries.push(`${p1Data.name} takes ${directDamageToP1} direct damage. New HP: ${p1Data.hp}`);
            }
        }
        // Draw card for Player 1
        if (p1Data.hand.length < CARDS_IN_HAND && p1Data.deck.length > 0) {
          const { dealtCards: newCardsArr, remainingDeck: deckAfterDraw } = dealCards(p1Data.deck, 1);
          const newDrawnCard = { ...newCardsArr[0], isLoadingArt: true, artUrl: undefined };
          p1Data.hand.push(newDrawnCard);
          p1Data.deck = deckAfterDraw;
          newTurnLogEntries.push(`${p1Data.name} draws a new card: ${newDrawnCard.title}.`);
        } else if (p1Data.hand.length < CARDS_IN_HAND && p1Data.deck.length === 0) {
            newTurnLogEntries.push(`${p1Data.name} has no cards left in their deck to draw.`);
        }
      } else {
        p1Data.hand = p1Data.hand.map(c => c.id === card1InCombat.id ? card1InCombat : c);
        newTurnLogEntries.push(`${card1InCombat.title} survives the clash.`);
      }

      // Handle card 2 defeat and player 2 direct damage / draw
      if (card2InCombat.hp <= 0) {
        newTurnLogEntries.push(`${card2InCombat.title} is defeated!`);
        p2Data.discardPile.push(prev.selectedCardP2);
        p2Data.hand = p2Data.hand.filter(c => c.id !== card2InCombat.id);

        const directDamageToP2 = Math.max(0, attackP1 - initialP2CardDefense); // Damage bypassing defeated card's original defense
        if (directDamageToP2 > 0) {
            p2Data.hp = Math.max(0, p2Data.hp - directDamageToP2);
            newTurnLogEntries.push(`${p2Data.name} takes ${directDamageToP2} direct damage. New HP: ${p2Data.hp}`);
        }
        // Draw card for Player 2
        if (p2Data.hand.length < CARDS_IN_HAND && p2Data.deck.length > 0) {
          const { dealtCards: newCardsArr, remainingDeck: deckAfterDraw } = dealCards(p2Data.deck, 1);
          const newDrawnCard = { ...newCardsArr[0], isLoadingArt: true, artUrl: undefined };
          p2Data.hand.push(newDrawnCard);
          p2Data.deck = deckAfterDraw;
          newTurnLogEntries.push(`${p2Data.name} draws a new card: ${newDrawnCard.title}.`);
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
      
      // Update selected cards to reflect their state after combat (or undefined if defeated)
      const finalSelectedCardP1 = card1InCombat.hp > 0 ? card1InCombat : undefined;
      const finalSelectedCardP2 = card2InCombat.hp > 0 ? card2InCombat : undefined;

      return {
        ...prev,
        players: [p1Data, p2Data],
        selectedCardP1: finalSelectedCardP1,
        selectedCardP2: finalSelectedCardP2,
        gamePhase: newGamePhase,
        winner,
        gameLogMessages: [...(prev.gameLogMessages || []).slice(0,1), ...newTurnLogEntries], // Keep initial message, add new turn logs
      };
    });
  };


  const handleProceedToNextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      // Determine next player based on current logic (e.g., P1 always starts new round, or alternate)
      // For simplicity, let's assume P1 (index 0) always starts the new round selection after combat summary.
      const nextPlayerToSelect = prev.players[0];
      const currentLog = prev.gameLogMessages || [];
      const initialLogMessages = currentLog.length > 0 ? [currentLog[0]] : ["A new round begins!"];


      return {
        ...prev,
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        gameLogMessages: [...initialLogMessages, `A new round begins! ${nextPlayerToSelect.name}, select your champion!`],
        currentPlayerIndex: 0, // Player 1 (index 0) starts selection
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

  const { players, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, gameLogMessages } = gameState;
  const player1 = players[0];
  const player2 = players[1];

  if (gamePhase === 'initial') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <h1 className="text-5xl font-bold text-primary mb-8 tracking-wide">Arcane Clash</h1>
        <Button onClick={() => {
          hasInitialized.current = false; // Reset for re-initialization
          initializeGame();
        }} 
        size="lg" className="px-10 py-6 text-2xl bg-accent hover:bg-accent/90">
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
            style={{ width: `${artGenerationProgress}%` }}
          ></div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{Math.round(artGenerationProgress)}% Complete</p>
      </div>
    );
  }


  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">
      {/* Player 1 Side (Left) */}
      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-2 md:space-y-3 flex-shrink-0">
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
          isCurrentPlayer={currentPlayerIndex === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'coin_flip_animation' || gamePhase === 'combat_summary' || gamePhase === 'combat_animation')}
        />
        <PlayerHand
          cards={player1.hand}
          onCardSelect={handleCardSelect}
          isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'}
          selectedCardId={selectedCardP1?.id}
          hasCommittedCard={!!selectedCardP1 && gamePhase !== 'player1_select_card'}
          isOpponent={false}
        />
      </div>

      {/* Battle Arena (Center) */}
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
          onCoinFlipAnimationComplete={handleCoinFlipAnimationComplete} // Pass this down
          winningPlayerNameForCoinFlip={players[currentPlayerIndex].name} // Pass pre-determined winner name
        />
      </div>

      {/* Player 2 Side (Right) */}
      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-2 md:space-y-3 flex-shrink-0">
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
          isCurrentPlayer={currentPlayerIndex === 1 && (gamePhase === 'player2_select_card' || gamePhase === 'coin_flip_animation' || gamePhase === 'combat_summary' || gamePhase === 'combat_animation')}
          isOpponent={true}
        />
        <PlayerHand
          cards={player2.hand}
          onCardSelect={handleCardSelect}
          isPlayerTurn={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'}
          isOpponent={true}
          selectedCardId={selectedCardP2?.id}
          hasCommittedCard={!!selectedCardP2 && gamePhase !== 'player2_select_card'}
        />
      </div>

      <GameOverModal
        isOpen={gamePhase === 'game_over'}
        winnerName={winner?.name}
        onRestart={() => {
          hasInitialized.current = false; // Reset for re-initialization
          initializeGame();
        }}
      />
    </div>
  );
}

