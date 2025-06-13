
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase, MonsterCardData, SpellCardData, StatusEffect } from '@/types';
import { generateMonsterCards, generateSpellCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { PlayerActions } from './PlayerActions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Layers3, Trash2 } from 'lucide-react';
import { generateCardDescription } from '@/ai/flows/generate-card-description';

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;
const MAX_MONSTERS_PER_DECK = 13;
const MAX_SPELLS_PER_DECK = 12;
const MAX_SPELLS_PER_TURN = 2;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const descriptionQueueRef = useRef<{ card: CardData, playerIndex: number }[]>([]);
  const isFetchingDescriptionRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const previousGameStateRef = useRef<GameState | null>(null);
  const isInitializingRef = useRef(false);


  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const logAndSetGameState = useCallback((updater: React.SetStateAction<GameState | null> | ((prevState: GameState | null) => GameState | null)) => {
    setGameState(updater);
  }, []);

  useEffect(() => {
    const prevState = previousGameStateRef.current;
    const nextState = gameState;

    if (nextState && prevState) {
      // Basic logging for debugging, can be expanded
      if (prevState.gamePhase !== nextState.gamePhase) {
        console.log(`[GAME PHASE CHANGED] From: ${prevState.gamePhase || 'null'} To: ${nextState.gamePhase}`);
      }
      if (prevState.isProcessingAction !== nextState.isProcessingAction) {
        console.log(`[PROCESSING ACTION CHANGED] To: ${nextState.isProcessingAction}`);
      }
      const prevLogs = prevState.gameLogMessages || [];
      const nextLogs = nextState.gameLogMessages || [];
      if (prevLogs.length !== nextLogs.length || prevLogs.some((msg, i) => msg !== nextLogs[i])) {
            const prevLast = prevLogs.slice(-3);
            const nextLast = nextLogs.slice(-3);
            console.log('[GAME LOG CHANGED]', {
                prevLength: prevLogs.length,
                nextLength: nextLogs.length,
                prevTail: prevLast,
                nextTail: nextLast
            });
      }
    } else if (nextState && !prevState && nextState.gamePhase) {
        console.log(`[GAME STATE INITIALIZED] Phase: ${nextState.gamePhase}`);
        if(nextState.gameLogMessages?.length > 0) {
            console.log('[INITIAL GAME LOG]', {
                length: nextState.gameLogMessages.length,
                tail: nextState.gameLogMessages.slice(-3)
            });
        }
    }
    previousGameStateRef.current = nextState ? JSON.parse(JSON.stringify(nextState)) : null;
  }, [gameState]);


  const initializeGame = useCallback(async () => {
    if (isInitializingRef.current) {
      console.log('[GameBoard] InitializeGame: Already in progress, skipping subsequent call.');
      return;
    }
    isInitializingRef.current = true;
    hasInitialized.current = false; 

    console.log('[GameBoard] Initializing game sequence starting (lock acquired)...');

    try {
      logAndSetGameState(prev => ({
        ...(prev || {} as GameState),
        gamePhase: 'loading_art',
        gameLogMessages: ["Initializing Arcane Clash... Preparing cards..."],
        isProcessingAction: true,
        isInitialMonsterEngagement: true,
      }));

      const masterMonsterPool = shuffleDeck(generateMonsterCards());
      const masterSpellPool = shuffleDeck(generateSpellCards());

      if (masterMonsterPool.length < MAX_MONSTERS_PER_DECK * 2 || masterSpellPool.length < MAX_SPELLS_PER_DECK * 2) {
          console.error("Not enough pregenerated cards to build decks. Run 'npm run pregenerate:cards'.");
          toast({
              title: "Card Data Missing",
              description: "Pregenerated card data is incomplete. Please run the generation script or check console.",
              variant: "destructive",
              duration: 10000,
          });
          logAndSetGameState(prev => ({
            ...(prev || {} as GameState),
            gamePhase: 'initial', 
            gameLogMessages: ["Error: Card data missing. Pregenerate cards."],
            isProcessingAction: false,
          }));
          isInitializingRef.current = false;
          return;
      }

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
        hand: p1InitialHand.map(c => ({ ...c, isLoadingDescription: false })),
        deck: p1DeckAfterDeal.map(c => ({ ...c, isLoadingDescription: false })),
        discardPile: [],
        avatarUrl: 'https://placehold.co/64x64.png?text=P1',
        spellsPlayedThisTurn: 0,
      };
      const initialPlayer2: PlayerData = {
        id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
        hand: p2InitialHand.map(c => ({ ...c, isLoadingDescription: false })),
        deck: p2DeckAfterDeal.map(c => ({ ...c, isLoadingDescription: false })),
        discardPile: [],
        avatarUrl: 'https://placehold.co/64x64.png?text=P2',
        spellsPlayedThisTurn: 0,
      };

      logAndSetGameState({
        players: [initialPlayer1, initialPlayer2],
        currentPlayerIndex: firstPlayerIndex,
        gamePhase: 'coin_flip_animation',
        activeMonsterP1: undefined,
        activeMonsterP2: undefined,
        winner: undefined,
        gameLogMessages: ["Game cards ready. First player will be determined by coin flip. Flipping coin..."],
        isProcessingAction: false, 
        isInitialMonsterEngagement: true,
      });

      hasInitialized.current = true; 

      descriptionQueueRef.current = [];
      [...initialPlayer1.hand, ...initialPlayer2.hand].forEach((card, globalIndex) => {
          if (!card.description && card.isLoadingDescription !== true) {
              const playerIndex = globalIndex < initialPlayer1.hand.length ? 0 : 1;
              descriptionQueueRef.current.push({ card, playerIndex });
          }
      });
      if (descriptionQueueRef.current.length > 0) {
          console.log(`[GameBoard] Initial description queue length: ${descriptionQueueRef.current.length}`);
      }
    } catch (error) {
      console.error("Unexpected error during game initialization:", error);
      toast({
          title: "Initialization Error",
          description: "A critical error occurred during game setup. Please try refreshing.",
          variant: "destructive",
          duration: 10000,
      });
      logAndSetGameState(prev => ({
          ...(prev || {} as GameState),
          gamePhase: 'initial', 
          gameLogMessages: [...(prev?.gameLogMessages?.slice(0, -1) || []), "Error: Critical problem during game setup. Refresh may be needed."],
          isProcessingAction: false,
      }));
      hasInitialized.current = false; 
    } finally {
      isInitializingRef.current = false;
      console.log('[GameBoard] Initializing game sequence finished (lock released).');
    }
  }, [toast, logAndSetGameState]);

  const handleCoinFlipAnimationComplete = useCallback(() => {
    logAndSetGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      return {
        ...prev,
        gamePhase: 'player_action_phase',
        gameLogMessages: [
          ...(prev.gameLogMessages || []),
          `${firstPlayer.name} wins the toss and will go first!`,
          `${firstPlayer.name}, it's your turn. Choose an action.`
        ],
        isProcessingAction: false,
      };
    });
  }, [logAndSetGameState]);

  const fetchAndSetCardDescription = useCallback(async (cardToFetch: CardData, playerIndex: number) => {
    if (cardToFetch.description || cardToFetch.isLoadingDescription === true) {
        console.log(`[fetchAndSetCardDescription] Skipping ${cardToFetch.title}, already has description or is currently loading.`);
        return;
    }
    console.log(`[fetchAndSetCardDescription] Attempting to fetch for ${cardToFetch.title}`);

    logAndSetGameState(prev => {
        if (!prev) return null;
        const updateCardInLocation = (sourceArray: CardData[], cardId: string, updates: Partial<CardData>) =>
            sourceArray.map(c => c.id === cardId ? { ...c, ...updates } : c);

        const newPlayers = prev.players.map((p, idx) => {
            if (idx === playerIndex) {
                return {
                    ...p,
                    hand: updateCardInLocation(p.hand, cardToFetch.id, { isLoadingDescription: true }),
                    deck: updateCardInLocation(p.deck, cardToFetch.id, { isLoadingDescription: true }),
                };
            }
            return p;
        }) as [PlayerData, PlayerData];

        let newActiveMonsterP1 = prev.activeMonsterP1;
        if (prev.activeMonsterP1?.id === cardToFetch.id && playerIndex === 0) {
            newActiveMonsterP1 = { ...prev.activeMonsterP1, isLoadingDescription: true };
        }
        let newActiveMonsterP2 = prev.activeMonsterP2;
        if (prev.activeMonsterP2?.id === cardToFetch.id && playerIndex === 1) {
            newActiveMonsterP2 = { ...prev.activeMonsterP2, isLoadingDescription: true };
        }

        return { ...prev, players: newPlayers, activeMonsterP1: newActiveMonsterP1, activeMonsterP2: newActiveMonsterP2 };
    });

    try {
        const descResult = await generateCardDescription({ cardTitle: cardToFetch.title, cardType: cardToFetch.cardType });
        console.log(`[fetchAndSetCardDescription] Successfully fetched for ${cardToFetch.title}`);
        logAndSetGameState(prev => {
            if (!prev) return null;
            const updateCardInLocation = (sourceArray: CardData[], cardId: string, updates: Partial<CardData>) =>
                sourceArray.map(c => c.id === cardId ? { ...c, ...updates } : c);

            const newPlayers = prev.players.map((p, idx) => {
                 if (idx === playerIndex) {
                    return {
                        ...p,
                        hand: updateCardInLocation(p.hand, cardToFetch.id, { description: descResult.description, isLoadingDescription: false }),
                        deck: updateCardInLocation(p.deck, cardToFetch.id, { description: descResult.description, isLoadingDescription: false }),
                    };
                }
                return p;
            }) as [PlayerData, PlayerData];

            let newActiveMonsterP1 = prev.activeMonsterP1;
            if (prev.activeMonsterP1?.id === cardToFetch.id && playerIndex === 0) {
                newActiveMonsterP1 = { ...prev.activeMonsterP1, description: descResult.description, isLoadingDescription: false };
            }
            let newActiveMonsterP2 = prev.activeMonsterP2;
            if (prev.activeMonsterP2?.id === cardToFetch.id && playerIndex === 1) {
                newActiveMonsterP2 = { ...prev.activeMonsterP2, description: descResult.description, isLoadingDescription: false };
            }
            return { ...prev, players: newPlayers, activeMonsterP1: newActiveMonsterP1, activeMonsterP2: newActiveMonsterP2 };
        });
    } catch (error) {
        console.error(`Failed to generate description for ${cardToFetch.title}:`, error);
        toast({ title: "AI Error", description: `Could not fetch description for ${cardToFetch.title}. Using default.`, variant: "destructive" });
        logAndSetGameState(prev => {
            if (!prev) return null;
            const defaultDesc = cardToFetch.cardType === "Monster" ? "A mysterious creature." : "A potent spell.";
            const updateCardInLocation = (sourceArray: CardData[], cardId: string, updates: Partial<CardData>) =>
                sourceArray.map(c => c.id === cardId ? { ...c, ...updates } : c);

            const newPlayers = prev.players.map((p, idx) => {
                if (idx === playerIndex) {
                    return {
                        ...p,
                        hand: updateCardInLocation(p.hand, cardToFetch.id, { description: defaultDesc, isLoadingDescription: false }),
                        deck: updateCardInLocation(p.deck, cardToFetch.id, { description: defaultDesc, isLoadingDescription: false }),
                    };
                }
                return p;
            }) as [PlayerData, PlayerData];

            let newActiveMonsterP1 = prev.activeMonsterP1;
            if (prev.activeMonsterP1?.id === cardToFetch.id && playerIndex === 0) {
                newActiveMonsterP1 = { ...prev.activeMonsterP1, description: defaultDesc, isLoadingDescription: false };
            }
            let newActiveMonsterP2 = prev.activeMonsterP2;
            if (prev.activeMonsterP2?.id === cardToFetch.id && playerIndex === 1) {
                newActiveMonsterP2 = { ...prev.activeMonsterP2, description: defaultDesc, isLoadingDescription: false };
            }
            return { ...prev, players: newPlayers, activeMonsterP1: newActiveMonsterP1, activeMonsterP2: newActiveMonsterP2 };
        });
    }
  }, [toast, logAndSetGameState]);

 useEffect(() => {
    console.log('[GameBoard] Effect: Checking game state for initialization.');
    if (!gameState) {
      console.log('[GameBoard] Effect: gameState is null. Ensuring hasInitialized is false for new init attempt.');
      if(hasInitialized.current) hasInitialized.current = false;
    }

    if (!hasInitialized.current && (!gameState || (gameState.gamePhase === 'initial' || gameState.gamePhase === 'loading_art'))) {
      console.log('[GameBoard] Effect: Conditions met to call initializeGame(). Current state:', gameState ? gameState.gamePhase : 'null', 'HasInitialized:', hasInitialized.current);
      initializeGame();
    } else if (gameState && hasInitialized.current) {
      console.log(`[GameBoard] Effect: Game state exists (${gameState.gamePhase}) and is marked as initialized. No new initialization needed.`);
    } else if (gameState && !hasInitialized.current) {
      console.warn(`[GameBoard] Effect: hasInitialized is false, but gamePhase is ${gameState.gamePhase}. This state is unusual. Consider if re-initialization is needed.`);
    }
  }, [gameState, initializeGame]);

  useEffect(() => {
    if (!gameState || isFetchingDescriptionRef.current || descriptionQueueRef.current.length === 0) return;

    const processQueue = async () => {
        if (descriptionQueueRef.current.length > 0) {
            isFetchingDescriptionRef.current = true;
            const item = descriptionQueueRef.current.shift();

            if (item) {
                const { card, playerIndex } = item;
                const latestGameState = gameStateRef.current;

                let cardNeedsFetching = true;
                if (latestGameState) {
                    const player = latestGameState.players[playerIndex];
                    const cardInHand = player.hand.find(c => c.id === card.id);
                    const cardInDeck = player.deck.find(c => c.id === card.id);
                    const activeMonster = playerIndex === 0 ? latestGameState.activeMonsterP1 : latestGameState.activeMonsterP2;
                    const cardIsActive = activeMonster?.id === card.id;

                    if ((cardInHand && (cardInHand.description || cardInHand.isLoadingDescription === false || cardInHand.isLoadingDescription === true)) ||
                        (cardIsActive && activeMonster && (activeMonster.description || activeMonster.isLoadingDescription === false || activeMonster.isLoadingDescription === true)) ||
                        (cardInDeck && (cardInDeck.description || cardInDeck.isLoadingDescription === false || cardInDeck.isLoadingDescription === true))
                        ) {
                        if( (cardInHand && cardInHand.description) || (cardIsActive && activeMonster && activeMonster.description) || (cardInDeck && cardInDeck.description) ) {
                           cardNeedsFetching = false;
                           console.log(`[ProcessQueue] Card ${card.title} already has description in latest state. Skipping fetch.`);
                        } else if ( (cardInHand && cardInHand.isLoadingDescription === true) || (cardIsActive && activeMonster && activeMonster.isLoadingDescription === true) || (cardInDeck && cardInDeck.isLoadingDescription === true) ) {
                           cardNeedsFetching = false;
                           console.log(`[ProcessQueue] Card ${card.title} is already loading description in latest state. Skipping fetch.`);
                        }
                    }
                }

                if (cardNeedsFetching) {
                     console.log(`[ProcessQueue] Fetching for ${card.title} from queue for player ${playerIndex}.`);
                     await fetchAndSetCardDescription(card, playerIndex);
                }
            }
            isFetchingDescriptionRef.current = false;
            if (descriptionQueueRef.current.length > 0) {
                 console.log(`[ProcessQueue] More items in queue (${descriptionQueueRef.current.length}). Processing next.`);
                 setTimeout(processQueue, 500);
            } else {
                console.log(`[ProcessQueue] Description queue is now empty.`);
            }
        }
    };

    if (!isFetchingDescriptionRef.current && descriptionQueueRef.current.length > 0) {
        console.log(`[GameBoard] Starting to process description queue of length: ${descriptionQueueRef.current.length}`);
        processQueue();
    }
  }, [gameState, fetchAndSetCardDescription]);


  const appendLog = (message: string) => {
    logAndSetGameState(prev => {
      if (!prev) return null;
      const newLogMessages = [...(prev.gameLogMessages || []), message].slice(-100); 
      return { ...prev, gameLogMessages: newLogMessages };
    });
  };


  const applyStatusEffectsAndCheckDefeats = (playerIndexForTurnStart: 0 | 1, currentState: GameState): GameState => {
    let newPlayers = [...currentState.players] as [PlayerData, PlayerData];
    let newActiveMonsterP1 = currentState.activeMonsterP1 ? { ...currentState.activeMonsterP1 } : undefined;
    let newActiveMonsterP2 = currentState.activeMonsterP2 ? { ...currentState.activeMonsterP2 } : undefined;
    let newLogMessages = [...currentState.gameLogMessages];

    const playerWhoseTurnIsStarting = newPlayers[playerIndexForTurnStart];
    let activeMonsterForTurnPlayer = playerIndexForTurnStart === 0 ? newActiveMonsterP1 : newActiveMonsterP2;

    if (activeMonsterForTurnPlayer && activeMonsterForTurnPlayer.statusEffects && activeMonsterForTurnPlayer.statusEffects.length > 0) {
        const effectsToKeep: StatusEffect[] = [];
        for (const effect of activeMonsterForTurnPlayer.statusEffects) {
            if (effect.type === 'regenerate') {
                const healAmount = effect.value;
                const originalHp = activeMonsterForTurnPlayer.hp;
                activeMonsterForTurnPlayer.hp = Math.min(activeMonsterForTurnPlayer.maxHp, activeMonsterForTurnPlayer.hp + healAmount);
                if (activeMonsterForTurnPlayer.hp > originalHp) {
                    newLogMessages.push(`${playerWhoseTurnIsStarting.name}'s ${activeMonsterForTurnPlayer.title} regenerates ${activeMonsterForTurnPlayer.hp - originalHp} HP. (HP: ${originalHp} -> ${activeMonsterForTurnPlayer.hp})`);
                }
                effect.duration -= 1;
            }
            // Add other status effect processing here

            if (effect.duration > 0) {
                effectsToKeep.push(effect);
            } else {
                newLogMessages.push(`${playerWhoseTurnIsStarting.name}'s ${activeMonsterForTurnPlayer.title}'s ${effect.type} effect wears off.`);
            }
        }
        activeMonsterForTurnPlayer.statusEffects = effectsToKeep.length > 0 ? effectsToKeep : undefined;

        if (playerIndexForTurnStart === 0) {
            newActiveMonsterP1 = activeMonsterForTurnPlayer;
        } else {
            newActiveMonsterP2 = activeMonsterForTurnPlayer;
        }
    }
    // Potentially check for defeats caused by DoT effects here in the future

    return {
        ...currentState,
        players: newPlayers,
        activeMonsterP1: newActiveMonsterP1,
        activeMonsterP2: newActiveMonsterP2,
        gameLogMessages: newLogMessages
    };
  };


  const processTurnEnd = () => {
    console.log("[GameBoard] Processing turn end...");
    logAndSetGameState(prev => {
      if (!prev) return null;
      let { players, currentPlayerIndex, gameLogMessages, activeMonsterP1, activeMonsterP2, isInitialMonsterEngagement } = prev;
      
      const actingPlayerInitial = players[currentPlayerIndex];
      const opponentPlayerIndex = (1 - currentPlayerIndex) as 0 | 1;
      const opponentPlayer = players[opponentPlayerIndex];

      const playerAfterAction = {
          ...actingPlayerInitial,
          spellsPlayedThisTurn: 0, 
      };
      let updatedPlayersArr = [...players] as [PlayerData, PlayerData];
      updatedPlayersArr[currentPlayerIndex] = playerAfterAction;
      
      let newLogMessages = [...(gameLogMessages || [])];
      
      const stateForStatusEffects: GameState = {
          players: updatedPlayersArr,
          currentPlayerIndex: prev.currentPlayerIndex, // Still original player for this temporary state
          gamePhase: prev.gamePhase, // Not changing phase yet
          activeMonsterP1: activeMonsterP1 ? {...activeMonsterP1} : undefined,
          activeMonsterP2: activeMonsterP2 ? {...activeMonsterP2} : undefined,
          winner: prev.winner,
          gameLogMessages: newLogMessages,
          isProcessingAction: prev.isProcessingAction, // Carry over
          isInitialMonsterEngagement: prev.isInitialMonsterEngagement, // Carry over
      };
      
      const stateAfterStatusEffects = applyStatusEffectsAndCheckDefeats(opponentPlayerIndex, stateForStatusEffects);
      
      updatedPlayersArr = stateAfterStatusEffects.players;
      activeMonsterP1 = stateAfterStatusEffects.activeMonsterP1;
      activeMonsterP2 = stateAfterStatusEffects.activeMonsterP2;
      newLogMessages = stateAfterStatusEffects.gameLogMessages;

      let actingPlayerHand = [...updatedPlayersArr[currentPlayerIndex].hand];
      let actingPlayerDeck = [...updatedPlayersArr[currentPlayerIndex].deck];

      if (actingPlayerHand.length < CARDS_IN_HAND && actingPlayerDeck.length > 0) {
        const { dealtCards, remainingDeck } = dealCards(actingPlayerDeck, 1);
        const drawnCard = { ...dealtCards[0] };

        actingPlayerHand.push(drawnCard);
        actingPlayerDeck = remainingDeck;
        newLogMessages.push(`${updatedPlayersArr[currentPlayerIndex].name} draws ${drawnCard.title}.`);

        if (!drawnCard.description && drawnCard.isLoadingDescription !== true && drawnCard.isLoadingDescription !== false) {
            const alreadyQueued = descriptionQueueRef.current.some(item => item.card.id === drawnCard.id);
            if (!alreadyQueued) {
                const latestGameStateForDraw = gameStateRef.current;
                let isAlreadyLoadingOrFetchedInState = false;
                if (latestGameStateForDraw) {
                    const cardInCurrentHand = latestGameStateForDraw.players[currentPlayerIndex]?.hand.find(c => c.id === drawnCard.id);
                    if (cardInCurrentHand && (cardInCurrentHand.description || cardInCurrentHand.isLoadingDescription)) {
                        isAlreadyLoadingOrFetchedInState = true;
                    }
                }
                if (!isAlreadyLoadingOrFetchedInState) {
                    console.log(`[processTurnEnd] Queuing drawn card ${drawnCard.title} for description fetch.`);
                    descriptionQueueRef.current.push({ card: drawnCard, playerIndex: currentPlayerIndex });
                } else {
                    console.log(`[processTurnEnd] Drawn card ${drawnCard.title} already has/is loading description.`);
                }
            }
        }
      } else if (actingPlayerHand.length < CARDS_IN_HAND) {
        newLogMessages.push(`${updatedPlayersArr[currentPlayerIndex].name} has no cards left in their deck to draw.`);
      }

      updatedPlayersArr[currentPlayerIndex] = { ...updatedPlayersArr[currentPlayerIndex], hand: actingPlayerHand, deck: actingPlayerDeck };
      updatedPlayersArr[opponentPlayerIndex] = { ...updatedPlayersArr[opponentPlayerIndex], spellsPlayedThisTurn: 0};


      if (updatedPlayersArr[0].hp <= 0 && updatedPlayersArr[1].hp <= 0) {
        newLogMessages.push("It's a draw! Both players are defeated.");
        return { 
            players: updatedPlayersArr, 
            activeMonsterP1, 
            activeMonsterP2, 
            winner: undefined, 
            gamePhase: 'game_over_phase', 
            gameLogMessages: newLogMessages, 
            isProcessingAction: false,
            currentPlayerIndex: prev.currentPlayerIndex, // Doesn't matter much here
            isInitialMonsterEngagement: prev.isInitialMonsterEngagement,
         };
      } else if (updatedPlayersArr[0].hp <= 0) {
        newLogMessages.push(`${updatedPlayersArr[1].name} wins! ${updatedPlayersArr[0].name} is defeated.`);
        return { 
            players: updatedPlayersArr, 
            activeMonsterP1, 
            activeMonsterP2, 
            winner: updatedPlayersArr[1], 
            gamePhase: 'game_over_phase', 
            gameLogMessages: newLogMessages, 
            isProcessingAction: false,
            currentPlayerIndex: prev.currentPlayerIndex,
            isInitialMonsterEngagement: prev.isInitialMonsterEngagement,
        };
      } else if (updatedPlayersArr[1].hp <= 0) {
        newLogMessages.push(`${updatedPlayersArr[0].name} wins! ${updatedPlayersArr[1].name} is defeated.`);
        return { 
            players: updatedPlayersArr, 
            activeMonsterP1, 
            activeMonsterP2, 
            winner: updatedPlayersArr[0], 
            gamePhase: 'game_over_phase', 
            gameLogMessages: newLogMessages, 
            isProcessingAction: false,
            currentPlayerIndex: prev.currentPlayerIndex,
            isInitialMonsterEngagement: prev.isInitialMonsterEngagement,
        };
      }

      newLogMessages.push(`Turn ends. It's now ${opponentPlayer.name}'s turn.`);
      newLogMessages.push(`${opponentPlayer.name}, choose your action.`);
      
      const finalStateForTurnEnd = {
        players: updatedPlayersArr,
        currentPlayerIndex: opponentPlayerIndex,
        gamePhase: 'player_action_phase' as GamePhase,
        activeMonsterP1,
        activeMonsterP2,
        winner: prev.winner, // Carry over existing winner state (should be undefined if no game over)
        gameLogMessages: newLogMessages,
        isProcessingAction: false,
        isInitialMonsterEngagement: prev.isInitialMonsterEngagement, // Carry over this flag
      };
      console.log('[GameBoard] processTurnEnd: Attempting to set final state:', {
          currentPlayerIndex: finalStateForTurnEnd.currentPlayerIndex,
          gamePhase: finalStateForTurnEnd.gamePhase,
          isProcessingAction: finalStateForTurnEnd.isProcessingAction,
          logLength: finalStateForTurnEnd.gameLogMessages.length
      });
      return finalStateForTurnEnd;
    });
  };

  const handlePlayMonsterFromHand = (card: MonsterCardData) => {
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;

    const { players, currentPlayerIndex, isInitialMonsterEngagement } = currentBoardGameState;
    const player = players[currentPlayerIndex];

    logAndSetGameState(prev => ({...prev!, isProcessingAction: true}));


    const newHand = player.hand.filter(c => c.id !== card.id);
    const updatedPlayer = { ...player, hand: newHand };
    const newPlayers = [...players]as [PlayerData, PlayerData];
    newPlayers[currentPlayerIndex] = updatedPlayer;

    const wasGloballyFirstMonsterSummoned = isInitialMonsterEngagement;
    appendLog(`${player.name} summons ${card.title} to the arena!`);

    if (!card.description && card.isLoadingDescription !== true && card.isLoadingDescription !== false) {
        const alreadyQueued = descriptionQueueRef.current.some(item => item.card.id === card.id);
        if (!alreadyQueued) {
            console.log(`[handlePlayMonsterFromHand] Queuing ${card.title} for description fetch as it's played.`);
            descriptionQueueRef.current.push({ card, playerIndex: currentPlayerIndex });
        }
    }

    logAndSetGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        players: newPlayers,
        [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: card,
        isInitialMonsterEngagement: false, 
      };
    });

    
    if (wasGloballyFirstMonsterSummoned) {
      appendLog(`${card.title} cannot attack this turn as it's the first monster in play.`);
      logAndSetGameState(prev => ({...prev!, gamePhase: 'turn_resolution_phase'})); 
      setTimeout(() => {
        processTurnEnd();
      }, 1000);
    } else {
      
      appendLog(`${card.title} is ready for action! ${player.name}, choose your next move.`);
      logAndSetGameState(prev => ({
        ...prev!,
        gamePhase: 'player_action_phase', 
        isProcessingAction: false, 
      }));
    }
  };

  const handlePlaySpellFromHand = (card: SpellCardData) => {
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;
    const { players, currentPlayerIndex } = currentBoardGameState;
    const player = players[currentPlayerIndex];

    if (player.spellsPlayedThisTurn >= MAX_SPELLS_PER_TURN) {
        toast({ title: "Spell Limit Reached", description: `You can only play ${MAX_SPELLS_PER_TURN} spells per turn.`, variant: "destructive" });
        return;
    }

    logAndSetGameState(prev => ({...prev!, isProcessingAction: true})); // Initially set to true

    let determinedNextGamePhase: GamePhase = 'initial'; 
    let determinedNextIsProcessingAction: boolean = true;

    const fetchDescIfNeededAndProceed = async () => {
        let spellToLog = { ...card };
        if (!spellToLog.description && spellToLog.isLoadingDescription !== false && spellToLog.isLoadingDescription !== true) {
            try {
                appendLog(`Preparing ${spellToLog.title}...`);
                console.log(`[handlePlaySpellFromHand] Fetching description for spell ${spellToLog.title}`);
                logAndSetGameState(prevGS => {
                    if (!prevGS) return null;
                    const updateCardInHand = (hand: CardData[], id: string, isLoading: boolean) =>
                        hand.map(c => c.id === id ? {...c, isLoadingDescription: isLoading} : c);
                    const newPlayersState = prevGS.players.map((p, idx) =>
                        idx === currentPlayerIndex ? {...p, hand: updateCardInHand(p.hand, spellToLog.id, true)} : p
                    ) as [PlayerData, PlayerData];
                    return {...prevGS, players: newPlayersState};
                });

                const descResult = await generateCardDescription({ cardTitle: spellToLog.title, cardType: spellToLog.cardType });
                spellToLog.description = descResult.description;

                logAndSetGameState(prevGS => {
                    if (!prevGS) return null;
                    const updateCardInHand = (hand: CardData[], id: string, desc: string) =>
                        hand.map(c => c.id === id ? {...c, description: desc, isLoadingDescription: false} : c);
                    const newPlayersState = prevGS.players.map((p, idx) =>
                        idx === currentPlayerIndex ? {...p, hand: updateCardInHand(p.hand, spellToLog.id, descResult.description)} : p
                    ) as [PlayerData, PlayerData];
                    return {...prevGS, players: newPlayersState};
                });
            } catch (e) {
                console.error(`[handlePlaySpellFromHand] Error fetching spell description for ${spellToLog.title}:`, e);
                spellToLog.description = "A mysterious enchantment unfolds."; 
                toast({ title: "AI Error", description: `Could not fetch spell effect for ${spellToLog.title}.`, variant: "destructive" });
                 logAndSetGameState(prevGS => {
                    if (!prevGS) return null;
                    const updateCardInHand = (hand: CardData[], id: string, desc: string) =>
                        hand.map(c => c.id === id ? {...c, description: desc, isLoadingDescription: false} : c);
                    const newPlayersState = prevGS.players.map((p, idx) =>
                        idx === currentPlayerIndex ? {...p, hand: updateCardInHand(p.hand, spellToLog.id, spellToLog.description!)} : p
                    ) as [PlayerData, PlayerData];
                    return {...prevGS, players: newPlayersState};
                });
            }
        }
        
        const effectiveDescription = spellToLog.description || "Effect not yet loaded or defined.";
        appendLog(`${player.name} casts ${spellToLog.title}! Effect: ${effectiveDescription}`);


        logAndSetGameState(prev => {
            try {
                if (!prev) return null;
                let { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2, gameLogMessages } = prev;
                
                let actingPlayer = {...players[currentPlayerIndex]};
                actingPlayer.spellsPlayedThisTurn += 1;

                const opponentPlayerIndex = 1 - currentPlayerIndex;
                const opponentPlayer = players[opponentPlayerIndex];
            
                let newPlayers = [...players] as [PlayerData, PlayerData];
                newPlayers[currentPlayerIndex] = actingPlayer;

                let newActiveMonsterP1 = activeMonsterP1 ? { ...activeMonsterP1 } : undefined;
                let newActiveMonsterP2 = activeMonsterP2 ? { ...activeMonsterP2 } : undefined;
                let newLogMessages = [...(gameLogMessages || [])];
            
                const currentPlayersMonsterRef = currentPlayerIndex === 0 ? newActiveMonsterP1 : newActiveMonsterP2;
                const opponentPlayersMonsterRef = currentPlayerIndex === 0 ? newActiveMonsterP2 : newActiveMonsterP1;
                
                let spellEffectApplied = false;

                switch (spellToLog.title) {
                    case 'Stone Skin':
                        if (currentPlayersMonsterRef) {
                            const boost = 5;
                            currentPlayersMonsterRef.defense = Math.max(0, currentPlayersMonsterRef.defense + boost);
                            newLogMessages.push(`${actingPlayer.name}'s Stone Skin increases ${currentPlayersMonsterRef.title}'s defense by ${boost}! New Defense: ${currentPlayersMonsterRef.defense}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;
            
                    case 'Fireball':
                        const fireDamage = 15;
                        const directPlayerDamage = 10;
                        if (opponentPlayersMonsterRef) {
                            const originalHp = opponentPlayersMonsterRef.hp;
                            const originalMagicShield = opponentPlayersMonsterRef.magicShield;
                            let damageToDeal = fireDamage;
                            let message = `${actingPlayer.name}'s Fireball targets ${opponentPlayersMonsterRef.title}. `;
            
                            let magicShieldAbsorbed = Math.min(opponentPlayersMonsterRef.magicShield, damageToDeal);
                            if (magicShieldAbsorbed > 0) {
                                opponentPlayersMonsterRef.magicShield -= magicShieldAbsorbed;
                                message += `Magic shield absorbs ${magicShieldAbsorbed}. Shield: ${originalMagicShield} -> ${opponentPlayersMonsterRef.magicShield}. `;
                            }
                            damageToDeal -= magicShieldAbsorbed;
            
                            if (damageToDeal > 0) {
                                opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                                message += `Takes ${damageToDeal} fire damage to HP. HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp}.`;
                            } else {
                                message += `No HP damage taken after shield absorption.`;
                            }
                            newLogMessages.push(message);
                            spellEffectApplied = true;
            
                            if (opponentPlayersMonsterRef.hp <= 0) {
                                newLogMessages.push(`${opponentPlayersMonsterRef.title} is incinerated by the Fireball!`);
                                const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, shield:0, magicShield:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        } else { 
                            const originalPlayerHp = newPlayers[opponentPlayerIndex].hp;
                            newPlayers[opponentPlayerIndex].hp = Math.max(0, newPlayers[opponentPlayerIndex].hp - directPlayerDamage);
                            newLogMessages.push(`${actingPlayer.name}'s Fireball strikes ${opponentPlayer.name} directly for ${directPlayerDamage} damage! HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp}.`);
                            spellEffectApplied = true;
                        }
                        break;
            
                    case 'Healing Light':
                        if (currentPlayersMonsterRef) {
                            const healAmount = 20;
                            const originalHp = currentPlayersMonsterRef.hp;
                            currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + healAmount);
                            newLogMessages.push(`${actingPlayer.name}'s Healing Light restores ${currentPlayersMonsterRef.hp - originalHp} HP to ${currentPlayersMonsterRef.title}! HP: ${originalHp} -> ${currentPlayersMonsterRef.hp}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;
                    
                    case 'Arcane Shield':
                        if (currentPlayersMonsterRef) {
                            const shieldAmount = 10;
                            const originalShield = currentPlayersMonsterRef.magicShield;
                            currentPlayersMonsterRef.magicShield += shieldAmount;
                            currentPlayersMonsterRef.maxMagicShield = Math.max(currentPlayersMonsterRef.maxMagicShield, currentPlayersMonsterRef.magicShield); 
                            newLogMessages.push(`${actingPlayer.name}'s Arcane Shield grants ${shieldAmount} magic shield to ${currentPlayersMonsterRef.title}! Magic Shield: ${originalShield} -> ${currentPlayersMonsterRef.magicShield}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;
            
                    case 'Weakening Curse':
                        if (opponentPlayersMonsterRef) {
                            const reduction = 3;
                            const originalMelee = opponentPlayersMonsterRef.melee;
                            const originalMagic = opponentPlayersMonsterRef.magic;
                            opponentPlayersMonsterRef.melee = Math.max(0, opponentPlayersMonsterRef.melee - reduction);
                            opponentPlayersMonsterRef.magic = Math.max(0, opponentPlayersMonsterRef.magic - reduction);
                            newLogMessages.push(`${actingPlayer.name}'s Weakening Curse reduces ${opponentPlayersMonsterRef.title}'s attack power! Melee: ${originalMelee} -> ${opponentPlayersMonsterRef.melee}, Magic: ${originalMagic} -> ${opponentPlayersMonsterRef.magic}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Terrify':
                        if (opponentPlayersMonsterRef) {
                            newLogMessages.push(`${actingPlayer.name}'s Terrify targets ${opponentPlayersMonsterRef.title}!`);
                            const returnedMonster = { ...opponentPlayersMonsterRef, statusEffects: [] }; 
                            
                            if (newPlayers[opponentPlayerIndex].hand.length < CARDS_IN_HAND) {
                                newPlayers[opponentPlayerIndex].hand.push(returnedMonster);
                                newLogMessages.push(`${opponentPlayersMonsterRef.title} is returned to ${opponentPlayer.name}'s hand!`);
                            } else {
                                newPlayers[opponentPlayerIndex].discardPile.push(returnedMonster);
                                newLogMessages.push(`${opponentPlayersMonsterRef.title} couldn't return to a full hand and was discarded!`);
                            }
                            
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Regenerate':
                        if (currentPlayersMonsterRef) {
                            const newEffect: StatusEffect = { id: `regen-${Date.now()}`, type: 'regenerate', duration: 3, value: 5 };
                            currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                            newLogMessages.push(`${actingPlayer.name} applies Regenerate to ${currentPlayersMonsterRef.title}. It will heal 5 HP for 3 turns.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;
                    
                    case 'Swiftness Aura': 
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.melee = Math.max(0, currentPlayersMonsterRef.melee + 3);
                            newLogMessages.push(`${currentPlayersMonsterRef.title} gains +3 Melee from Swiftness Aura. New Melee: ${currentPlayersMonsterRef.melee}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Chain Lightning': 
                        const chainLightningDmg = 10;
                        const chainPlayerDmg = 5;
                        if (opponentPlayersMonsterRef) {
                            const originalHp = opponentPlayersMonsterRef.hp;
                            const originalMagicShield = opponentPlayersMonsterRef.magicShield;
                            let damageToDeal = chainLightningDmg;
                            let message = `${actingPlayer.name}'s Chain Lightning strikes ${opponentPlayersMonsterRef.title}. `;
                            let magicShieldAbsorbed = Math.min(opponentPlayersMonsterRef.magicShield, damageToDeal);
                            if (magicShieldAbsorbed > 0) {
                                opponentPlayersMonsterRef.magicShield -= magicShieldAbsorbed;
                                message += `Magic shield absorbs ${magicShieldAbsorbed}. Shield: ${originalMagicShield} -> ${opponentPlayersMonsterRef.magicShield}. `;
                            }
                            damageToDeal -= magicShieldAbsorbed;
                            if (damageToDeal > 0) {
                                opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                                message += `Takes ${damageToDeal} magic damage. HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp}.`;
                            } else { message += `No HP damage after shield.`; }
                            newLogMessages.push(message);
                            spellEffectApplied = true;

                            if (opponentPlayersMonsterRef.hp <= 0) {
                                newLogMessages.push(`${opponentPlayersMonsterRef.title} is destroyed! The lightning arcs to ${opponentPlayer.name}!`);
                                const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, shield:0, magicShield:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                                
                                const originalPlayerHp = newPlayers[opponentPlayerIndex].hp;
                                newPlayers[opponentPlayerIndex].hp = Math.max(0, newPlayers[opponentPlayerIndex].hp - chainPlayerDmg);
                                newLogMessages.push(`${opponentPlayer.name} takes ${chainPlayerDmg} lightning damage! HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp}.`);
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        } else {
                             newLogMessages.push(`${actingPlayer.name}'s Chain Lightning fizzles! No enemy monster to target.`);
                        }
                        break;

                    case 'Growth Spurt': 
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.maxHp += 10;
                            const originalHp = currentPlayersMonsterRef.hp;
                            currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + 10);
                            newLogMessages.push(`${currentPlayersMonsterRef.title}'s Growth Spurt increases Max HP to ${currentPlayersMonsterRef.maxHp} and heals ${currentPlayersMonsterRef.hp - originalHp} HP. Current HP: ${currentPlayersMonsterRef.hp}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Drain Life': 
                        const drainDamage = 8;
                        if (opponentPlayersMonsterRef) {
                            const originalOpponentHp = opponentPlayersMonsterRef.hp;
                            const originalOpponentMagicShield = opponentPlayersMonsterRef.magicShield;
                            let damageToDeal = drainDamage;
                            let message = `${actingPlayer.name}'s Drain Life targets ${opponentPlayersMonsterRef.title}. `;
                            let magicShieldAbsorbed = Math.min(opponentPlayersMonsterRef.magicShield, damageToDeal);
                            if (magicShieldAbsorbed > 0) {
                                opponentPlayersMonsterRef.magicShield -= magicShieldAbsorbed;
                                message += `Magic shield absorbs ${magicShieldAbsorbed}. Shield: ${originalOpponentMagicShield} -> ${opponentPlayersMonsterRef.magicShield}. `;
                            }
                            damageToDeal -= magicShieldAbsorbed;
                            let actualHPDamage = 0;
                            if (damageToDeal > 0) {
                                actualHPDamage = Math.min(opponentPlayersMonsterRef.hp, damageToDeal);
                                opponentPlayersMonsterRef.hp -= actualHPDamage;
                                message += `Takes ${actualHPDamage} HP damage. HP: ${originalOpponentHp} -> ${opponentPlayersMonsterRef.hp}.`;
                            } else { message += `No HP damage after shield.`; }
                            newLogMessages.push(message);
                            spellEffectApplied = true;
                            
                            if (currentPlayersMonsterRef && actualHPDamage > 0) {
                                const healAmount = Math.floor(actualHPDamage / 2);
                                const originalHealTargetHp = currentPlayersMonsterRef.hp;
                                currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + healAmount);
                                newLogMessages.push(`${currentPlayersMonsterRef.title} is healed by ${currentPlayersMonsterRef.hp - originalHealTargetHp} HP from Drain Life.`);
                                if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            }

                            if (opponentPlayersMonsterRef.hp <= 0) {
                                newLogMessages.push(`${opponentPlayersMonsterRef.title} is drained and defeated!`);
                                const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, shield:0, magicShield:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        } else {
                            newLogMessages.push(`${actingPlayer.name}'s Drain Life finds no target.`);
                        }
                        break;

                    case 'Blinding Flash': 
                         if (opponentPlayersMonsterRef) {
                            const reduction = 2;
                            opponentPlayersMonsterRef.melee = Math.max(0, opponentPlayersMonsterRef.melee - reduction);
                            opponentPlayersMonsterRef.magic = Math.max(0, opponentPlayersMonsterRef.magic - reduction);
                            newLogMessages.push(`Blinding Flash reduces ${opponentPlayersMonsterRef.title}'s Melee to ${opponentPlayersMonsterRef.melee} and Magic to ${opponentPlayersMonsterRef.magic}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Might Infusion': 
                         if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.melee = Math.max(0, currentPlayersMonsterRef.melee + 5);
                            newLogMessages.push(`Might Infusion boosts ${currentPlayersMonsterRef.title}'s Melee to ${currentPlayersMonsterRef.melee}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Frost Nova': 
                        const frostNovaDmg = 5;
                        const frostNovaMeleeReduction = 2;
                        if (opponentPlayersMonsterRef) {
                            const originalHp = opponentPlayersMonsterRef.hp;
                            const originalMagicShield = opponentPlayersMonsterRef.magicShield;
                            let damageToDeal = frostNovaDmg;
                            let message = `${actingPlayer.name}'s Frost Nova chills ${opponentPlayersMonsterRef.title}. `;
                            let magicShieldAbsorbed = Math.min(opponentPlayersMonsterRef.magicShield, damageToDeal);
                            if (magicShieldAbsorbed > 0) {
                                opponentPlayersMonsterRef.magicShield -= magicShieldAbsorbed;
                                message += `Magic shield absorbs ${magicShieldAbsorbed}. Shield: ${originalMagicShield} -> ${opponentPlayersMonsterRef.magicShield}. `;
                            }
                            damageToDeal -= magicShieldAbsorbed;
                            if (damageToDeal > 0) {
                                opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                                message += `Takes ${damageToDeal} magic damage. HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp}.`;
                            } else { message += `No HP damage after shield.`; }
                            
                            const originalMelee = opponentPlayersMonsterRef.melee;
                            opponentPlayersMonsterRef.melee = Math.max(0, opponentPlayersMonsterRef.melee - frostNovaMeleeReduction);
                            message += ` Its Melee is reduced from ${originalMelee} to ${opponentPlayersMonsterRef.melee}.`;
                            newLogMessages.push(message);
                            spellEffectApplied = true;

                            if (opponentPlayersMonsterRef.hp <= 0) {
                                newLogMessages.push(`${opponentPlayersMonsterRef.title} is shattered by Frost Nova!`);
                                 const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, shield:0, magicShield:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        }
                        break;
                    
                    case 'Silence': 
                        if (opponentPlayersMonsterRef) {
                            opponentPlayersMonsterRef.magic = Math.max(0, opponentPlayersMonsterRef.magic - 5);
                            newLogMessages.push(`Silence reduces ${opponentPlayersMonsterRef.title}'s Magic to ${opponentPlayersMonsterRef.magic}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Teleport Strike': 
                    case 'Empower Weapon':  
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.melee = Math.max(0, currentPlayersMonsterRef.melee + 4);
                            newLogMessages.push(`${spellToLog.title} enhances ${currentPlayersMonsterRef.title}'s Melee to ${currentPlayersMonsterRef.melee}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Quicksand Trap': 
                         if (opponentPlayersMonsterRef) {
                            opponentPlayersMonsterRef.melee = Math.max(0, opponentPlayersMonsterRef.melee - 4);
                            opponentPlayersMonsterRef.defense = Math.max(0, opponentPlayersMonsterRef.defense - 2);
                            newLogMessages.push(`Quicksand Trap reduces ${opponentPlayersMonsterRef.title}'s Melee to ${opponentPlayersMonsterRef.melee} and Defense to ${opponentPlayersMonsterRef.defense}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Ethereal Form': 
                         if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.defense += 4;
                            currentPlayersMonsterRef.magicShield += 4;
                            currentPlayersMonsterRef.maxMagicShield = Math.max(currentPlayersMonsterRef.maxMagicShield, currentPlayersMonsterRef.magicShield);
                            newLogMessages.push(`Ethereal Form boosts ${currentPlayersMonsterRef.title}'s Defense to ${currentPlayersMonsterRef.defense} and Magic Shield to ${currentPlayersMonsterRef.magicShield}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;
                    
                    case 'Counterspell': 
                    case 'Mage Armor': 
                         if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.magicShield += 8;
                            currentPlayersMonsterRef.maxMagicShield = Math.max(currentPlayersMonsterRef.maxMagicShield, currentPlayersMonsterRef.magicShield);
                            newLogMessages.push(`${spellToLog.title} grants ${currentPlayersMonsterRef.title} +8 Magic Shield. New Magic Shield: ${currentPlayersMonsterRef.magicShield}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;
                    
                    case 'Summon Minor Spirit': 
                         if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.maxHp += 5;
                            const originalHp = currentPlayersMonsterRef.hp;
                            currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + 5);
                            newLogMessages.push(`${currentPlayersMonsterRef.title} is empowered by a minor spirit! Max HP becomes ${currentPlayersMonsterRef.maxHp}, HP becomes ${currentPlayersMonsterRef.hp}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Dark Pact': 
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.melee += 8;
                            const playerOriginalHp = newPlayers[currentPlayerIndex].hp;
                            newPlayers[currentPlayerIndex].hp = Math.max(0, newPlayers[currentPlayerIndex].hp - 10);
                            newLogMessages.push(`Dark Pact empowers ${currentPlayersMonsterRef.title} with +8 Melee (New: ${currentPlayersMonsterRef.melee}), but ${actingPlayer.name} pays 10 HP (HP: ${playerOriginalHp} -> ${newPlayers[currentPlayerIndex].hp}).`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Focused Mind': 
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.magic += 4;
                            newLogMessages.push(`Focused Mind increases ${currentPlayersMonsterRef.title}'s Magic to ${currentPlayersMonsterRef.magic}.`);
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    default:
                        newLogMessages.push(`${spellToLog.title} is cast, but its specific effect is not yet fully implemented or it fizzled.`);
                        break;
                }
                
                if (!spellEffectApplied && (currentPlayersMonsterRef || opponentPlayersMonsterRef || spellToLog.title === 'Fireball')) { 
                     newLogMessages.push(`${spellToLog.title} was cast but had no valid target or conditions to apply its effect.`);
                }
            
                const handAfterSpell = newPlayers[currentPlayerIndex].hand.filter(c => c.id !== spellToLog.id);
                const discardPileAfterSpell = [...newPlayers[currentPlayerIndex].discardPile, { ...spellToLog, isLoadingDescription: false }];
                newPlayers[currentPlayerIndex] = { ...newPlayers[currentPlayerIndex], hand: handAfterSpell, discardPile: discardPileAfterSpell };
                
                // Determine next phase and processing state based on spells played
                if (newPlayers[currentPlayerIndex].spellsPlayedThisTurn >= MAX_SPELLS_PER_TURN) {
                    newLogMessages.push(`${actingPlayer.name} has played ${MAX_SPELLS_PER_TURN} spells. Turn ending.`);
                    determinedNextGamePhase = 'turn_resolution_phase';
                    determinedNextIsProcessingAction = true;
                } else {
                    const spellsRemaining = MAX_SPELLS_PER_TURN - newPlayers[currentPlayerIndex].spellsPlayedThisTurn;
                    newLogMessages.push(`${actingPlayer.name} played ${spellToLog.title}. Can play ${spellsRemaining} more spell(s) or take another action.`);
                    determinedNextGamePhase = 'player_action_phase';
                    determinedNextIsProcessingAction = false; 
                }
            
                return { // Return the fully updated state after spell effect
                   ...prev, // Spread previous state first
                   players: newPlayers, // Updated players array
                   activeMonsterP1: newActiveMonsterP1, // Potentially updated monster
                   activeMonsterP2: newActiveMonsterP2, // Potentially updated monster
                   gameLogMessages: newLogMessages,    // Updated logs
                   gamePhase: determinedNextGamePhase, // Determined next phase
                   isProcessingAction: determinedNextIsProcessingAction, // Determined processing state
                }
            } catch (error) { // Catch errors from spell effect logic
                console.error("[GameBoard] CRITICAL ERROR within spell effect state updater:", error);
                // Fallback state on critical error during spell effect application
                determinedNextGamePhase = 'turn_resolution_phase'; 
                determinedNextIsProcessingAction = true;           
                return {
                    ...(prev || {} as GameState), // Ensure prev is not null
                    gameLogMessages: [...(prev?.gameLogMessages || []), "Critical error processing spell. Forcing turn end."],
                    gamePhase: determinedNextGamePhase,
                    isProcessingAction: determinedNextIsProcessingAction,
                };
            }
          }); // End of logAndSetGameState for spell application

        // After the state update for spell effects has been dispatched:
        if (determinedNextGamePhase === 'turn_resolution_phase') {
            console.log(`[handlePlaySpellFromHand] Spell resulted in turn_resolution_phase. Scheduling processTurnEnd.`);
            setTimeout(() => processTurnEnd(), 1000);
        } else {
            console.log(`[handlePlaySpellFromHand] Spell did not end turn. New phase: ${determinedNextGamePhase}, Processing: ${determinedNextIsProcessingAction}`);
            // If the turn didn't end, isProcessingAction should now be false from the state update above.
        }
    };

    fetchDescIfNeededAndProceed();
  };

 const handleMonsterAttack = () => {
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;

    logAndSetGameState(prev => {
        if (!prev) return null;
        return {...prev, isProcessingAction: true, gamePhase: 'combat_phase'};
    });

    setTimeout(() => {
        const latestBoardGameState = gameStateRef.current;
        if (!latestBoardGameState) return;

        const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = latestBoardGameState;
        const attackerPlayer = players[currentPlayerIndex];
        const defenderPlayerIndex = 1 - currentPlayerIndex;
        const defenderPlayer = players[defenderPlayerIndex];

        let currentAttackerMonster = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;
        let currentDefenderMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;

        if (!currentAttackerMonster) {
            toast({ title: "No active monster", description: "You need an active monster to attack.", variant: "destructive" });
            logAndSetGameState(prev => ({...prev!, isProcessingAction: false, gamePhase: 'player_action_phase'}));
            return;
        }

        let p1Data = { ...players[0] };
        let p2Data = { ...players[1] };
        let attacker = { ...currentAttackerMonster } as MonsterCardData;
        let defender = currentDefenderMonster ? { ...currentDefenderMonster } as MonsterCardData : undefined;
        let combatLogMessages: string[] = [];

        combatLogMessages.push(`${attackerPlayer.name}'s ${attacker.title} initiates an attack!`);

        if (defender) {
            combatLogMessages.push(`${attacker.title} (M: ${attacker.melee}, A: ${attacker.magic}) clashes with ${defender.title} (HP: ${defender.hp}, Def: ${defender.defense}, Sh: ${defender.shield}, M.Sh: ${defender.magicShield}).`);

            const initialDefenderHp = defender.hp;
            const initialDefenderShield = defender.shield;
            const initialDefenderMagicShield = defender.magicShield;
            let defenderTookDamageThisTurn = false;

            if (attacker.melee > 0) {
                let damageDealt = attacker.melee;
                combatLogMessages.push(`> ${attacker.title} strikes with ${damageDealt} melee power.`);

                let shieldAbsorbed = Math.min(defender.shield, damageDealt);
                if (shieldAbsorbed > 0) {
                    defender.shield -= shieldAbsorbed;
                    combatLogMessages.push(`  L ${defender.title}'s physical shield absorbs ${shieldAbsorbed}. Shield: ${initialDefenderShield} -> ${defender.shield}.`);
                }
                let damageAfterShield = damageDealt - shieldAbsorbed;

                if (damageAfterShield > 0) {
                    combatLogMessages.push(`  L Melee damage after shield: ${damageAfterShield}.`);
                    let defenseBlocked = Math.min(defender.defense, damageAfterShield);
                    if (defenseBlocked > 0) {
                        combatLogMessages.push(`  L ${defender.title}'s defense blocks ${defenseBlocked}.`);
                    }
                    const hpDamage = Math.max(0, damageAfterShield - defenseBlocked);
                    if (hpDamage > 0) {
                        defender.hp -= hpDamage;
                        defenderTookDamageThisTurn = true;
                        combatLogMessages.push(`  L ${defender.title} takes ${hpDamage} HP damage. HP: ${initialDefenderHp} -> ${Math.max(0, defender.hp)}.`);
                    } else {
                        combatLogMessages.push(`  L ${defender.title} takes no HP damage from melee after shield & defense.`);
                    }
                } else if (shieldAbsorbed > 0) {
                    combatLogMessages.push(`  L ${defender.title} takes no further damage; melee attack fully absorbed by shield.`);
                } else {
                    if(damageDealt > 0) combatLogMessages.push(`  L ${attacker.title}'s melee attack was fully mitigated or dealt no damage.`);
                }
            } else if (attacker.magic > 0) {
                let damageDealt = attacker.magic;
                combatLogMessages.push(`> ${attacker.title} blasts with ${damageDealt} magic power.`);

                let magicShieldAbsorbed = Math.min(defender.magicShield, damageDealt);
                if (magicShieldAbsorbed > 0) {
                    defender.magicShield -= magicShieldAbsorbed;
                    combatLogMessages.push(`  L ${defender.title}'s magic shield absorbs ${magicShieldAbsorbed}. Magic Shield: ${initialDefenderMagicShield} -> ${defender.magicShield}.`);
                }
                const hpDamage = Math.max(0, damageDealt - magicShieldAbsorbed);
                if (hpDamage > 0) {
                    defender.hp -= hpDamage;
                    defenderTookDamageThisTurn = true;
                    combatLogMessages.push(`  L ${defender.title} takes ${hpDamage} HP damage from magic. HP: ${initialDefenderHp} -> ${Math.max(0, defender.hp)}.`);
                } else if (magicShieldAbsorbed > 0) {
                    combatLogMessages.push(`  L ${defender.title} takes no further damage; magic attack fully absorbed by magic shield.`);
                } else {
                     if(damageDealt > 0) combatLogMessages.push(`  L ${attacker.title}'s magic attack was fully mitigated or dealt no damage.`);
                }
            } else {
                combatLogMessages.push(`> ${attacker.title} has no attack power this turn.`);
            }
            if (!defenderTookDamageThisTurn && (attacker.melee > 0 || attacker.magic > 0)) {
                combatLogMessages.push(`  L ${defender.title} ultimately received no HP damage from ${attacker.title}'s attack this sequence.`);
            }


            if (defender.hp > 0) {
                combatLogMessages.push(`${defender.title} survives and prepares to counter-attack! (HP: ${defender.hp})`);
                const initialAttackerHp = attacker.hp;
                const initialAttackerShield = attacker.shield;
                const initialAttackerMagicShield = attacker.magicShield;
                let attackerTookDamageThisCounter = false;

                if (defender.melee > 0) {
                    let counterDamage = defender.melee;
                    combatLogMessages.push(`> ${defender.title} counter-attacks with ${counterDamage} melee power.`);
                    let shieldAbsorbed = Math.min(attacker.shield, counterDamage);
                    if (shieldAbsorbed > 0) {
                        attacker.shield -= shieldAbsorbed;
                        combatLogMessages.push(`  L ${attacker.title}'s physical shield absorbs ${shieldAbsorbed}. Shield: ${initialAttackerShield} -> ${attacker.shield}.`);
                    }
                    let damageAfterShield = counterDamage - shieldAbsorbed;
                    if (damageAfterShield > 0) {
                        combatLogMessages.push(`  L Melee counter-damage after shield: ${damageAfterShield}.`);
                        let defenseBlocked = Math.min(attacker.defense, damageAfterShield);
                        if (defenseBlocked > 0) {
                            combatLogMessages.push(`  L ${attacker.title}'s defense blocks ${defenseBlocked}.`);
                        }
                        const hpDamage = Math.max(0, damageAfterShield - defenseBlocked);
                        if (hpDamage > 0) {
                            attacker.hp -= hpDamage;
                            attackerTookDamageThisCounter = true;
                            combatLogMessages.push(`  L ${attacker.title} takes ${hpDamage} HP damage from counter. HP: ${initialAttackerHp} -> ${Math.max(0, attacker.hp)}.`);
                        } else {
                            combatLogMessages.push(`  L ${attacker.title} takes no HP damage from melee counter after shield & defense.`);
                        }
                    } else if (shieldAbsorbed > 0) {
                        combatLogMessages.push(`  L ${attacker.title} takes no further damage; counter fully absorbed by shield.`);
                    } else {
                        if(counterDamage > 0) combatLogMessages.push(`  L ${defender.title}'s melee counter-attack was fully mitigated or dealt no damage.`);
                    }
                } else if (defender.magic > 0) {
                    let counterDamage = defender.magic;
                    combatLogMessages.push(`> ${defender.title} counter-attacks with ${counterDamage} magic power.`);
                    let magicShieldAbsorbed = Math.min(attacker.magicShield, counterDamage);
                    if (magicShieldAbsorbed > 0) {
                        attacker.magicShield -= magicShieldAbsorbed;
                        combatLogMessages.push(`  L ${attacker.title}'s magic shield absorbs ${magicShieldAbsorbed}. Magic Shield: ${initialAttackerMagicShield} -> ${attacker.magicShield}.`);
                    }
                    const hpDamage = Math.max(0, counterDamage - magicShieldAbsorbed);
                    if (hpDamage > 0) {
                        attacker.hp -= hpDamage;
                        attackerTookDamageThisCounter = true;
                        combatLogMessages.push(`  L ${attacker.title} takes ${hpDamage} HP damage from magic counter. HP: ${initialAttackerHp} -> ${Math.max(0, attacker.hp)}.`);
                    } else if (magicShieldAbsorbed > 0) {
                        combatLogMessages.push(`  L ${attacker.title} takes no further damage; magic counter fully absorbed by magic shield.`);
                    } else {
                         if(counterDamage > 0) combatLogMessages.push(`  L ${defender.title}'s magic counter-attack was fully mitigated or dealt no damage.`);
                    }
                } else {
                    combatLogMessages.push(`> ${defender.title} has no power to counter-attack with.`);
                }
                if (!attackerTookDamageThisCounter && (defender.melee > 0 || defender.magic > 0)) {
                    combatLogMessages.push(`  L ${attacker.title} ultimately received no HP damage from ${defender.title}'s counter-attack.`);
                }

            } else {
                combatLogMessages.push(`${defender.title} was defeated before it could counter-attack.`);
            }
        } else {
            combatLogMessages.push(`${attacker.title} attacks ${defenderPlayer.name} directly!`);
            const damage = attacker.melee > 0 ? attacker.melee : attacker.magic;
            const attackType = attacker.melee > 0 ? "melee" : "magic";

            let targetPlayerOriginalHp: number;
            if (currentPlayerIndex === 0) {
                targetPlayerOriginalHp = p2Data.hp;
                p2Data.hp = Math.max(0, p2Data.hp - damage);
                combatLogMessages.push(`> ${p2Data.name} takes ${damage} direct ${attackType} damage. HP: ${targetPlayerOriginalHp} -> ${p2Data.hp}.`);
            } else {
                targetPlayerOriginalHp = p1Data.hp;
                p1Data.hp = Math.max(0, p1Data.hp - damage);
                combatLogMessages.push(`> ${p1Data.name} takes ${damage} direct ${attackType} damage. HP: ${targetPlayerOriginalHp} -> ${p1Data.hp}.`);
            }
        }

        let nextActiveMonsterP1 = currentPlayerIndex === 0 ? (attacker.hp > 0 ? attacker : undefined) : activeMonsterP1;
        let nextActiveMonsterP2 = currentPlayerIndex === 1 ? (attacker.hp > 0 ? attacker : undefined) : activeMonsterP2;

        if (defender && defender.hp <= 0) {
            combatLogMessages.push(`${defender.title} is defeated!`);
            const defeatedMonsterCard = {...currentDefenderMonster!, hp:0, shield:0, magicShield:0, statusEffects: []}; 
            if (currentPlayerIndex === 0) {
                p2Data.discardPile.push(defeatedMonsterCard);
                nextActiveMonsterP2 = undefined;
            } else {
                p1Data.discardPile.push(defeatedMonsterCard);
                nextActiveMonsterP1 = undefined;
            }
        } else if (defender) {
            if (currentPlayerIndex === 0) nextActiveMonsterP2 = defender; else nextActiveMonsterP1 = defender;
        }

        if (attacker.hp <= 0) {
            combatLogMessages.push(`${attacker.title} is defeated!`);
            const defeatedAttackerCard = {...currentAttackerMonster!, hp:0, shield:0, magicShield:0, statusEffects: []}; 
            if (currentPlayerIndex === 0) {
                p1Data.discardPile.push(defeatedAttackerCard);
                nextActiveMonsterP1 = undefined;
            } else {
                p2Data.discardPile.push(defeatedAttackerCard);
                nextActiveMonsterP2 = undefined;
            }
        }

        const finalPlayers = [p1Data, p2Data] as [PlayerData, PlayerData];

        logAndSetGameState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                players: finalPlayers,
                activeMonsterP1: nextActiveMonsterP1,
                activeMonsterP2: nextActiveMonsterP2,
                gameLogMessages: [...(prev.gameLogMessages || []), ...combatLogMessages],
                gamePhase: 'turn_resolution_phase',
            };
        });
        setTimeout(() => processTurnEnd(), 1000); 
    }, 1000);
  };

  const handleInitiateSwap = () => {
    logAndSetGameState(prev => {
      if (!prev || prev.isProcessingAction) return prev;

      const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = prev;
      const player = players[currentPlayerIndex];
      const monsterToSwapOut = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;

      if (!monsterToSwapOut) {
        toast({ title: "No monster to swap", description: "You don't have an active monster.", variant: "destructive" });
        return {...prev };
      }
      const hasOtherMonsterInHand = player.hand.some(c => c.cardType === 'Monster' && c.id !== monsterToSwapOut.id);
      if (!hasOtherMonsterInHand) {
          toast({ title: "No Monster to Swap In", description: "You need another monster in your hand to swap.", variant: "destructive" });
          return {...prev };
      }
      
      return {
        ...prev,
        gamePhase: 'selecting_swap_monster_phase',
        gameLogMessages: [...(prev.gameLogMessages || []), `${player.name} is choosing a monster to swap with ${monsterToSwapOut.title}.`],
      };
    });
  };

  const handleConfirmSwapMonster = (cardToSwapIn: MonsterCardData) => {
    const stateUpdater = (prev: GameState | null): GameState | null => {
        if (!prev || prev.gamePhase !== 'selecting_swap_monster_phase') return prev;

        const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = prev;
        let player = { ...players[currentPlayerIndex] };
        const monsterToSwapOut = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;
        let newLogMessages = [...(prev.gameLogMessages || [])];

        if (!monsterToSwapOut) {
            console.error("Error: handleConfirmSwapMonster called without an active monster to swap out.");
            newLogMessages.push("Error: No active monster to swap out.");
            return {...prev, gamePhase: 'player_action_phase', gameLogMessages: newLogMessages, isProcessingAction: false};
        }
        
        const handAfterPlayingSelected = player.hand.filter(c => c.id !== cardToSwapIn.id);
        let finalHand = handAfterPlayingSelected;
        let finalDiscardPile = [...player.discardPile];
        const monsterReturningToHand = { ...monsterToSwapOut, statusEffects: [] }; 

        if (handAfterPlayingSelected.length < CARDS_IN_HAND) { 
            finalHand = [...handAfterPlayingSelected, monsterReturningToHand];
            newLogMessages.push(`${player.name} swaps out ${monsterToSwapOut.title} for ${cardToSwapIn.title}! ${monsterToSwapOut.title} returns to hand.`);
        } else {
            finalDiscardPile.push(monsterReturningToHand);
            newLogMessages.push(`${player.name} swaps out ${monsterToSwapOut.title} for ${cardToSwapIn.title}! Hand was full, so ${monsterToSwapOut.title} is discarded.`);
        }

        const updatedPlayer = { ...player, hand: finalHand, discardPile: finalDiscardPile };
        const newPlayers = [...players] as [PlayerData, PlayerData];
        newPlayers[currentPlayerIndex] = updatedPlayer;

        return {
          ...prev,
          players: newPlayers,
          [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: cardToSwapIn,
          gamePhase: 'turn_resolution_phase',
          gameLogMessages: newLogMessages,
          isProcessingAction: true, 
        };
    };

    logAndSetGameState(stateUpdater);
    setTimeout(() => {
        processTurnEnd();
    }, 1000); 
  };


  if (!gameState || gameState.gamePhase === 'loading_art' || gameState.gamePhase === 'initial') {
    const currentLog = gameState?.gameLogMessages?.slice(-1)[0];
    const displayMessage = currentLog && currentLog.startsWith("Error:")
      ? currentLog
      : (gameState?.gameLogMessages?.join('\n') || "Initializing Arcane Clash...");
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl whitespace-pre-line">{displayMessage}</p>
        {gameState && <p className="text-sm mt-2">Current Phase: {gameState.gamePhase}</p>}
      </div>
    );
  }

  const { players, currentPlayerIndex, gamePhase, activeMonsterP1, activeMonsterP2, winner, gameLogMessages, isProcessingAction, isInitialMonsterEngagement } = gameState;
  const player1 = players[0];
  const player2 = players[1];
  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">

      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-1 md:space-y-2 flex-shrink-0">
         <div className="w-full flex flex-col items-center space-y-1 text-xs text-muted-foreground mb-1">
          <div className="flex items-center space-x-1">
            <Layers3 className="w-3 h-3" /><span>Deck: {player1.deck.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trash2 className="w-3 h-3" /><span>Discard: {player1.discardPile.length}</span>
          </div>
        </div>
        <PlayerStatusDisplay
          player={player1}
          isCurrentPlayer={currentPlayerIndex === 0 && gamePhase !== 'game_over_phase' && gamePhase !== 'coin_flip_animation'}
        />
        <PlayerHand
          cards={player1.hand}
          onCardSelect={(card) => {
            const latestGS = gameStateRef.current;
            if (!latestGS || latestGS.currentPlayerIndex !== 0 || latestGS.isProcessingAction) return;

            if (latestGS.gamePhase === 'selecting_swap_monster_phase' && card.cardType === 'Monster') {
              handleConfirmSwapMonster(card as MonsterCardData);
            } else if (latestGS.gamePhase === 'player_action_phase' && !latestGS.isProcessingAction) {
              if (card.cardType === 'Monster' && !latestGS.activeMonsterP1) {
                handlePlayMonsterFromHand(card as MonsterCardData);
              } else if (card.cardType === 'Spell') {
                 if (latestGS.players[0].spellsPlayedThisTurn < MAX_SPELLS_PER_TURN) {
                    handlePlaySpellFromHand(card as SpellCardData);
                 } else {
                    toast({title: "Spell Limit", description: `You have already played ${MAX_SPELLS_PER_TURN} spells this turn.`, variant: "destructive"});
                 }
              }
            }
          }}
          isPlayerTurn={currentPlayerIndex === 0 && (gamePhase === 'player_action_phase' || gamePhase === 'selecting_swap_monster_phase') && !isProcessingAction}
          canPlayMonster={!activeMonsterP1 && gamePhase === 'player_action_phase'}
          isOpponent={false}
          currentPhase={gamePhase}
          spellsPlayedThisTurn={player1.spellsPlayedThisTurn}
        />
      </div>


      <div className="flex-grow flex flex-col items-center justify-between min-w-0">
        <BattleArena
          player1Card={activeMonsterP1}
          player2Card={activeMonsterP2}
          player1Name={player1.name}
          player2Name={player2.name}
          showClashAnimation={gamePhase === 'combat_phase' && !!activeMonsterP1 && !!activeMonsterP2}
          gameLogMessages={gameLogMessages || []}
          gamePhase={gamePhase}
          onCoinFlipAnimationComplete={handleCoinFlipAnimationComplete}
          winningPlayerNameForCoinFlip={players[currentPlayerIndex]?.name}
        />

         {gamePhase === 'player_action_phase' && !isProcessingAction && (
          <PlayerActions
            currentPlayer={currentPlayer}
            activeMonster={currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2}
            onAttack={handleMonsterAttack}
            onInitiateSwap={handleInitiateSwap}
            canPlayMonsterFromHand={currentPlayer.hand.some(c => c.cardType === 'Monster') && !(currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2)}
            canPlaySpellFromHand={currentPlayer.hand.some(c => c.cardType === 'Spell')}
            playerHandFull={currentPlayer.hand.length >= CARDS_IN_HAND}
            spellsPlayedThisTurn={currentPlayer.spellsPlayedThisTurn}
            maxSpellsPerTurn={MAX_SPELLS_PER_TURN}
          />
        )}
         {gamePhase === 'turn_resolution_phase' && !isProcessingAction && (
             <button
                onClick={processTurnEnd}
                className="my-2 px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90 animate-pulse">
                End Turn
             </button>
         )}
         {(isProcessingAction  && gamePhase !== 'selecting_swap_monster_phase') && (
            <div className="my-2 flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing action...</span>
            </div>
         )}
      </div>


      <div className="w-1/4 flex flex-col items-center p-1 md:p-2 space-y-1 md:space-y-2 flex-shrink-0">
        <div className="w-full flex flex-col items-center space-y-1 text-xs text-muted-foreground mb-1">
          <div className="flex items-center space-x-1">
            <Layers3 className="w-3 h-3" /><span>Deck: {player2.deck.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trash2 className="w-3 h-3" /><span>Discard: {player2.discardPile.length}</span>
          </div>
        </div>
        <PlayerStatusDisplay
          player={player2}
          isCurrentPlayer={currentPlayerIndex === 1 && gamePhase !== 'game_over_phase' && gamePhase !== 'coin_flip_animation'}
          isOpponent={true}
        />
        <PlayerHand
          cards={player2.hand}
           onCardSelect={(card) => {
            const latestGS = gameStateRef.current;
            if (!latestGS || latestGS.currentPlayerIndex !== 1 || latestGS.isProcessingAction) return;

            if (latestGS.gamePhase === 'selecting_swap_monster_phase' && card.cardType === 'Monster') {
              handleConfirmSwapMonster(card as MonsterCardData);
            } else if (latestGS.gamePhase === 'player_action_phase' && !latestGS.isProcessingAction) {
              if (card.cardType === 'Monster' && !latestGS.activeMonsterP2) {
                handlePlayMonsterFromHand(card as MonsterCardData);
              } else if (card.cardType === 'Spell') {
                 if (latestGS.players[1].spellsPlayedThisTurn < MAX_SPELLS_PER_TURN) {
                    handlePlaySpellFromHand(card as SpellCardData);
                 } else {
                    toast({title: "Spell Limit", description: `You have already played ${MAX_SPELLS_PER_TURN} spells this turn.`, variant: "destructive"});
                 }
              }
            }
          }}
          isPlayerTurn={currentPlayerIndex === 1 && (gamePhase === 'player_action_phase' || gamePhase === 'selecting_swap_monster_phase') && !isProcessingAction}
          canPlayMonster={!activeMonsterP2 && gamePhase === 'player_action_phase'}
          isOpponent={true}
          currentPhase={gamePhase}
          spellsPlayedThisTurn={player2.spellsPlayedThisTurn}
        />
      </div>

      <GameOverModal
        isOpen={gamePhase === 'game_over_phase'}
        winnerName={winner?.name}
        onRestart={() => {
          console.log('[GameBoard] Restarting game: resetting state and flags.');
          descriptionQueueRef.current = [];
          isFetchingDescriptionRef.current = false;
          isInitializingRef.current = false; 
          hasInitialized.current = false;  
          logAndSetGameState(null); 
        }}
      />
    </div>
  );
}

