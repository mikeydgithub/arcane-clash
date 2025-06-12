
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase, MonsterCardData, SpellCardData } from '@/types';
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

  const logAndSetGameState = useCallback((updater: React.SetStateAction<GameState | null>) => {
    setGameState(updater);
  }, []);

  useEffect(() => {
    const prevState = previousGameStateRef.current;
    const nextState = gameState; 

    if (nextState && prevState) {
      let changed = false;
      if (prevState.gamePhase !== nextState.gamePhase) {
        console.log(`[GAME PHASE CHANGED] From: ${prevState.gamePhase || 'null'} To: ${nextState.gamePhase}`);
        changed = true;
      }
      if (prevState.isProcessingAction !== nextState.isProcessingAction) {
        console.log(`[PROCESSING ACTION CHANGED] To: ${nextState.isProcessingAction}`);
        changed = true;
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
            changed = true;
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
    previousGameStateRef.current = nextState ? { ...nextState } : null;
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
        isInitialMonsterEngagement: true, // Reset for new game
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
            isInitialMonsterEngagement: true,
          }));
          
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
      };
      const initialPlayer2: PlayerData = {
        id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
        hand: p2InitialHand.map(c => ({ ...c, isLoadingDescription: false })),
        deck: p2DeckAfterDeal.map(c => ({ ...c, isLoadingDescription: false })),
        discardPile: [],
        avatarUrl: 'https://placehold.co/64x64.png?text=P2',
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
          isInitialMonsterEngagement: true,
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

  const processTurnEnd = () => {
    console.log("[GameBoard] Processing turn end...");
    logAndSetGameState(prev => {
      if (!prev) return null;
      let { players, currentPlayerIndex, gameLogMessages } = prev;
      const actingPlayer = players[currentPlayerIndex];
      const opponentPlayerIndex = 1 - currentPlayerIndex;
      const opponentPlayer = players[opponentPlayerIndex];

      let newLogMessages = [...(gameLogMessages || [])];
      let actingPlayerHand = [...actingPlayer.hand];
      let actingPlayerDeck = [...actingPlayer.deck];

      if (actingPlayerHand.length < CARDS_IN_HAND && actingPlayerDeck.length > 0) {
        const { dealtCards, remainingDeck } = dealCards(actingPlayerDeck, 1);
        const drawnCard = { ...dealtCards[0] };

        actingPlayerHand.push(drawnCard);
        actingPlayerDeck = remainingDeck;
        newLogMessages.push(`${actingPlayer.name} draws ${drawnCard.title}.`);

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
        newLogMessages.push(`${actingPlayer.name} has no cards left in their deck to draw.`);
      }

      const updatedPlayers = [...players] as [PlayerData, PlayerData];
      updatedPlayers[currentPlayerIndex] = { ...actingPlayer, hand: actingPlayerHand, deck: actingPlayerDeck };

      if (updatedPlayers[0].hp <= 0 && updatedPlayers[1].hp <= 0) {
        newLogMessages.push("It's a draw! Both players are defeated.");
        return { ...prev, players: updatedPlayers, winner: undefined, gamePhase: 'game_over_phase', gameLogMessages: newLogMessages, isProcessingAction: false };
      } else if (updatedPlayers[0].hp <= 0) {
        newLogMessages.push(`${updatedPlayers[1].name} wins! ${updatedPlayers[0].name} is defeated.`);
        return { ...prev, players: updatedPlayers, winner: updatedPlayers[1], gamePhase: 'game_over_phase', gameLogMessages: newLogMessages, isProcessingAction: false };
      } else if (updatedPlayers[1].hp <= 0) {
        newLogMessages.push(`${updatedPlayers[0].name} wins! ${updatedPlayers[1].name} is defeated.`);
        return { ...prev, players: updatedPlayers, winner: updatedPlayers[0], gamePhase: 'game_over_phase', gameLogMessages: newLogMessages, isProcessingAction: false };
      }

      newLogMessages.push(`Turn ends. It's now ${opponentPlayer.name}'s turn.`);
      newLogMessages.push(`${opponentPlayer.name}, choose your action.`);

      return {
        ...prev,
        players: updatedPlayers,
        currentPlayerIndex: opponentPlayerIndex as 0 | 1,
        gamePhase: 'player_action_phase',
        gameLogMessages: newLogMessages,
        isProcessingAction: false,
      };
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
    const newPlayers = [...players] as [PlayerData, PlayerData];
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
        isInitialMonsterEngagement: false, // Once any monster is played, this becomes false
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

    logAndSetGameState(prev => ({...prev!, isProcessingAction: true}));

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

        appendLog(`${player.name} casts ${spellToLog.title}! Effect: ${spellToLog.description || "Effect not yet loaded."}`);

        const newHand = player.hand.filter(c => c.id !== card.id);
        const newDiscardPile = [...player.discardPile, { ...card, description: spellToLog.description, isLoadingDescription: false }];
        const updatedPlayer = { ...player, hand: newHand, discardPile: newDiscardPile };

        logAndSetGameState(prev => {
          if(!prev) return null;
          const newPlayers = prev.players.map((p, idx) => idx === currentPlayerIndex ? updatedPlayer : p) as [PlayerData, PlayerData];
          return {
             ...prev,
             players: newPlayers,
             gamePhase: 'spell_effect_phase',
          }
        });
        setTimeout(() => {
            logAndSetGameState(g => ({...g!, gamePhase: 'turn_resolution_phase'}));
            setTimeout(() => processTurnEnd(), 500);
        }, 1000);
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
                    combatLogMessages.push(`  L ${attacker.title} dealt no melee damage (perhaps 0 attack or already absorbed).`);
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
                    combatLogMessages.push(`  L ${attacker.title} dealt no magic damage (perhaps 0 attack or already absorbed).`);
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
                        combatLogMessages.push(`  L ${defender.title} dealt no melee counter-damage.`);
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
                        combatLogMessages.push(`  L ${defender.title} dealt no magic counter-damage.`);
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
            const defeatedMonsterCard = {...currentDefenderMonster!, hp:0, shield:0, magicShield:0};
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
            const defeatedAttackerCard = {...currentAttackerMonster!, hp:0, shield:0, magicShield:0};
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
        setTimeout(() => processTurnEnd(), 500);
    }, 1000); // Increased delay for clash animation visibility
  };

  const handleRetreatMonster = () => {
    const currentBoardGameState = gameStateRef.current; 
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;
    const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = currentBoardGameState;
    const player = players[currentPlayerIndex];
    const monsterToRetreat = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;

    if (!monsterToRetreat) {
      toast({ title: "No monster to retreat", description: "You don't have an active monster in the arena.", variant: "destructive" });
      return;
    }
    if (player.hand.length >= CARDS_IN_HAND) {
        toast({ title: "Hand Full", description: "Cannot retreat monster, your hand is full.", variant: "destructive" });
        return;
    }

    logAndSetGameState(prev => ({...prev!, isProcessingAction: true}));
    appendLog(`${player.name} retreats ${monsterToRetreat.title} back to their hand.`);

    const retreatedCard = { ...monsterToRetreat, isLoadingDescription: false };
    const newHand = [...player.hand, retreatedCard];
    const updatedPlayer = { ...player, hand: newHand };
    const newPlayers = [...players] as [PlayerData, PlayerData];
    newPlayers[currentPlayerIndex] = updatedPlayer;

    logAndSetGameState(prev => ({
      ...prev!,
      players: newPlayers,
      [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: undefined,
      gamePhase: 'turn_resolution_phase',
    }));
    setTimeout(() => processTurnEnd(), 500);
  };


  if (!gameState || gameState.gamePhase === 'loading_art' || gameState.gamePhase === 'initial') {
    const currentLog = gameState?.gameLogMessages?.slice(-1)[0];
    const displayMessage = currentLog && currentLog.startsWith("Error:")
      ? currentLog
      : "Initializing Arcane Clash...";
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">{displayMessage}</p>
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
            const latestBoardGameState = gameStateRef.current; 
            if (latestBoardGameState?.currentPlayerIndex === 0 && latestBoardGameState?.gamePhase === 'player_action_phase' && !latestBoardGameState?.isProcessingAction) {
              if (card.cardType === 'Monster' && !latestBoardGameState?.activeMonsterP1) {
                handlePlayMonsterFromHand(card as MonsterCardData);
              } else if (card.cardType === 'Spell') {
                handlePlaySpellFromHand(card as SpellCardData);
              }
            }
          }}
          isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player_action_phase' && !isProcessingAction}
          canPlayMonster={!activeMonsterP1}
          isOpponent={false}
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
            onRetreat={handleRetreatMonster}
            canPlayMonsterFromHand={currentPlayer.hand.some(c => c.cardType === 'Monster') && !(currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2)}
            canPlaySpellFromHand={currentPlayer.hand.some(c => c.cardType === 'Spell')}
            playerHandFull={currentPlayer.hand.length >= CARDS_IN_HAND}
          />
        )}
         {gamePhase === 'turn_resolution_phase' && !isProcessingAction && (
             <button
                onClick={processTurnEnd}
                className="my-2 px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90 animate-pulse">
                End Turn
             </button>
         )}
         {isProcessingAction && (
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
            const latestBoardGameState = gameStateRef.current; 
            if (latestBoardGameState?.currentPlayerIndex === 1 && latestBoardGameState?.gamePhase === 'player_action_phase' && !latestBoardGameState?.isProcessingAction) {
              if (card.cardType === 'Monster' && !latestBoardGameState?.activeMonsterP2) {
                handlePlayMonsterFromHand(card as MonsterCardData);
              } else if (card.cardType === 'Spell') {
                handlePlaySpellFromHand(card as SpellCardData);
              }
            }
          }}
          isPlayerTurn={currentPlayerIndex === 1 && gamePhase === 'player_action_phase' && !isProcessingAction}
          canPlayMonster={!activeMonsterP2}
          isOpponent={true}
        />
      </div>

      <GameOverModal
        isOpen={gamePhase === 'game_over_phase'}
        winnerName={winner?.name}
        onRestart={() => {
          console.log('[GameBoard] Restarting game: resetting state and flags.');
          descriptionQueueRef.current = [];
          isFetchingDescriptionRef.current = false;
          logAndSetGameState(null); 
        }}
      />
    </div>
  );
}

