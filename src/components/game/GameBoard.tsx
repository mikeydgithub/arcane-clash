
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase, MonsterCardData, SpellCardData } from '@/types';
import { generateMonsterCards, generateSpellCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { MONSTER_CARD_TITLES, SPELL_CARD_TITLES } from '@/lib/card-definitions';
import { generateCardArt } from '@/ai/flows/generate-card-art';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Layers3, Trash2 } from 'lucide-react';

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;
const MAX_MONSTERS_PER_DECK = 13;
const MAX_SPELLS_PER_DECK = 12;
const TOTAL_DECK_SIZE = MAX_MONSTERS_PER_DECK + MAX_SPELLS_PER_DECK;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const artGenerationQueueRef = useRef<Set<string>>(new Set());

  const initializeGame = useCallback(async () => {
    hasInitialized.current = true; 
    setGameState(prev => ({...(prev || {} as GameState), gamePhase: 'loading_art', gameLogMessages: ["Initializing Arcane Clash... Generating cards..."]}));

    // Ensure enough unique titles, or repeat if necessary for larger pools
    const neededMonsterTitles = MONSTER_CARD_TITLES.slice(0, MAX_MONSTERS_PER_DECK * 2);
    const neededSpellTitles = SPELL_CARD_TITLES.slice(0, MAX_SPELLS_PER_DECK * 2);

    const masterMonsterPool = shuffleDeck(await generateMonsterCards(neededMonsterTitles));
    const masterSpellPool = shuffleDeck(await generateSpellCards(neededSpellTitles));

    const p1Monsters = masterMonsterPool.slice(0, MAX_MONSTERS_PER_DECK);
    const p1Spells = masterSpellPool.slice(0, MAX_SPELLS_PER_DECK);
    const player1DeckFull = shuffleDeck([...p1Monsters, ...p1Spells]);

    const p2Monsters = masterMonsterPool.slice(MAX_MONSTERS_PER_DECK, MAX_MONSTERS_PER_DECK * 2);
    const p2Spells = masterSpellPool.slice(MAX_SPELLS_PER_DECK, MAX_SPELLS_PER_DECK * 2);
    const player2DeckFull = shuffleDeck([...p2Monsters, ...p2Spells]);
    
    const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1DeckFull, CARDS_IN_HAND);
    const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2DeckFull, CARDS_IN_HAND);

    const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;

    const initialPlayer1: PlayerData = {
      id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP,
      hand: p1InitialHand.map(c => ({ ...c, isLoadingArt: true, artUrl: undefined })), 
      deck: p1DeckAfterDeal,
      discardPile: [],
      avatarUrl: 'https://placehold.co/64x64.png?text=P1', 
    };
    const initialPlayer2: PlayerData = {
      id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
      hand: p2InitialHand.map(c => ({ ...c, isLoadingArt: true, artUrl: undefined })), 
      deck: p2DeckAfterDeal,
      discardPile: [],
      avatarUrl: 'https://placehold.co/64x64.png?text=P2', 
    };
    
    setGameState({
      players: [initialPlayer1, initialPlayer2],
      currentPlayerIndex: firstPlayerIndex,
      gamePhase: 'coin_flip_animation', 
      selectedCardP1: undefined,
      selectedCardP2: undefined,
      winner: undefined,
      gameLogMessages: [`Game cards generated. ${firstPlayerIndex === 0 ? initialPlayer1.name : initialPlayer2.name} will be determined by coin flip. Flipping coin...`],
    });
    artGenerationQueueRef.current.clear();
  }, [toast]); 

  const handleCoinFlipAnimationComplete = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      const nextPhase = prev.currentPlayerIndex === 0 ? 'player1_select_card' : 'player2_select_card';
      
      const baseLog = (prev.gameLogMessages || []).filter(msg => msg.startsWith("Game cards generated."));
      
      return {
        ...prev,
        gamePhase: nextPhase,
        gameLogMessages: [
          ...baseLog,
          `${firstPlayer.name} wins the toss and will go first!`,
          `${firstPlayer.name}, select your card!`
        ]
      };
    });
  }, []);

  useEffect(() => {
    if (!gameState && !hasInitialized.current) { 
        const init = async () => {
            await initializeGame();
        };
        init();
    }
  }, [gameState, initializeGame]);

   useEffect(() => {
    if (!gameState || !gameState.players || gameState.gamePhase === 'initial' || gameState.gamePhase === 'game_over' || gameState.gamePhase === 'loading_art') {
        return; 
    }

    const artQueue = artGenerationQueueRef.current;
    const cardsToFetchArtFor: { playerId: string, cardId: string, cardTitle: string }[] = [];

    gameState.players.forEach(player => {
        player.hand.forEach(card => {
            // Fetch art if isLoadingArt is true, not in queue, and no artUrl yet
            if (card.isLoadingArt && !artQueue.has(card.id) && !card.artUrl) {
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
                         setTimeout(() => { // Use timeout to batch state updates
                            setGameState(currentGS => {
                                if (!currentGS) return null;
                                const updatedPlayers = currentGS.players.map(p => {
                                    if (p.id === playerId) {
                                        return {
                                            ...p,
                                            hand: p.hand.map(c =>
                                                c.id === cardId ? { ...c, artUrl: artResult.cardArtDataUri, isLoadingArt: false } : c
                                            ),
                                            deck: p.deck.map(c => // Also check deck for this card ID
                                                c.id === cardId ? { ...c, artUrl: artResult.cardArtDataUri, isLoadingArt: false } : c
                                            ),
                                        };
                                    }
                                    return p;
                                });
                                return { ...currentGS, players: updatedPlayers as [PlayerData, PlayerData] };
                            });
                        },0);
                    })
                    .catch(err => {
                        console.error(`Art gen error for card ${cardTitle} (ID: ${cardId}) for player ${playerId}:`, err);
                        setTimeout(() => {
                            toast({ title: "Art Generation Error", description: `Could not generate art for ${cardTitle}. Using placeholder.`, variant: "destructive" });
                            setGameState(currentGS => { // Ensure isLoadingArt is set to false on error
                                if (!currentGS) return null;
                                const updatedPlayers = currentGS.players.map(p => {
                                    if (p.id === playerId) {
                                        return {
                                            ...p,
                                            hand: p.hand.map(c =>
                                                c.id === cardId ? { ...c, isLoadingArt: false, artUrl: undefined } : c 
                                            ),
                                             deck: p.deck.map(c =>
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
                        setTimeout(() => artQueue.delete(cardId), 0);
                    });
            }
        });
    }
  }, [gameState?.players, gameState?.gamePhase, toast]);


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase, players, gameLogMessages } = gameState;
    const currentPlayer = players[currentPlayerIndex];
    const opponentPlayer = players[1 - currentPlayerIndex];

    const baseLog = (gameLogMessages || []).filter(msg => msg.startsWith("Game cards generated.") || msg.includes("wins the toss"));

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0) {
      const message = card.cardType === 'Spell' 
        ? `${currentPlayer.name} prepares to cast ${card.title}.` 
        : `${currentPlayer.name} plays ${card.title}.`;
      setGameState(prev => ({ ...prev!, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, gameLogMessages: [...baseLog, message, `${opponentPlayer.name}, select your card!`] }));
    } 
    else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1) {
      const messageP1 = gameState.selectedCardP1?.cardType === 'Spell'
        ? `${players[0].name} readied the spell ${gameState.selectedCardP1.title}.`
        : `${players[0].name} played ${gameState.selectedCardP1!.title}.`;
      const messageP2 = card.cardType === 'Spell'
        ? `${currentPlayer.name} responds by preparing the spell ${card.title}.`
        : `${currentPlayer.name} responds with ${card.title}.`;
      
      setGameState(prev => ({ ...prev!, selectedCardP2: card, gamePhase: 'combat_animation', gameLogMessages: [...baseLog, messageP1, messageP2, "Prepare for the outcome!"] }));
      setTimeout(() => resolveTurn(), 1200); 
    }
  };

  const resolveTurn = () => {
    setGameState(prev => {
      if (!prev || (!prev.selectedCardP1 && !prev.selectedCardP2)) return prev; // Should not happen if called correctly

      let p1Data = { ...prev.players[0], hand: [...prev.players[0].hand], deck: [...prev.players[0].deck], discardPile: [...prev.players[0].discardPile] };
      let p2Data = { ...prev.players[1], hand: [...prev.players[1].hand], deck: [...prev.players[1].deck], discardPile: [...prev.players[1].discardPile] };
      
      let card1InPlay = prev.selectedCardP1 ? { ...prev.selectedCardP1 } : undefined;
      let card2InPlay = prev.selectedCardP2 ? { ...prev.selectedCardP2 } : undefined;

      const turnLogEntries: string[] = [];

      // --- Spell Resolution (if any) ---
      // Player 1's spell
      if (card1InPlay?.cardType === 'Spell') {
        turnLogEntries.push(`${p1Data.name} casts ${card1InPlay.title}! Effect: ${card1InPlay.description}`);
        // TODO: Implement actual spell effect logic here in future
        p1Data.discardPile.push(card1InPlay);
        p1Data.hand = p1Data.hand.filter(c => c.id !== card1InPlay!.id);
        card1InPlay = undefined; // Spell is used up
      }
      // Player 2's spell
      if (card2InPlay?.cardType === 'Spell') {
        turnLogEntries.push(`${p2Data.name} casts ${card2InPlay.title}! Effect: ${card2InPlay.description}`);
        // TODO: Implement actual spell effect logic here in future
        p2Data.discardPile.push(card2InPlay);
        p2Data.hand = p2Data.hand.filter(c => c.id !== card2InPlay!.id);
        card2InPlay = undefined; // Spell is used up
      }

      // --- Monster Combat (if monsters are in play) ---
      if (card1InPlay?.cardType === 'Monster' && card2InPlay?.cardType === 'Monster') {
        const monster1 = card1InPlay as MonsterCardData;
        const monster2 = card2InPlay as MonsterCardData;
        turnLogEntries.push(`Combat: ${monster1.title} (P1) vs ${monster2.title} (P2)!`);

        // Monster 1 attacks Monster 2
        if (monster1.melee > 0) {
          const damageDealt = monster1.melee;
          turnLogEntries.push(`${monster1.title} attacks ${monster2.title} with ${damageDealt} melee.`);
          const shieldAbsorbed = Math.min(monster2.shield, damageDealt);
          if (shieldAbsorbed > 0) { monster2.shield -= shieldAbsorbed; turnLogEntries.push(`${monster2.title}'s shield absorbs ${shieldAbsorbed}.`); }
          const damageAfterShield = damageDealt - shieldAbsorbed;
          if (damageAfterShield > 0) {
            const defenseBlocked = Math.min(monster2.defense, damageAfterShield);
            if (defenseBlocked > 0) turnLogEntries.push(`${monster2.title}'s defense blocks ${defenseBlocked}.`);
            const hpDamage = Math.max(0, damageAfterShield - defenseBlocked);
            monster2.hp -= hpDamage;
            turnLogEntries.push(`${monster2.title} takes ${hpDamage} HP damage. New HP: ${Math.max(0, monster2.hp)}`);
          }
        } else if (monster1.magic > 0) {
          const damageDealt = monster1.magic;
           turnLogEntries.push(`${monster1.title} attacks ${monster2.title} with ${damageDealt} magic.`);
          const shieldAbsorbed = Math.min(monster2.magicShield, damageDealt);
          if (shieldAbsorbed > 0) { monster2.magicShield -= shieldAbsorbed; turnLogEntries.push(`${monster2.title}'s magic shield absorbs ${shieldAbsorbed}.`); }
          const hpDamage = Math.max(0, damageDealt - shieldAbsorbed);
          monster2.hp -= hpDamage;
          turnLogEntries.push(`${monster2.title} takes ${hpDamage} HP damage from magic. New HP: ${Math.max(0, monster2.hp)}`);
        }

        // Monster 2 counter-attacks Monster 1 (if alive)
        if (monster2.hp > 0) {
          if (monster2.melee > 0) {
            const damageDealt = monster2.melee;
            turnLogEntries.push(`${monster2.title} counter-attacks ${monster1.title} with ${damageDealt} melee.`);
            const shieldAbsorbed = Math.min(monster1.shield, damageDealt);
            if (shieldAbsorbed > 0) { monster1.shield -= shieldAbsorbed; turnLogEntries.push(`${monster1.title}'s shield absorbs ${shieldAbsorbed}.`); }
            const damageAfterShield = damageDealt - shieldAbsorbed;
            if (damageAfterShield > 0) {
              const defenseBlocked = Math.min(monster1.defense, damageAfterShield);
              if (defenseBlocked > 0) turnLogEntries.push(`${monster1.title}'s defense blocks ${defenseBlocked}.`);
              const hpDamage = Math.max(0, damageAfterShield - defenseBlocked);
              monster1.hp -= hpDamage;
              turnLogEntries.push(`${monster1.title} takes ${hpDamage} HP damage. New HP: ${Math.max(0, monster1.hp)}`);
            }
          } else if (monster2.magic > 0) {
             const damageDealt = monster2.magic;
             turnLogEntries.push(`${monster2.title} counter-attacks ${monster1.title} with ${damageDealt} magic.`);
            const shieldAbsorbed = Math.min(monster1.magicShield, damageDealt);
            if (shieldAbsorbed > 0) { monster1.magicShield -= shieldAbsorbed; turnLogEntries.push(`${monster1.title}'s magic shield absorbs ${shieldAbsorbed}.`); }
            const hpDamage = Math.max(0, damageDealt - shieldAbsorbed);
            monster1.hp -= hpDamage;
            turnLogEntries.push(`${monster1.title} takes ${hpDamage} HP damage from magic. New HP: ${Math.max(0, monster1.hp)}`);
          }
        } else {
          turnLogEntries.push(`${monster2.title} was defeated before it could counter-attack.`);
        }
        
        // Update card states or move to discard
        if (monster1.hp <= 0) {
          turnLogEntries.push(`${monster1.title} (P1) is defeated!`);
          p1Data.discardPile.push({...prev.selectedCardP1!, hp: 0, shield: 0, magicShield: 0 } as MonsterCardData);
          p1Data.hand = p1Data.hand.filter(c => c.id !== monster1.id);
          card1InPlay = undefined;
        } else {
          p1Data.hand = p1Data.hand.map(c => c.id === monster1.id ? monster1 : c);
        }
        if (monster2.hp <= 0) {
          turnLogEntries.push(`${monster2.title} (P2) is defeated!`);
          p2Data.discardPile.push({...prev.selectedCardP2!, hp: 0, shield: 0, magicShield: 0 } as MonsterCardData);
          p2Data.hand = p2Data.hand.filter(c => c.id !== monster2.id);
          card2InPlay = undefined;
        } else {
          p2Data.hand = p2Data.hand.map(c => c.id === monster2.id ? monster2 : c);
        }

      } else if (card1InPlay?.cardType === 'Monster') { // P1 monster attacks P2 directly (P2 played spell or no card)
        const monster1 = card1InPlay as MonsterCardData;
        turnLogEntries.push(`${monster1.title} (P1) attacks ${p2Data.name} directly!`);
        const damage = monster1.melee > 0 ? monster1.melee : monster1.magic; // Simplified direct damage
        p2Data.hp = Math.max(0, p2Data.hp - damage);
        turnLogEntries.push(`${p2Data.name} takes ${damage} direct damage. New HP: ${p2Data.hp}`);
        if (monster1.hp <= 0) { // Should not happen if it's attacking directly, but for safety
             p1Data.discardPile.push({...prev.selectedCardP1!, hp: 0, shield: 0, magicShield: 0 } as MonsterCardData);
             p1Data.hand = p1Data.hand.filter(c => c.id !== monster1.id);
             card1InPlay = undefined;
        } else {
             p1Data.hand = p1Data.hand.map(c => c.id === monster1.id ? monster1 : c);
        }

      } else if (card2InPlay?.cardType === 'Monster') { // P2 monster attacks P1 directly
        const monster2 = card2InPlay as MonsterCardData;
        turnLogEntries.push(`${monster2.title} (P2) attacks ${p1Data.name} directly!`);
        const damage = monster2.melee > 0 ? monster2.melee : monster2.magic;
        p1Data.hp = Math.max(0, p1Data.hp - damage);
        turnLogEntries.push(`${p1Data.name} takes ${damage} direct damage. New HP: ${p1Data.hp}`);
         if (monster2.hp <= 0) {
             p2Data.discardPile.push({...prev.selectedCardP2!, hp: 0, shield: 0, magicShield: 0 } as MonsterCardData);
             p2Data.hand = p2Data.hand.filter(c => c.id !== monster2.id);
             card2InPlay = undefined;
        } else {
             p2Data.hand = p2Data.hand.map(c => c.id === monster2.id ? monster2 : c);
        }
      }
      // If both played spells, card1InPlay and card2InPlay are already undefined here.

      // Draw new cards if hands are not full and decks have cards
      [p1Data, p2Data].forEach((playerData, index) => {
          const originalCardInPlay = index === 0 ? prev.selectedCardP1 : prev.selectedCardP2;
          const currentCardInPlay = index === 0 ? card1InPlay : card2InPlay;
          // Card was played and is now gone (defeated monster or cast spell)
          if (originalCardInPlay && !currentCardInPlay) {
              if (playerData.hand.length < CARDS_IN_HAND && playerData.deck.length > 0) {
                  const { dealtCards: newCardsArr, remainingDeck: deckAfterDraw } = dealCards(playerData.deck, 1);
                  const newDrawnCard = { ...newCardsArr[0], isLoadingArt: true, artUrl: undefined };
                  playerData.hand.push(newDrawnCard);
                  playerData.deck = deckAfterDraw;
                  turnLogEntries.push(`${playerData.name} draws a new card: ${newDrawnCard.title}.`);
              } else if (playerData.hand.length < CARDS_IN_HAND) {
                  turnLogEntries.push(`${playerData.name} has no cards in deck to draw.`);
              }
          }
      });


      let newGamePhase: GamePhase = 'combat_resolution';
      let winner: PlayerData | undefined = undefined;

      if (p1Data.hp <= 0 && p2Data.hp <= 0) {
        winner = undefined; newGamePhase = 'game_over';
        turnLogEntries.push("It's a draw! Both players are defeated.");
      } else if (p1Data.hp <= 0) {
        winner = prev.players[1]; newGamePhase = 'game_over';
        turnLogEntries.push(`${prev.players[1].name} wins! ${prev.players[0].name} is defeated.`);
      } else if (p2Data.hp <= 0) {
        winner = prev.players[0]; newGamePhase = 'game_over';
        turnLogEntries.push(`${prev.players[0].name} wins! ${prev.players[1].name} is defeated.`);
      }
      
      const persistentMessages = (prev.gameLogMessages || []).filter(msg => msg.startsWith("Game cards generated.") || msg.includes("wins the toss") || msg.includes("select your card") || msg.includes("plays") || msg.includes("prepares to cast") || msg.includes("responds with") || msg.includes("readied the spell") );
      const logMessagesForThisTurn = [...new Set([...persistentMessages, ...turnLogEntries])];

      return {
        ...prev,
        players: [p1Data, p2Data],
        selectedCardP1: card1InPlay, // This will be undefined if spell was cast or monster defeated
        selectedCardP2: card2InPlay, // This will be undefined if spell was cast or monster defeated
        gamePhase: newGamePhase,
        winner,
        gameLogMessages: logMessagesForThisTurn,
      };
    });
  };

  const handleProceedToNextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      const nextPlayerToSelect = prev.players[0]; // Player 1 always starts a new round of selections for now
      
      const persistentMessages = (prev.gameLogMessages || []).filter(msg => msg.startsWith("Game cards generated.") || msg.includes("wins the toss"));
      const newLogMessages = [
          ...persistentMessages, 
          `A new round begins! ${nextPlayerToSelect.name}, select your card!`
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

  if (!gameState || gameState.gamePhase === 'loading_art') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">{gameState?.gameLogMessages?.slice(-1)[0] || "Initializing Arcane Clash..."}</p>
      </div>
    );
  }
  
  const { players, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, gameLogMessages } = gameState;
  const player1 = players[0];
  const player2 = players[1];

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">
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
          hasCommittedCard={!!selectedCardP1 && (gamePhase === 'player2_select_card' || gamePhase === 'combat_animation' || gamePhase === 'combat_resolution')}
          isOpponent={false}
        />
      </div>

      <div className="flex-grow flex flex-col items-center justify-center min-w-0">
        <BattleArena
          player1Card={selectedCardP1}
          player2Card={selectedCardP2}
          player1Name={player1.name}
          player2Name={player2.name}
          showClashAnimation={gamePhase === 'combat_animation' && !!selectedCardP1 && !!selectedCardP2 && selectedCardP1.cardType === 'Monster' && selectedCardP2.cardType === 'Monster'}
          gameLogMessages={gameLogMessages || []}
          gamePhase={gamePhase}
          onProceedToNextTurn={gamePhase === 'combat_resolution' ? handleProceedToNextTurn : undefined}
          onCoinFlipAnimationComplete={handleCoinFlipAnimationComplete}
          winningPlayerNameForCoinFlip={players[gameState.currentPlayerIndex]?.name}
        />
      </div>

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
          hasCommittedCard={!!selectedCardP2 && (gamePhase === 'player1_select_card' || gamePhase === 'combat_animation' || gamePhase === 'combat_resolution')}
        />
      </div>

      <GameOverModal
        isOpen={gamePhase === 'game_over'}
        winnerName={winner?.name}
        onRestart={() => {
          hasInitialized.current = false; // Allow re-initialization
          artGenerationQueueRef.current.clear(); // Clear art queue
          setGameState(null); // This will trigger initializeGame in useEffect
        }}
      />
    </div>
  );
}
