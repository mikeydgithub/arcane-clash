
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase } from '@/types';
import { generateInitialCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { generateCardArt } from '@/ai/flows/generate-card-art';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
// import { Button } from '@/components/ui/button'; // No longer used directly here for Start
import { useToast } from '@/hooks/use-toast';
import { Loader2, Layers3, Trash2 } from 'lucide-react';

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;
const INITIAL_DECK_SIZE_PER_PLAYER = 20;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const { toast } = useToast();
  const hasInitialized = useRef(false);

  // For managing art generation queue and ensuring no duplicate calls
  const artGenerationQueueRef = useRef<Set<string>>(new Set());


  const initializeGame = useCallback(() => {
    hasInitialized.current = true; // Mark that initialization has started/completed once
    const allGeneratedCards = generateInitialCards(); // Generates 40 cards

    const shuffledMasterDeck = shuffleDeck(allGeneratedCards);

    const player1DeckFull = shuffledMasterDeck.slice(0, INITIAL_DECK_SIZE_PER_PLAYER);
    const player2DeckFull = shuffledMasterDeck.slice(INITIAL_DECK_SIZE_PER_PLAYER, INITIAL_DECK_SIZE_PER_PLAYER * 2);

    const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1DeckFull, CARDS_IN_HAND);
    const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2DeckFull, CARDS_IN_HAND);

    const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;

    const initialPlayer1: PlayerData = {
      id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP,
      hand: p1InitialHand.map(c => ({ ...c, isLoadingArt: false, artUrl: undefined })), // Skip art loading for testing
      deck: p1DeckAfterDeal,
      discardPile: []
    };
    const initialPlayer2: PlayerData = {
      id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
      hand: p2InitialHand.map(c => ({ ...c, isLoadingArt: false, artUrl: undefined })), // Skip art loading for testing
      deck: p2DeckAfterDeal,
      discardPile: []
    };
    
    setGameState({
      players: [initialPlayer1, initialPlayer2],
      currentPlayerIndex: firstPlayerIndex,
      gamePhase: 'coin_flip_animation', // Start with coin flip (skipping art loading for testing)
      selectedCardP1: undefined,
      selectedCardP2: undefined,
      winner: undefined,
      gameLogMessages: [`Game initialized. ${firstPlayerIndex === 0 ? initialPlayer1.name : initialPlayer2.name} will be determined by coin flip. Flipping coin...`],
    });
    artGenerationQueueRef.current.clear();
  }, [toast]); // Removed artGenerationProgress from dependencies as it's not used in init

  const handleCoinFlipAnimationComplete = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      const nextPhase = prev.currentPlayerIndex === 0 ? 'player1_select_card' : 'player2_select_card';
      
      // Keep only the "Game initialized" message if present, then add new ones.
      const baseLog = (prev.gameLogMessages || []).filter(msg => msg.startsWith("Game initialized."));
      
      return {
        ...prev,
        gamePhase: nextPhase,
        gameLogMessages: [
          ...baseLog,
          `${firstPlayer.name} wins the toss and will go first!`,
          `${firstPlayer.name}, select your champion!`
        ]
      };
    });
  }, []);

  // Effect 1: Initialize game on mount (skips start button and art loading for testing)
  useEffect(() => {
    if (!gameState && !hasInitialized.current) { 
        initializeGame();
    }
  }, [gameState, initializeGame]);


  // Effect 2: On-demand art generation for newly drawn cards (not initial load for testing)
   useEffect(() => {
    if (!gameState || !gameState.players || gameState.gamePhase === 'initial' || gameState.gamePhase === 'game_over' || gameState.gamePhase === 'loading_art') {
        return; // Only run if game is active and not in these specific phases
    }

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
                artQueue.add(cardId); // Add to queue before fetching
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
                         setTimeout(() => artQueue.delete(cardId), 0); // Remove from queue after attempt
                    });
            }
        });
    }
  // Dependencies: re-run if players' hands change (e.g., new card drawn) or if game phase allows art gen.
  // Avoid direct dependency on specific card properties like isLoadingArt to prevent excessive runs.
  // The check inside `card.isLoadingArt && !card.artUrl && !artQueue.has(card.id)` handles the actual work.
  }, [gameState?.players, gameState?.gamePhase, toast]); 


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase, players, gameLogMessages, selectedCardP1, selectedCardP2 } = gameState;

    const baseLog = (gameLogMessages || []).filter(msg => msg.startsWith("Game initialized.") || msg.includes("wins the toss"));

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0) {
      setGameState(prev => {
        if (!prev) return null;
        if (prev.selectedCardP2) { // P2 played first (P2 won toss, this is P1's response)
          return { ...prev, selectedCardP1: card, gamePhase: 'combat_animation', gameLogMessages: [...baseLog, `${players[1].name} played ${prev.selectedCardP2.title}.`, `${players[0].name} responds with ${card.title}.`, "Prepare for CLASH!"] };
        } else { // P1 plays first this round
          return { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, gameLogMessages: [...baseLog, `${players[0].name} plays ${card.title}.`, `${players[1].name}, choose your defender!`] };
        }
      });
      if (gameState.selectedCardP2 || card) { // If P2 already played, or P1 just played (meaning P2 is next OR combat)
         if(gameState.selectedCardP2 && card) setTimeout(() => resolveCombat(), 1200); // Both selected, resolve
      }
    } 
    else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1) {
      setGameState(prev => {
        if (!prev) return null;
        if (prev.selectedCardP1) { // P1 played first (P1 won toss, this is P2's response)
          return { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', gameLogMessages: [...baseLog, `${players[0].name} played ${prev.selectedCardP1.title}.`, `${players[1].name} responds with ${card.title}.`, "Prepare for CLASH!"] };
        } else { // P2 plays first this round
          return { ...prev, selectedCardP2: card, gamePhase: 'player1_select_card', currentPlayerIndex: 0, gameLogMessages: [...baseLog, `${players[1].name} plays ${card.title}.`, `${players[0].name}, choose your champion!`] };
        }
      });
      if (gameState.selectedCardP1 || card) { // If P1 already played, or P2 just played
         if(gameState.selectedCardP1 && card) setTimeout(() => resolveCombat(), 1200); // Both selected, resolve
      }
    }
  };

  const resolveCombat = () => {
    setGameState(prev => {
      if (!prev || !prev.selectedCardP1 || !prev.selectedCardP2) return prev;

      let p1Data = { ...prev.players[0], hand: [...prev.players[0].hand], deck: [...prev.players[0].deck], discardPile: [...prev.players[0].discardPile] };
      let p2Data = { ...prev.players[1], hand: [...prev.players[1].hand], deck: [...prev.players[1].deck], discardPile: [...prev.players[1].discardPile] };

      let card1InCombat = { ...prev.selectedCardP1 }; // P1's card
      let card2InCombat = { ...prev.selectedCardP2 }; // P2's card
      
      const initialP1CardDefense = prev.selectedCardP1.defense;
      const initialP2CardDefense = prev.selectedCardP2.defense;
      
      const turnLogEntries: string[] = [];
      turnLogEntries.push(`Combat Begins: ${card1InCombat.title} (P1) vs ${card2InCombat.title} (P2)!`);

      // --- Player 1's card (card1InCombat) attacks Player 2's card (card2InCombat) ---
      if (card1InCombat.melee > 0) { // Physical Attack from Card 1
        const attackP1Melee = card1InCombat.melee;
        turnLogEntries.push(`${card1InCombat.title} attacks ${card2InCombat.title} with ${attackP1Melee} melee damage.`);
        
        const shieldAbsorbedByC2 = Math.min(card2InCombat.shield, attackP1Melee);
        if (shieldAbsorbedByC2 > 0) {
          turnLogEntries.push(`${card2InCombat.title}'s physical shield absorbs ${shieldAbsorbedByC2} damage.`);
          card2InCombat.shield -= shieldAbsorbedByC2;
        }
        const damageToC2AfterShield = attackP1Melee - shieldAbsorbedByC2;

        if (damageToC2AfterShield > 0) {
          const defenseBlockedByC2 = Math.min(card2InCombat.defense, damageToC2AfterShield);
          if (defenseBlockedByC2 > 0) {
            turnLogEntries.push(`${card2InCombat.title}'s defense blocks ${defenseBlockedByC2} melee damage.`);
          }
          const damageToCard2Hp = Math.max(0, damageToC2AfterShield - defenseBlockedByC2);
          card2InCombat.hp -= damageToCard2Hp;
          turnLogEntries.push(`${card2InCombat.title} takes ${damageToCard2Hp} HP damage. New HP: ${Math.max(0,card2InCombat.hp)}`);
        } else {
          turnLogEntries.push(`${card1InCombat.title}'s melee attack was fully absorbed by shield/defense.`);
        }
      } else if (card1InCombat.magic > 0) { // Magic Attack from Card 1
        const attackP1Magic = card1InCombat.magic;
        turnLogEntries.push(`${card1InCombat.title} attacks ${card2InCombat.title} with ${attackP1Magic} magic damage.`);

        const magicShieldAbsorbedByC2 = Math.min(card2InCombat.magicShield, attackP1Magic);
        if (magicShieldAbsorbedByC2 > 0) {
          turnLogEntries.push(`${card2InCombat.title}'s magic shield absorbs ${magicShieldAbsorbedByC2} damage.`);
          card2InCombat.magicShield -= magicShieldAbsorbedByC2;
        }
        const damageToCard2HpAfterMagicShield = attackP1Magic - magicShieldAbsorbedByC2;
        
        if (damageToCard2HpAfterMagicShield > 0) {
          card2InCombat.hp -= damageToCard2HpAfterMagicShield; // Magic damage bypasses physical defense
          turnLogEntries.push(`${card2InCombat.title} takes ${damageToCard2HpAfterMagicShield} HP damage from magic. New HP: ${Math.max(0,card2InCombat.hp)}`);
        } else {
           turnLogEntries.push(`${card1InCombat.title}'s magic attack was fully absorbed by magic shield.`);
        }
      }

      // --- Player 2's card (card2InCombat) counter-attacks Player 1's card (card1InCombat) if it survived ---
      if (card2InCombat.hp > 0) {
        if (card2InCombat.melee > 0) { // Physical Counter-Attack from Card 2
          const attackP2Melee = card2InCombat.melee;
          turnLogEntries.push(`${card2InCombat.title} counter-attacks ${card1InCombat.title} with ${attackP2Melee} melee damage.`);

          const shieldAbsorbedByC1 = Math.min(card1InCombat.shield, attackP2Melee);
          if (shieldAbsorbedByC1 > 0) {
            turnLogEntries.push(`${card1InCombat.title}'s physical shield absorbs ${shieldAbsorbedByC1} damage.`);
            card1InCombat.shield -= shieldAbsorbedByC1;
          }
          const damageToC1AfterShield = attackP2Melee - shieldAbsorbedByC1;

          if (damageToC1AfterShield > 0) {
            const defenseBlockedByC1 = Math.min(card1InCombat.defense, damageToC1AfterShield);
            if (defenseBlockedByC1 > 0) {
              turnLogEntries.push(`${card1InCombat.title}'s defense blocks ${defenseBlockedByC1} melee damage.`);
            }
            const damageToCard1Hp = Math.max(0, damageToC1AfterShield - defenseBlockedByC1);
            card1InCombat.hp -= damageToCard1Hp;
            turnLogEntries.push(`${card1InCombat.title} takes ${damageToCard1Hp} HP damage. New HP: ${Math.max(0,card1InCombat.hp)}`);
          } else {
            turnLogEntries.push(`${card2InCombat.title}'s melee counter-attack was fully absorbed by shield/defense.`);
          }
        } else if (card2InCombat.magic > 0) { // Magic Counter-Attack from Card 2
          const attackP2Magic = card2InCombat.magic;
          turnLogEntries.push(`${card2InCombat.title} counter-attacks ${card1InCombat.title} with ${attackP2Magic} magic damage.`);

          const magicShieldAbsorbedByC1 = Math.min(card1InCombat.magicShield, attackP2Magic);
          if (magicShieldAbsorbedByC1 > 0) {
            turnLogEntries.push(`${card1InCombat.title}'s magic shield absorbs ${magicShieldAbsorbedByC1} damage.`);
            card1InCombat.magicShield -= magicShieldAbsorbedByC1;
          }
          const damageToCard1HpAfterMagicShield = attackP2Magic - magicShieldAbsorbedByC1;

          if (damageToCard1HpAfterMagicShield > 0) {
            card1InCombat.hp -= damageToCard1HpAfterMagicShield; // Magic damage bypasses physical defense
            turnLogEntries.push(`${card1InCombat.title} takes ${damageToCard1HpAfterMagicShield} HP damage from magic. New HP: ${Math.max(0,card1InCombat.hp)}`);
          } else {
            turnLogEntries.push(`${card2InCombat.title}'s magic counter-attack was fully absorbed by magic shield.`);
          }
        }
      } else {
        turnLogEntries.push(`${card2InCombat.title} was defeated before it could counter-attack.`);
      }
      
      // Process outcomes for Player 1's card
      if (card1InCombat.hp <= 0) {
        turnLogEntries.push(`${card1InCombat.title} is defeated!`);
        p1Data.discardPile.push({...prev.selectedCardP1, hp: 0, shield: 0, magicShield: 0});
        p1Data.hand = p1Data.hand.filter(c => c.id !== card1InCombat.id);

        if (card2InCombat.hp > 0) { 
            let directDamageToP1 = 0;
            if (card2InCombat.melee > 0) {
                directDamageToP1 += Math.max(0, card2InCombat.melee - initialP1CardDefense);
            }
            if (card2InCombat.magic > 0) {
                directDamageToP1 += card2InCombat.magic; // Magic damage bypasses defeated card's defense
            }
            if(directDamageToP1 > 0) {
                p1Data.hp = Math.max(0, p1Data.hp - directDamageToP1);
                turnLogEntries.push(`${p1Data.name} takes ${directDamageToP1} direct damage. New HP: ${p1Data.hp}`);
            }
        }
        
        if (p1Data.hand.length < CARDS_IN_HAND && p1Data.deck.length > 0) {
          const { dealtCards: newCardsArrP1, remainingDeck: deckAfterDrawP1 } = dealCards(p1Data.deck, 1);
          const newDrawnCardP1 = { ...newCardsArrP1[0], isLoadingArt: true, artUrl: undefined };
          p1Data.hand.push(newDrawnCardP1);
          p1Data.deck = deckAfterDrawP1;
          turnLogEntries.push(`${p1Data.name} draws a new card: ${newDrawnCardP1.title}.`);
        } else if (p1Data.hand.length < CARDS_IN_HAND) {
            turnLogEntries.push(`${p1Data.name} has no cards in deck to draw.`);
        }
      } else {
        p1Data.hand = p1Data.hand.map(c => c.id === card1InCombat.id ? card1InCombat : c);
        turnLogEntries.push(`${card1InCombat.title} survives the clash.`);
      }

      // Process outcomes for Player 2's card
      if (card2InCombat.hp <= 0) {
        turnLogEntries.push(`${card2InCombat.title} is defeated!`);
        p2Data.discardPile.push({...prev.selectedCardP2, hp: 0, shield: 0, magicShield: 0});
        p2Data.hand = p2Data.hand.filter(c => c.id !== card2InCombat.id);

        if (card1InCombat.hp > 0) {
            let directDamageToP2 = 0;
            if (card1InCombat.melee > 0) {
                directDamageToP2 += Math.max(0, card1InCombat.melee - initialP2CardDefense);
            }
            if (card1InCombat.magic > 0) {
                directDamageToP2 += card1InCombat.magic; // Magic damage bypasses defeated card's defense
            }
             if (directDamageToP2 > 0) { 
                p2Data.hp = Math.max(0, p2Data.hp - directDamageToP2);
                turnLogEntries.push(`${p2Data.name} takes ${directDamageToP2} direct damage. New HP: ${p2Data.hp}`);
            }
        }
        
        if (p2Data.hand.length < CARDS_IN_HAND && p2Data.deck.length > 0) {
          const { dealtCards: newCardsArrP2, remainingDeck: deckAfterDrawP2 } = dealCards(p2Data.deck, 1);
          const newDrawnCardP2 = { ...newCardsArrP2[0], isLoadingArt: true, artUrl: undefined };
          p2Data.hand.push(newDrawnCardP2);
          p2Data.deck = deckAfterDrawP2;
          turnLogEntries.push(`${p2Data.name} draws a new card: ${newDrawnCardP2.title}.`);
        } else if (p2Data.hand.length < CARDS_IN_HAND ) {
            turnLogEntries.push(`${p2Data.name} has no cards in deck to draw.`);
        }
      } else {
        p2Data.hand = p2Data.hand.map(c => c.id === card2InCombat.id ? card2InCombat : c);
        turnLogEntries.push(`${card2InCombat.title} survives the clash.`);
      }

      let newGamePhase: GamePhase = 'combat_summary';
      let winner: PlayerData | undefined = undefined;

      if (p1Data.hp <= 0 && p2Data.hp <= 0) {
        winner = undefined; 
        newGamePhase = 'game_over';
        turnLogEntries.push("It's a draw! Both players have been defeated.");
      } else if (p1Data.hp <= 0) {
        winner = prev.players[1];
        newGamePhase = 'game_over';
        turnLogEntries.push(`${prev.players[1].name} wins! ${prev.players[0].name} has been defeated.`);
      } else if (p2Data.hp <= 0) {
        winner = prev.players[0];
        newGamePhase = 'game_over';
        turnLogEntries.push(`${prev.players[0].name} wins! ${prev.players[1].name} has been defeated.`);
      }
      
      const finalSelectedCardP1ForArena = card1InCombat.hp > 0 ? { ...card1InCombat } : undefined;
      const finalSelectedCardP2ForArena = card2InCombat.hp > 0 ? { ...card2InCombat } : undefined;
      
      const persistentMessages = (prev.gameLogMessages || []).filter(msg => msg.startsWith("Game initialized.") || msg.includes("wins the toss"));
      const logMessagesForThisTurn = [...new Set([...persistentMessages, ...turnLogEntries])];


      return {
        ...prev,
        players: [p1Data, p2Data],
        selectedCardP1: finalSelectedCardP1ForArena, 
        selectedCardP2: finalSelectedCardP2ForArena, 
        gamePhase: newGamePhase,
        winner,
        gameLogMessages: logMessagesForThisTurn,
      };
    });
  };

  const handleProceedToNextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      // Player 1 (index 0) always starts the new round's selection phase.
      // Could be alternated based on previous coin flip winner or other logic.
      const nextPlayerToSelect = prev.players[0]; 
      
      const persistentMessages = (prev.gameLogMessages || []).filter(msg => msg.startsWith("Game initialized.") || msg.includes("wins the toss"));
      const newLogMessages = [
          ...persistentMessages, // Keep initial setup messages
          `A new round begins! ${nextPlayerToSelect.name}, select your champion!`
      ];

      return {
        ...prev,
        selectedCardP1: undefined, 
        selectedCardP2: undefined, 
        gameLogMessages: newLogMessages,
        currentPlayerIndex: 0, // Player 1 to select first in new round
        gamePhase: 'player1_select_card',
      };
    });
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">Initializing Arcane Clash...</p>
      </div>
    );
  }
  
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
          onProceedToNextTurn={gamePhase === 'combat_summary' ? handleProceedToNextTurn : undefined}
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
