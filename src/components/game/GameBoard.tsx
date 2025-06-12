
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

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const logAndSetGameState = useCallback((updater: React.SetStateAction<GameState | null>) => {
    setGameState(prevState => {
      const nextState = typeof updater === 'function' ? updater(prevState) : updater;
      if (prevState?.gamePhase !== nextState?.gamePhase) {
        console.log(`[GAME PHASE CHANGED] From: ${prevState?.gamePhase || 'null'} To: ${nextState?.gamePhase}`);
      }
      if (prevState?.isProcessingAction !== nextState?.isProcessingAction) {
        console.log(`[PROCESSING ACTION CHANGED] To: ${nextState?.isProcessingAction}`);
      }
      return nextState;
    });
  }, []);


  const initializeGame = useCallback(async () => {
    if (hasInitialized.current && gameStateRef.current) {
        console.log('[GameBoard] InitializeGame called, but game is already initialized and has state. Skipping.');
        return;
    }
    if (hasInitialized.current && !gameStateRef.current) {
        console.log('[GameBoard] InitializeGame called, hasInitialized is true but gameState is null. This might be a reset. Allowing re-init.');
        // Potentially allow re-init if specifically resetting.
        // For now, if it's true, we assume it's mid-process or an error.
        // If a full restart is desired, hasInitialized.current should be set to false by the restart trigger.
    }


    console.log('[GameBoard] Initializing game...');
    hasInitialized.current = true; // Set this flag as early as possible
    logAndSetGameState(prev => ({...(prev || {} as GameState), gamePhase: 'loading_art', gameLogMessages: ["Initializing Arcane Clash... Preparing cards..."]}));

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
        logAndSetGameState(prev => ({...(prev || {} as GameState), gamePhase: 'initial', gameLogMessages: ["Error: Card data missing. Pregenerate cards."]}));
        hasInitialized.current = false; // Reset if init fails
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
      hand: p1InitialHand.map(c => ({ ...c, isLoadingDescription: !c.description ? undefined : false })),
      deck: p1DeckAfterDeal.map(c => ({ ...c, isLoadingDescription: !c.description ? undefined : false })),
      discardPile: [],
      avatarUrl: 'https://placehold.co/64x64.png?text=P1',
    };
    const initialPlayer2: PlayerData = {
      id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
      hand: p2InitialHand.map(c => ({ ...c, isLoadingDescription: !c.description ? undefined : false })),
      deck: p2DeckAfterDeal.map(c => ({ ...c, isLoadingDescription: !c.description ? undefined : false })),
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
      gameLogMessages: [`Game cards ready. ${firstPlayerIndex === 0 ? initialPlayer1.name : initialPlayer2.name} will be determined by coin flip. Flipping coin...`],
      isProcessingAction: false,
    });
    
    descriptionQueueRef.current = []; // Clear queue on new game
    [...initialPlayer1.hand, ...initialPlayer2.hand].forEach((card, globalIndex) => {
        if (!card.description && card.isLoadingDescription !== true && card.isLoadingDescription !== false) {
            const playerIndex = globalIndex < initialPlayer1.hand.length ? 0 : 1;
            console.log(`[GameBoard] Queuing ${card.title} for description fetch for player ${playerIndex + 1}. Has description: ${!!card.description}, isLoading: ${card.isLoadingDescription}`);
            descriptionQueueRef.current.push({ card, playerIndex });
        }
    });
    if (descriptionQueueRef.current.length > 0) {
        console.log(`[GameBoard] Initial description queue length: ${descriptionQueueRef.current.length}`);
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
    if (cardToFetch.description || cardToFetch.isLoadingDescription === false) {
        console.log(`[fetchAndSetCardDescription] Skipping ${cardToFetch.title}, already has description or explicitly not loading.`);
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
    if (!gameState && !hasInitialized.current) {
      console.log('[GameBoard] Effect: gameState is null and not initialized. Calling initializeGame.');
      const init = async () => {
        await initializeGame();
      };
      init();
    } else if (gameState && hasInitialized.current) {
      console.log('[GameBoard] Effect: Game state exists and is initialized.');
    } else if (!gameState && hasInitialized.current) {
      console.log('[GameBoard] Effect: gameState is null, but hasInitialized is true. Game might have been reset. Ready for re-initialization if triggered.');
    } else if (gameState && !hasInitialized.current) {
      console.warn('[GameBoard] Effect: gameState exists, but hasInitialized is false. This state is unexpected. Re-initializing.');
      const init = async () => {
        await initializeGame();
      };
      init();
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

                    if ((cardInHand && (cardInHand.description || cardInHand.isLoadingDescription === false)) ||
                        (cardIsActive && activeMonster && (activeMonster.description || activeMonster.isLoadingDescription === false)) ||
                        (cardInDeck && (cardInDeck.description || cardInDeck.isLoadingDescription === false)) 
                        ) {
                        cardNeedsFetching = false;
                        console.log(`[ProcessQueue] Card ${card.title} already has description or is explicitly not loading in latest state. Skipping fetch.`);
                    }
                }


                if (cardNeedsFetching) {
                     console.log(`[ProcessQueue] Fetching for ${card.title} from queue.`);
                     await fetchAndSetCardDescription(card, playerIndex);
                }
            }
            isFetchingDescriptionRef.current = false;
            if (descriptionQueueRef.current.length > 0) {
                 console.log(`[ProcessQueue] More items in queue (${descriptionQueueRef.current.length}). Processing next.`);
                 setTimeout(processQueue, 500); // Small delay before next in queue
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
                const latestGameState = gameStateRef.current;
                let isAlreadyLoadingOrFetchedInState = false;
                if (latestGameState) {
                    const cardInCurrentHand = latestGameState.players[currentPlayerIndex]?.hand.find(c => c.id === drawnCard.id);
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
    const currentGameState = gameStateRef.current; 
    if (!currentGameState || currentGameState.isProcessingAction) return;
    const { players, currentPlayerIndex } = currentGameState;
    const player = players[currentPlayerIndex];

    logAndSetGameState(prev => ({...prev!, isProcessingAction: true}));
    appendLog(`${player.name} summons ${card.title} to the arena!`);

    const newHand = player.hand.filter(c => c.id !== card.id);
    const updatedPlayer = { ...player, hand: newHand };
    const newPlayers = [...players] as [PlayerData, PlayerData];
    newPlayers[currentPlayerIndex] = updatedPlayer;

    if (!card.description && card.isLoadingDescription !== true && card.isLoadingDescription !== false) {
        const alreadyQueued = descriptionQueueRef.current.some(item => item.card.id === card.id);
        if (!alreadyQueued) {
            console.log(`[handlePlayMonsterFromHand] Queuing ${card.title} for description fetch as it's played.`);
            descriptionQueueRef.current.push({ card, playerIndex: currentPlayerIndex });
        }
    }

    logAndSetGameState(prev => ({
      ...prev!,
      players: newPlayers,
      [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: card,
      gamePhase: 'turn_resolution_phase', // Should proceed to turn end after monster is played
    }));
    setTimeout(() => processTurnEnd(), 500); // Delay before automatically ending turn
  };

  const handlePlaySpellFromHand = (card: SpellCardData) => {
    const currentGameState = gameStateRef.current; 
    if (!currentGameState || currentGameState.isProcessingAction) return;
    const { players, currentPlayerIndex } = currentGameState;
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
            logAndSetGameState(g => ({...g!, gamePhase: 'turn_resolution_phase'})); // After spell effect, proceed to turn resolution
            setTimeout(() => processTurnEnd(), 500); // Then end turn
        }, 1000); // Duration for "spell effect"
    };

    fetchDescIfNeededAndProceed();
  };

  const handleMonsterAttack = () => {
    const currentGameState = gameStateRef.current;
    if (!currentGameState || currentGameState.isProcessingAction) return;
    const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = currentGameState;
    const attackerPlayer = players[currentPlayerIndex];
    const defenderPlayerIndex = 1 - currentPlayerIndex;
    const defenderPlayer = players[defenderPlayerIndex];

    let currentAttackerMonster = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;
    let currentDefenderMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;

    if (!currentAttackerMonster) {
        toast({ title: "No active monster", description: "You need an active monster to attack.", variant: "destructive" });
        return;
    }
    logAndSetGameState(prev => ({...prev!, isProcessingAction: true, gamePhase: 'combat_phase'}));

    let p1Data = { ...players[0] };
    let p2Data = { ...players[1] };
    let attacker = { ...currentAttackerMonster } as MonsterCardData;
    let defender = currentDefenderMonster ? { ...currentDefenderMonster } as MonsterCardData : undefined;
    let newLogMessages: string[] = [...(currentGameState.gameLogMessages || [])];

    newLogMessages.push(`${attackerPlayer.name}'s ${attacker.title} attacks!`);

    if (defender) {
        newLogMessages.push(`${attacker.title} clashes with ${defender.title}!`);

        if (attacker.melee > 0) {
            const damageDealt = attacker.melee;
            newLogMessages.push(`${attacker.title} strikes ${defender.title} with ${damageDealt} melee.`);
            const shieldAbsorbed = Math.min(defender.shield, damageDealt);
            if (shieldAbsorbed > 0) { defender.shield -= shieldAbsorbed; newLogMessages.push(`${defender.title}'s shield absorbs ${shieldAbsorbed}.`); }
            const damageAfterShield = damageDealt - shieldAbsorbed;
            if (damageAfterShield > 0) {
                const defenseBlocked = Math.min(defender.defense, damageAfterShield);
                if (defenseBlocked > 0) newLogMessages.push(`${defender.title}'s defense blocks ${defenseBlocked}.`);
                const hpDamage = Math.max(0, damageAfterShield - defenseBlocked);
                defender.hp -= hpDamage;
                newLogMessages.push(`${defender.title} takes ${hpDamage} HP damage. New HP: ${Math.max(0, defender.hp)}`);
            }
        } else if (attacker.magic > 0) {
            const damageDealt = attacker.magic;
            newLogMessages.push(`${attacker.title} blasts ${defender.title} with ${damageDealt} magic.`);
            const shieldAbsorbed = Math.min(defender.magicShield, damageDealt);
            if (shieldAbsorbed > 0) { defender.magicShield -= shieldAbsorbed; newLogMessages.push(`${defender.title}'s magic shield absorbs ${shieldAbsorbed}.`); }
            const hpDamage = Math.max(0, damageDealt - shieldAbsorbed);
            defender.hp -= hpDamage;
            newLogMessages.push(`${defender.title} takes ${hpDamage} HP damage from magic. New HP: ${Math.max(0, defender.hp)}`);
        }

        if (defender.hp > 0) {
            if (defender.melee > 0) {
                const damageDealt = defender.melee;
                newLogMessages.push(`${defender.title} counter-attacks ${attacker.title} with ${damageDealt} melee.`);
                const shieldAbsorbed = Math.min(attacker.shield, damageDealt);
                if (shieldAbsorbed > 0) { attacker.shield -= shieldAbsorbed; newLogMessages.push(`${attacker.title}'s shield absorbs ${shieldAbsorbed}.`); }
                const damageAfterShield = damageDealt - shieldAbsorbed;
                if (damageAfterShield > 0) {
                    const defenseBlocked = Math.min(attacker.defense, damageAfterShield);
                    if (defenseBlocked > 0) newLogMessages.push(`${attacker.title}'s defense blocks ${defenseBlocked}.`);
                    const hpDamage = Math.max(0, damageAfterShield - defenseBlocked);
                    attacker.hp -= hpDamage;
                    newLogMessages.push(`${attacker.title} takes ${hpDamage} HP damage. New HP: ${Math.max(0, attacker.hp)}`);
                }
            } else if (defender.magic > 0) {
                const damageDealt = defender.magic;
                newLogMessages.push(`${defender.title} counter-attacks ${attacker.title} with ${damageDealt} magic.`);
                const shieldAbsorbed = Math.min(attacker.magicShield, damageDealt);
                if (shieldAbsorbed > 0) { attacker.magicShield -= shieldAbsorbed; newLogMessages.push(`${attacker.title}'s magic shield absorbs ${shieldAbsorbed}.`); }
                const hpDamage = Math.max(0, damageDealt - shieldAbsorbed);
                attacker.hp -= hpDamage;
                newLogMessages.push(`${attacker.title} takes ${hpDamage} HP damage from magic. New HP: ${Math.max(0, attacker.hp)}`);
            }
        } else {
            newLogMessages.push(`${defender.title} was defeated before it could counter-attack.`);
        }
    } else {
        newLogMessages.push(`${attacker.title} attacks ${defenderPlayer.name} directly!`);
        const damage = attacker.melee > 0 ? attacker.melee : attacker.magic;
        if (currentPlayerIndex === 0) {
            p2Data.hp = Math.max(0, p2Data.hp - damage);
            newLogMessages.push(`${p2Data.name} takes ${damage} direct damage. New HP: ${p2Data.hp}`);
        } else {
            p1Data.hp = Math.max(0, p1Data.hp - damage);
            newLogMessages.push(`${p1Data.name} takes ${damage} direct damage. New HP: ${p1Data.hp}`);
        }
    }

    let nextActiveMonsterP1 = currentPlayerIndex === 0 ? (attacker.hp > 0 ? attacker : undefined) : activeMonsterP1;
    let nextActiveMonsterP2 = currentPlayerIndex === 1 ? (attacker.hp > 0 ? attacker : undefined) : activeMonsterP2;

    if (defender && defender.hp <= 0) {
        newLogMessages.push(`${defender.title} is defeated!`);
        const defeatedMonsterCard = {...currentDefenderMonster!, hp:0, shield:0, magicShield:0};
        if (currentPlayerIndex === 0) { // P1 attacked, P2's monster defeated
            p2Data.discardPile.push(defeatedMonsterCard);
            nextActiveMonsterP2 = undefined;
        } else { // P2 attacked, P1's monster defeated
            p1Data.discardPile.push(defeatedMonsterCard);
            nextActiveMonsterP1 = undefined;
        }
    } else if (defender) { // Defender survived
         if (currentPlayerIndex === 0) nextActiveMonsterP2 = defender; else nextActiveMonsterP1 = defender;
    }

    if (attacker.hp <= 0) {
        newLogMessages.push(`${attacker.title} is defeated!`);
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

    logAndSetGameState(prev => ({
        ...prev!,
        players: finalPlayers,
        activeMonsterP1: nextActiveMonsterP1,
        activeMonsterP2: nextActiveMonsterP2,
        gameLogMessages: newLogMessages,
    }));

    setTimeout(() => {
        logAndSetGameState(g => ({...g!, gamePhase: 'turn_resolution_phase'}));
        setTimeout(() => processTurnEnd(), 500);
    }, 2000); // Time for clash animation
  };

  const handleRetreatMonster = () => {
    const currentGameState = gameStateRef.current;
    if (!currentGameState || currentGameState.isProcessingAction) return;
    const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = currentGameState;
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

    const retreatedCard = { ...monsterToRetreat, isLoadingDescription: false }; // Card from arena is fully loaded
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
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">{gameState?.gameLogMessages?.slice(-1)[0] || "Initializing Arcane Clash..."}</p>
        {gameState && <p className="text-sm mt-2">Current Phase: {gameState.gamePhase}</p>}
      </div>
    );
  }

  const { players, currentPlayerIndex, gamePhase, activeMonsterP1, activeMonsterP2, winner, gameLogMessages, isProcessingAction } = gameState;
  const player1 = players[0];
  const player2 = players[1];
  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">
      {/* Player 1 Side */}
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
            const latestGameState = gameStateRef.current;
            if (latestGameState?.currentPlayerIndex === 0 && latestGameState?.gamePhase === 'player_action_phase' && !latestGameState?.isProcessingAction) {
              if (card.cardType === 'Monster' && !latestGameState?.activeMonsterP1) {
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

      {/* Center Area: Battle Arena and Actions */}
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
          winningPlayerNameForCoinFlip={players[gameState.currentPlayerIndex]?.name}
        />
         {/* Debug Log for PlayerActions visibility */}
         {/* console.log(`DEBUG RENDER PlayerActions: gamePhase: ${gamePhase}, isProcessingAction: ${isProcessingAction}, currentPlayer: ${currentPlayer?.name}`) */}

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

      {/* Player 2 Side */}
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
            const latestGameState = gameStateRef.current;
            if (latestGameState?.currentPlayerIndex === 1 && latestGameState?.gamePhase === 'player_action_phase' && !latestGameState?.isProcessingAction) {
              if (card.cardType === 'Monster' && !latestGameState?.activeMonsterP2) {
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
          console.log('[GameBoard] Restarting game...');
          hasInitialized.current = false; // Allow re-initialization
          descriptionQueueRef.current = [];
          isFetchingDescriptionRef.current = false;
          logAndSetGameState(null); // This will trigger the useEffect to re-initialize
        }}
      />
    </div>
  );
}

