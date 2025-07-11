
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase, MonsterCardData, SpellCardData, StatusEffect, DamageIndicatorState, GameLogEntry, LogEntryType } from '@/types';
import { generateMonsterCards, generateSpellCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { PlayerActions } from './PlayerActions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Layers3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';


const INITIAL_PLAYER_HP = 30;
const CARDS_IN_HAND = 5;
const MAX_MONSTERS_PER_DECK = 13;
const MAX_SPELLS_PER_DECK = 12;
const SPELLS_PER_TURN_LIMIT = 1; // New limit for spells per turn
const MULLIGAN_CARD_COUNT = 3;

const initialDamageIndicatorState: DamageIndicatorState = {
    p1Monster: null,
    p2Monster: null,
    p1Player: null,
    p2Player: null,
};

let logIdCounter = 0;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedForMulligan, setSelectedForMulligan] = useState<string[]>([]);
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const previousGameStateRef = useRef<GameState | null>(null);


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
      if (prevLogs.length !== nextLogs.length || prevLogs.some((msg, i) => msg.id !== nextLogs[i]?.id)) {
            const prevLast = prevLogs.slice(-3).map(l => l.text);
            const nextLast = nextLogs.slice(-3).map(l => l.text);
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
                tail: nextState.gameLogMessages.slice(-3).map(l => l.text)
            });
        }
    }
    previousGameStateRef.current = nextState ? JSON.parse(JSON.stringify(nextState)) : null;
  }, [gameState]);


  const appendLog = (message: string, type: LogEntryType, stateUpdater?: (prev: GameState) => GameState) => {
    const newLogEntry: GameLogEntry = { id: `log-${logIdCounter++}`, text: message, type };
    
    logAndSetGameState(prev => {
        if (!prev) return null;
        const updatedStateWithLog = {
            ...prev,
            gameLogMessages: [...(prev.gameLogMessages || []), newLogEntry].slice(-100)
        };
        return stateUpdater ? stateUpdater(updatedStateWithLog) : updatedStateWithLog;
    });
  };

  const appendLogs = (messages: {text: string, type: LogEntryType}[], stateUpdater?: (prev: GameState) => GameState) => {
    const newLogEntries: GameLogEntry[] = messages.map(msg => ({ id: `log-${logIdCounter++}`, text: msg.text, type: msg.type }));
    
    logAndSetGameState(prev => {
        if (!prev) return null;
        const updatedStateWithLogs = {
            ...prev,
            gameLogMessages: [...(prev.gameLogMessages || []), ...newLogEntries].slice(-100)
        };
        return stateUpdater ? stateUpdater(updatedStateWithLogs) : updatedStateWithLogs;
    });
  };


  const initializeGame = useCallback(async () => {
    if (hasInitialized.current) {
      console.log('[GameBoard] InitializeGame: Already initialized, skipping.');
      return;
    }
    hasInitialized.current = true;


    console.log('[GameBoard] Initializing game sequence starting...');

    try {
      logAndSetGameState(prev => ({
        ...(prev || {} as GameState),
        gamePhase: 'loading_art',
        gameLogMessages: [{ id: `log-${logIdCounter++}`, text: "Connecting to the arcane archives...", type: 'system' }],
        isProcessingAction: true,
        isInitialMonsterEngagement: true,
        damageIndicators: initialDamageIndicatorState,
      }));
      
      const [masterMonsterPool, masterSpellPool] = await Promise.all([
        generateMonsterCards(),
        generateSpellCards()
      ]);

      if (masterMonsterPool.length < MAX_MONSTERS_PER_DECK * 2 || masterSpellPool.length < MAX_SPELLS_PER_DECK * 2) {
          console.error("Not enough cards fetched from backend to build decks.");
          toast({
              title: "Card Data Missing",
              description: "Not enough cards in the database to build two full decks. Please check the 'cards' collection in Firestore.",
              variant: "destructive",
              duration: 10000,
          });
          logAndSetGameState(prev => ({
            ...(prev || {} as GameState),
            gamePhase: 'initial',
            gameLogMessages: [{ id: `log-${logIdCounter++}`, text: "Error: Not enough card data in the backend database.", type: 'system' }],
            isProcessingAction: false,
            damageIndicators: initialDamageIndicatorState,
          }));
          hasInitialized.current = false;
          return;
      }

      const shuffledMonsters = shuffleDeck(masterMonsterPool);
      const p1Monsters = shuffledMonsters.slice(0, MAX_MONSTERS_PER_DECK);
      const p2Monsters = shuffledMonsters.slice(MAX_MONSTERS_PER_DECK, MAX_MONSTERS_PER_DECK * 2);

      const shuffledSpells = shuffleDeck(masterSpellPool);
      const p1Spells = shuffledSpells.slice(0, MAX_SPELLS_PER_DECK);
      const p2Spells = shuffledSpells.slice(MAX_SPELLS_PER_DECK, MAX_SPELLS_PER_DECK * 2);
      
      const player1DeckFull = shuffleDeck([...p1Monsters, ...p1Spells]);
      const player2DeckFull = shuffleDeck([...p2Monsters, ...p2Spells]);

      const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1DeckFull, CARDS_IN_HAND);
      const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2DeckFull, CARDS_IN_HAND);

      const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;

      const initialPlayer1: PlayerData = {
        id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP,
        hand: p1InitialHand,
        deck: p1DeckAfterDeal,
        discardPile: [],
        avatarUrl: 'https://placehold.co/64x64.png?text=P1',
        spellsPlayedThisTurn: 0,
        turnCount: 0,
        hasMulliganed: false,
      };
      const initialPlayer2: PlayerData = {
        id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
        hand: p2InitialHand,
        deck: p2DeckAfterDeal,
        discardPile: [],
        avatarUrl: 'https://placehold.co/64x64.png?text=P2',
        spellsPlayedThisTurn: 0,
        turnCount: 0,
        hasMulliganed: false,
      };

      logAndSetGameState({
        players: [initialPlayer1, initialPlayer2],
        currentPlayerIndex: firstPlayerIndex,
        gamePhase: 'coin_flip_animation',
        activeMonsterP1: undefined,
        activeMonsterP2: undefined,
        winner: undefined,
        gameLogMessages: [{ id: `log-${logIdCounter++}`, text: "Game cards ready. First player will be determined by coin flip. Flipping coin...", type: 'system' }],
        isProcessingAction: false,
        isInitialMonsterEngagement: true,
        damageIndicators: initialDamageIndicatorState,
      });


    } catch (error) {
      console.error("Unexpected error during game initialization:", error);
      toast({
          title: "Initialization Error",
          description: "A critical error occurred during game setup. Please try refreshing.",
          variant: "destructive",
          duration: 10000,
      });
      logAndSetGameState(prev => {
          if (!prev) return null;
          const updatedLogs = [...(prev.gameLogMessages?.slice(0, -1) || []), { id: `log-${logIdCounter++}`, text: "Error: Critical problem during game setup. Refresh may be needed.", type: 'system' as LogEntryType }];
          return {
              ...(prev || {} as GameState),
              gamePhase: 'initial',
              gameLogMessages: updatedLogs,
              isProcessingAction: false,
              damageIndicators: initialDamageIndicatorState,
          };
      });
      hasInitialized.current = false;
    } finally {
      console.log('[GameBoard] Initializing game sequence finished.');
    }
  }, [toast, logAndSetGameState]);

  const handleCoinFlipAnimationComplete = useCallback(() => {
    logAndSetGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      const playerType = firstPlayer.id === 'p1' ? 'player1' : 'player2';

      const newLogs: GameLogEntry[] = [
        ...prev.gameLogMessages,
        { id: `log-${logIdCounter++}`, text: `${firstPlayer.name} wins the toss and will go first!`, type: 'system' },
        { id: `log-${logIdCounter++}`, text: `${firstPlayer.name}, it's your first turn. You may mulligan your hand, or choose an action.`, type: playerType }
      ];

      return {
        ...prev,
        gamePhase: 'player_action_phase',
        gameLogMessages: newLogs,
        isProcessingAction: false,
      };
    });
  }, [logAndSetGameState]);


 useEffect(() => {
    console.log('[GameBoard] Effect: Checking game state for initialization.');
    if (!hasInitialized.current && (!gameState || gameState.gamePhase === 'initial' || gameState.gamePhase === 'loading_art')) {
      console.log('[GameBoard] Effect: Conditions met to call initializeGame(). Current state:', gameState ? gameState.gamePhase : 'null', 'HasInitialized:', hasInitialized.current);
      const init = async () => {
          await initializeGame();
      };
      init();
    } else if (gameState && hasInitialized.current) {
      console.log(`[GameBoard] Effect: Game state exists (${gameState.gamePhase}) and is marked as initialized. No new initialization needed.`);
    } else if (gameState && !hasInitialized.current && gameState.gamePhase !== 'initial' && gameState.gamePhase !== 'loading_art') {
      console.warn(`[GameBoard] Effect: hasInitialized is false, but gamePhase is ${gameState.gamePhase}. This state is unusual.`);
    }
  }, [gameState, initializeGame]);


  const applyStatusEffectsAndCheckDefeats = (playerIndexForTurnStart: 0 | 1, currentState: GameState): GameState => {
    let newPlayers = [...currentState.players] as [PlayerData, PlayerData];
    let newActiveMonsterP1 = currentState.activeMonsterP1 ? { ...currentState.activeMonsterP1 } : undefined;
    let newActiveMonsterP2 = currentState.activeMonsterP2 ? { ...currentState.activeMonsterP2 } : undefined;
    let newLogMessages = [...currentState.gameLogMessages];

    const playerWhoseTurnIsStarting = newPlayers[playerIndexForTurnStart];
    let activeMonsterForTurnPlayer = playerIndexForTurnStart === 0 ? newActiveMonsterP1 : newActiveMonsterP2;
    const playerLogType = playerWhoseTurnIsStarting.id === 'p1' ? 'player1' : 'player2';

    if (activeMonsterForTurnPlayer && activeMonsterForTurnPlayer.statusEffects && activeMonsterForTurnPlayer.statusEffects.length > 0) {
        const effectsToKeep: StatusEffect[] = [];
        for (const effect of activeMonsterForTurnPlayer.statusEffects) {
            let effectKept = true;
            if (effect.type === 'regenerate') {
                const healAmount = effect.value;
                const originalHp = activeMonsterForTurnPlayer.hp;
                activeMonsterForTurnPlayer.hp = Math.min(activeMonsterForTurnPlayer.maxHp, activeMonsterForTurnPlayer.hp + healAmount);
                if (activeMonsterForTurnPlayer.hp > originalHp) {
                    newLogMessages.push({ id: `log-${logIdCounter++}`, text: `${playerWhoseTurnIsStarting.name}'s ${activeMonsterForTurnPlayer.title} regenerates ${activeMonsterForTurnPlayer.hp - originalHp} HP. (HP: ${originalHp} -> ${activeMonsterForTurnPlayer.hp})`, type: 'heal' });
                }
                effect.duration -= 1;
            }
            // Add other status effect processing here like poison DoT

            if (effect.duration > 0) {
                effectsToKeep.push(effect);
            } else {
                newLogMessages.push({ id: `log-${logIdCounter++}`, text: `${playerWhoseTurnIsStarting.name}'s ${activeMonsterForTurnPlayer.title}'s ${effect.type} effect wears off.`, type: 'info' });
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
      let { players, currentPlayerIndex, gameLogMessages, activeMonsterP1, activeMonsterP2 } = prev;

      const actingPlayerInitial = players[currentPlayerIndex];
      const opponentPlayerIndex = (1 - currentPlayerIndex) as 0 | 1;
      const opponentPlayer = players[opponentPlayerIndex];

      const playerAfterAction = {
          ...actingPlayerInitial,
          spellsPlayedThisTurn: 0,
          turnCount: actingPlayerInitial.turnCount + 1, // Increment turn count for player whose turn just ended
      };
      let updatedPlayersArr = [...players] as [PlayerData, PlayerData];
      updatedPlayersArr[currentPlayerIndex] = playerAfterAction;

      let newLogs: GameLogEntry[] = [...(gameLogMessages || [])];

      const stateForStatusEffects: GameState = {
          ...prev,
          players: updatedPlayersArr,
          currentPlayerIndex: opponentPlayerIndex, // Status effects apply to player whose turn is STARTING
          activeMonsterP1: activeMonsterP1 ? {...activeMonsterP1} : undefined,
          activeMonsterP2: activeMonsterP2 ? {...activeMonsterP2} : undefined,
          gameLogMessages: newLogs,
      };

      const stateAfterStatusEffects = applyStatusEffectsAndCheckDefeats(opponentPlayerIndex, stateForStatusEffects);

      updatedPlayersArr = stateAfterStatusEffects.players;
      activeMonsterP1 = stateAfterStatusEffects.activeMonsterP1;
      activeMonsterP2 = stateAfterStatusEffects.activeMonsterP2;
      newLogs = stateAfterStatusEffects.gameLogMessages;

      // Card draw logic for the player who JUST FINISHED their turn
      let actingPlayerHand = [...updatedPlayersArr[currentPlayerIndex].hand];
      let actingPlayerDeck = [...updatedPlayersArr[currentPlayerIndex].deck];
      const actingPlayerLogType = updatedPlayersArr[currentPlayerIndex].id === 'p1' ? 'player1' : 'player2';


      if (actingPlayerHand.length < CARDS_IN_HAND && actingPlayerDeck.length > 0) {
        const { dealtCards, remainingDeck } = dealCards(actingPlayerDeck, 1);
        const drawnCard = { ...dealtCards[0] };

        actingPlayerHand.push(drawnCard);
        actingPlayerDeck = remainingDeck;
        newLogs.push({ id: `log-${logIdCounter++}`, text: `${updatedPlayersArr[currentPlayerIndex].name} draws ${drawnCard.title}.`, type: actingPlayerLogType });

      } else if (actingPlayerHand.length < CARDS_IN_HAND) {
        newLogs.push({ id: `log-${logIdCounter++}`, text: `${updatedPlayersArr[currentPlayerIndex].name} has no cards left in their deck to draw.`, type: 'system' });
      }

      updatedPlayersArr[currentPlayerIndex] = { ...updatedPlayersArr[currentPlayerIndex], hand: actingPlayerHand, deck: actingPlayerDeck };


      // Check for game over conditions AFTER applying status effects and drawing cards
      if (updatedPlayersArr[0].hp <= 0 && updatedPlayersArr[1].hp <= 0) {
        newLogs.push({ id: `log-${logIdCounter++}`, text: "It's a draw! Both players are defeated.", type: 'system' });
        return {
            ...prev,
            players: updatedPlayersArr,
            activeMonsterP1,
            activeMonsterP2,
            winner: undefined,
            gamePhase: 'game_over_phase',
            gameLogMessages: newLogs,
            isProcessingAction: false,
            currentPlayerIndex: opponentPlayerIndex,
         };
      } else if (updatedPlayersArr[0].hp <= 0) {
        newLogs.push({ id: `log-${logIdCounter++}`, text: `${updatedPlayersArr[1].name} wins! ${updatedPlayersArr[0].name} is defeated.`, type: 'system' });
        return {
            ...prev,
            players: updatedPlayersArr,
            activeMonsterP1,
            activeMonsterP2,
            winner: updatedPlayersArr[1],
            gamePhase: 'game_over_phase',
            gameLogMessages: newLogs,
            isProcessingAction: false,
            currentPlayerIndex: opponentPlayerIndex,
        };
      } else if (updatedPlayersArr[1].hp <= 0) {
        newLogs.push({ id: `log-${logIdCounter++}`, text: `${updatedPlayersArr[0].name} wins! ${updatedPlayersArr[1].name} is defeated.`, type: 'system' });
        return {
            ...prev,
            players: updatedPlayersArr,
            activeMonsterP1,
            activeMonsterP2,
            winner: updatedPlayersArr[0],
            gamePhase: 'game_over_phase',
            gameLogMessages: newLogs,
            isProcessingAction: false,
            currentPlayerIndex: opponentPlayerIndex,
        };
      }

      const nextPlayer = players[opponentPlayerIndex];
      const nextPlayerLogType = nextPlayer.id === 'p1' ? 'player1' : 'player2';

      if (nextPlayer.turnCount === 0 && !nextPlayer.hasMulliganed) {
        newLogs.push({ id: `log-${logIdCounter++}`, text: `Turn ends. It's now ${nextPlayer.name}'s first turn.`, type: 'system' });
        newLogs.push({ id: `log-${logIdCounter++}`, text: `${nextPlayer.name}, you may mulligan your hand, or choose an action.`, type: nextPlayerLogType });
      } else {
        newLogs.push({ id: `log-${logIdCounter++}`, text: `Turn ends. It's now ${nextPlayer.name}'s turn.`, type: 'system' });
        newLogs.push({ id: `log-${logIdCounter++}`, text: `${nextPlayer.name}, choose your action.`, type: nextPlayerLogType });
      }

      const finalStateForTurnEnd: GameState = {
        ...prev,
        players: updatedPlayersArr,
        currentPlayerIndex: opponentPlayerIndex,
        gamePhase: 'player_action_phase' as GamePhase,
        activeMonsterP1,
        activeMonsterP2,
        winner: undefined, // No winner yet
        gameLogMessages: newLogs,
        isProcessingAction: false, // <<< CRITICAL: Ensure this is false for next player's turn
        damageIndicators: initialDamageIndicatorState, // Reset damage indicators for new turn
      };
      console.log('[GameBoard] processTurnEnd: Setting final state for new turn:', {
          currentPlayerIndex: finalStateForTurnEnd.currentPlayerIndex,
          gamePhase: finalStateForTurnEnd.gamePhase,
          isProcessingAction: finalStateForTurnEnd.isProcessingAction,
          logLength: finalStateForTurnEnd.gameLogMessages.length
      });
      return finalStateForTurnEnd;
    });
  };

  const handlePlayMonsterFromHand = (card: MonsterCardData) => {
    try {
        const currentBoardGameState = gameStateRef.current;
        if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;

        logAndSetGameState(prev => ({ ...prev!, isProcessingAction: true }));

        const { players, currentPlayerIndex, isInitialMonsterEngagement } = currentBoardGameState;
        const player = players[currentPlayerIndex];
        const playerLogType = player.id === 'p1' ? 'player1' : 'player2';

        const newHand = player.hand.filter(c => c.id !== card.id);
        const updatedPlayer = { ...player, hand: newHand, hasMulliganed: true };
        const newPlayers = [...players] as [PlayerData, PlayerData];
        newPlayers[currentPlayerIndex] = updatedPlayer;

        const wasFirstMonsterOfGame = isInitialMonsterEngagement;
        
        appendLog(`${player.name} summons ${card.title} to the arena!`, playerLogType);

        logAndSetGameState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                players: newPlayers,
                [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: card,
                isInitialMonsterEngagement: false,
            };
        });

        // The very first monster of the game ends the turn. All subsequent summons continue the turn.
        if (wasFirstMonsterOfGame) {
            appendLog(`${card.title} cannot act this turn as it's the first monster in play.`, 'info');
            logAndSetGameState(prev => ({ ...prev!, gamePhase: 'turn_resolution_phase' }));
            setTimeout(() => {
                processTurnEnd();
            }, 1000);
        } else {
            appendLog(`${card.title} is now active! ${player.name}, choose your next action.`, playerLogType);
            logAndSetGameState(prev => ({
                ...prev!,
                gamePhase: 'player_action_phase',
                isProcessingAction: false, 
            }));
        }
    } catch (error) {
        console.error("Error in handlePlayMonsterFromHand:", error);
        logAndSetGameState(prev => {
            if(!prev) return null;
            const newLogs = [...(prev.gameLogMessages || []), {id: `log-${logIdCounter++}`, text: "A critical error occurred while summoning a monster.", type: 'system' as LogEntryType}];
            return prev ? {
                ...prev,
                gameLogMessages: newLogs,
                isProcessingAction: false,
                gamePhase: 'player_action_phase'
            } : null;
        });
    }
};


  const handlePlaySpellFromHand = (card: SpellCardData) => {
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;
    const { players, currentPlayerIndex, activeMonsterP1: currentActiveP1, activeMonsterP2: currentActiveP2 } = currentBoardGameState;
    const player = players[currentPlayerIndex];
    const opponentActiveMonster = currentPlayerIndex === 0 ? currentActiveP2 : currentActiveP1;


    if (player.turnCount === 0 && !opponentActiveMonster) {
        toast({ title: "First Turn Restriction", description: "You cannot play spell cards on the first turn of the game.", variant: "destructive" });
        return;
    }

    if (player.spellsPlayedThisTurn >= SPELLS_PER_TURN_LIMIT) {
        toast({ title: "Spell Limit Reached", description: `You can only play ${SPELLS_PER_TURN_LIMIT} spell(s) per turn.`, variant: "destructive" });
        return;
    }

    logAndSetGameState(prev => ({...prev!, isProcessingAction: true}));
    
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';
    const effectiveDescription = card.description || "Effect not yet loaded or defined.";
    appendLog(`${player.name} casts ${card.title}! Effect: ${effectiveDescription}`, playerLogType);


        logAndSetGameState(prev => {
            try {
                if (!prev) return null;
                let { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2, gameLogMessages, damageIndicators } = prev;

                let actingPlayer = {...players[currentPlayerIndex]};
                const actingPlayerLogType = actingPlayer.id === 'p1' ? 'player1' : 'player2';

                actingPlayer.spellsPlayedThisTurn += 1;

                const opponentPlayerIndex = 1 - currentPlayerIndex;
                const opponentPlayer = players[opponentPlayerIndex];

                let newPlayers = [...players] as [PlayerData, PlayerData];
                newPlayers[currentPlayerIndex] = actingPlayer;

                let newActiveMonsterP1 = activeMonsterP1 ? { ...activeMonsterP1 } : undefined;
                let newActiveMonsterP2 = activeMonsterP2 ? { ...activeMonsterP2 } : undefined;
                let logsToAppend: {text: string, type: LogEntryType}[] = [];
                let newDamageIndicators = {...initialDamageIndicatorState};

                const currentPlayersMonsterRef = currentPlayerIndex === 0 ? newActiveMonsterP1 : newActiveMonsterP2;
                const opponentPlayersMonsterRef = currentPlayerIndex === 0 ? newActiveMonsterP2 : newActiveMonsterP1;

                let spellEffectApplied = false;

                switch (card.title) {
                    case 'Stone Skin':
                        if (currentPlayersMonsterRef) {
                            const boost = 5;
                            const newEffect: StatusEffect = { id: `stone-skin-${Date.now()}`, type: 'shield', duration: 1, value: boost };
                            currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                            logsToAppend.push({text: `${actingPlayer.name}'s Stone Skin grants ${currentPlayersMonsterRef.title} a temporary shield of ${boost} health!`, type: 'info'});
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Fireball':
                        const fireDamage = 15;
                        const directPlayerDamage = 10;
                        if (opponentPlayersMonsterRef) {
                            const originalHp = opponentPlayersMonsterRef.hp;
                            let damageToDeal = fireDamage;
                            let message = `${actingPlayer.name}'s Fireball targets ${opponentPlayersMonsterRef.title}. `;

                            opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                            const damageTaken = originalHp - opponentPlayersMonsterRef.hp;
                            if (currentPlayerIndex === 0) newDamageIndicators.p2Monster = damageTaken; else newDamageIndicators.p1Monster = damageTaken;

                            message += `Takes ${damageTaken} fire damage to HP. (HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp}).`;
                            logsToAppend.push({text: message, type: 'damage'});
                            spellEffectApplied = true;

                            if (opponentPlayersMonsterRef.hp <= 0) {
                                logsToAppend.push({text: `${opponentPlayersMonsterRef.title} is incinerated by the Fireball!`, type: 'damage'});
                                const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        } else {
                            const originalPlayerHp = newPlayers[opponentPlayerIndex].hp;
                            newPlayers[opponentPlayerIndex].hp = Math.max(0, newPlayers[opponentPlayerIndex].hp - directPlayerDamage);
                            const damageTaken = originalPlayerHp - newPlayers[opponentPlayerIndex].hp;
                            if (currentPlayerIndex === 0) newDamageIndicators.p2Player = damageTaken; else newDamageIndicators.p1Player = damageTaken;

                            logsToAppend.push({text: `${actingPlayer.name}'s Fireball strikes ${opponentPlayer.name} directly for ${damageTaken} damage! (HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp})`, type: 'damage'});
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Healing Light':
                        if (currentPlayersMonsterRef) {
                            const healAmount = 20;
                            const originalHp = currentPlayersMonsterRef.hp;
                            currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + healAmount);
                            logsToAppend.push({text: `${actingPlayer.name}'s Healing Light restores ${currentPlayersMonsterRef.hp - originalHp} HP to ${currentPlayersMonsterRef.title}! HP: ${originalHp} -> ${currentPlayersMonsterRef.hp}.`, type: 'heal'});
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Arcane Shield':
                         if (currentPlayersMonsterRef) {
                            const shieldValue = 15;
                            const newEffect: StatusEffect = { id: `arcane-shield-${Date.now()}`, type: 'shield', duration: 99, value: shieldValue }; // Duration 99 = lasts until broken
                            currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                            logsToAppend.push({text: `${actingPlayer.name}'s Arcane Shield grants ${currentPlayersMonsterRef.title} a shield that absorbs ${shieldValue} damage!`, type: 'info'});
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                         } else {
                             logsToAppend.push({text: `${actingPlayer.name}'s Arcane Shield fizzles with no active monster to target.`, type: 'system'});
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
                            logsToAppend.push({text: `${actingPlayer.name}'s Weakening Curse reduces ${opponentPlayersMonsterRef.title}'s attack power! Melee: ${originalMelee} -> ${opponentPlayersMonsterRef.melee}, Magic: ${originalMagic} -> ${opponentPlayersMonsterRef.magic}.`, type: 'damage'});
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Terrify':
                        if (opponentPlayersMonsterRef) {
                            logsToAppend.push({text: `${actingPlayer.name}'s Terrify targets ${opponentPlayersMonsterRef.title}!`, type: 'player1'});
                            const returnedMonster = { ...opponentPlayersMonsterRef, statusEffects: [] };

                            if (newPlayers[opponentPlayerIndex].hand.length < CARDS_IN_HAND) {
                                newPlayers[opponentPlayerIndex].hand.push(returnedMonster);
                                logsToAppend.push({text: `${opponentPlayersMonsterRef.title} is returned to ${opponentPlayer.name}'s hand!`, type: 'info'});
                            } else {
                                newPlayers[opponentPlayerIndex].discardPile.push(returnedMonster);
                                logsToAppend.push({text: `${opponentPlayersMonsterRef.title} couldn't return to a full hand and was discarded!`, type: 'info'});
                            }

                            if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Regenerate':
                        if (currentPlayersMonsterRef) {
                            const newEffect: StatusEffect = { id: `regen-${Date.now()}`, type: 'regenerate', duration: 3, value: 5 };
                            currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                            logsToAppend.push({text: `${actingPlayer.name} applies Regenerate to ${currentPlayersMonsterRef.title}. It will heal 5 HP for 3 turns.`, type: 'info'});
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Swiftness Aura':
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.melee = Math.max(0, currentPlayersMonsterRef.melee + 3);
                            logsToAppend.push({text: `${currentPlayersMonsterRef.title} gains +3 Melee from Swiftness Aura. New Melee: ${currentPlayersMonsterRef.melee}.`, type: 'info'});
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Chain Lightning':
                        const chainLightningDmg = 10;
                        const chainPlayerDmg = 5;
                        if (opponentPlayersMonsterRef) {
                            const originalHp = opponentPlayersMonsterRef.hp;
                            let damageToDeal = chainLightningDmg;
                            let message = `${actingPlayer.name}'s Chain Lightning strikes ${opponentPlayersMonsterRef.title}. `;
                            
                            opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                            const damageTaken = originalHp - opponentPlayersMonsterRef.hp;
                            if (currentPlayerIndex === 0) newDamageIndicators.p2Monster = damageTaken; else newDamageIndicators.p1Monster = damageTaken;

                            message += `Takes ${damageTaken} magic damage. HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp}.`;
                            
                            logsToAppend.push({text: message, type: 'damage'});
                            spellEffectApplied = true;

                            if (opponentPlayersMonsterRef.hp <= 0) {
                                logsToAppend.push({text: `${opponentPlayersMonsterRef.title} is destroyed! The lightning arcs to ${opponentPlayer.name}!`, type: 'damage'});
                                const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;

                                const originalPlayerHp = newPlayers[opponentPlayerIndex].hp;
                                newPlayers[opponentPlayerIndex].hp = Math.max(0, newPlayers[opponentPlayerIndex].hp - chainPlayerDmg);
                                const playerDamageTaken = originalPlayerHp - newPlayers[opponentPlayerIndex].hp;
                                if (currentPlayerIndex === 0) newDamageIndicators.p2Player = playerDamageTaken; else newDamageIndicators.p1Player = playerDamageTaken;

                                logsToAppend.push({text: `${opponentPlayer.name} takes ${playerDamageTaken} lightning damage! (HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp})`, type: 'damage'});
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        }
                        break;

                    case 'Growth Spurt':
                        if (currentPlayersMonsterRef) {
                            currentPlayersMonsterRef.maxHp += 10;
                            const originalHp = currentPlayersMonsterRef.hp;
                            currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + 10);
                            logsToAppend.push({text: `${currentPlayersMonsterRef.title}'s Growth Spurt increases Max HP to ${currentPlayersMonsterRef.maxHp} and heals ${currentPlayersMonsterRef.hp - originalHp} HP. Current HP: ${currentPlayersMonsterRef.hp}.`, type: 'heal'});
                            if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            spellEffectApplied = true;
                        }
                        break;

                    case 'Drain Life':
                        const drainDamage = 8;
                        if (opponentPlayersMonsterRef) {
                            const originalOpponentHp = opponentPlayersMonsterRef.hp;
                            let damageToDeal = drainDamage;
                            let message = `${actingPlayer.name}'s Drain Life targets ${opponentPlayersMonsterRef.title}. `;

                            opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                            const damageTaken = originalOpponentHp - opponentPlayersMonsterRef.hp;
                            if (currentPlayerIndex === 0) newDamageIndicators.p2Monster = damageTaken; else newDamageIndicators.p1Monster = damageTaken;

                            message += `Takes ${damageTaken} magic damage to HP. HP: ${originalOpponentHp} -> ${opponentPlayersMonsterRef.hp}. `;
                            
                            spellEffectApplied = true;

                            // Healing part
                            if (currentPlayersMonsterRef) {
                                const lifeGained = Math.min(damageTaken, originalOpponentHp); // Heal based on actual HP lost
                                const originalOwnHp = currentPlayersMonsterRef.hp;
                                currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + lifeGained);
                                if (currentPlayersMonsterRef.hp > originalOwnHp) {
                                   message += `${currentPlayersMonsterRef.title} is healed for ${currentPlayersMonsterRef.hp - originalOwnHp} HP. HP: ${originalOwnHp} -> ${currentPlayersMonsterRef.hp}.`;
                                }
                                if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                            }
                            logsToAppend.push({text: message, type: 'heal'});


                            if (opponentPlayersMonsterRef.hp <= 0) {
                                logsToAppend.push({text: `${opponentPlayersMonsterRef.title} is drained completely!`, type: 'damage'});
                                const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, statusEffects: []};
                                newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                            } else {
                                if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                            }
                        }
                        break;

                    default:
                        logsToAppend.push({text: `The spell ${card.title} fizzles, its effect not yet defined in the ancient tomes.`, type: 'system'});
                        spellEffectApplied = true; // Consider it "applied" to prevent re-trying
                }

                if (!spellEffectApplied && currentPlayersMonsterRef) {
                    logsToAppend.push({text: `${actingPlayer.name} casts ${card.title}, but it has no effect on ${currentPlayersMonsterRef.title} or the opponent.`, type: 'system'});
                } else if (!spellEffectApplied && !currentPlayersMonsterRef){
                     logsToAppend.push({text: `${actingPlayer.name} casts ${card.title}, but with no active monster, it has no target or effect.`, type: 'system'});
                }


                const newHand = actingPlayer.hand.filter(c => c.id !== card.id);
                actingPlayer.hand = newHand;
                actingPlayer.discardPile.push(card); // Spell goes to discard
                newPlayers[currentPlayerIndex] = { ...actingPlayer, hasMulliganed: true }; // Playing a spell also counts as keeping hand


                return {
                    ...prev,
                    players: newPlayers,
                    activeMonsterP1: newActiveMonsterP1,
                    activeMonsterP2: newActiveMonsterP2,
                    gameLogMessages: [...(gameLogMessages || []), ...logsToAppend.map(log => ({...log, id: `log-${logIdCounter++}`}))],
                    gamePhase: 'player_action_phase',
                    isProcessingAction: false,
                    damageIndicators: newDamageIndicators,
                };
            } catch (error) {
                console.error("Error processing spell effect:", error);
                if (prev) {
                    const newLogs = [...(prev.gameLogMessages || []), {id: `log-${logIdCounter++}`, text: `A magical mishap occurred while casting ${card.title}!`, type: 'system' as LogEntryType}];
                    return {
                        ...prev,
                        gameLogMessages: newLogs,
                        isProcessingAction: false,
                        gamePhase: 'player_action_phase',
                    };
                }
                return null; // Should not happen if prev exists
            }
        });

        setTimeout(() => {
            logAndSetGameState(prev => prev ? { ...prev, damageIndicators: initialDamageIndicatorState } : null);
        }, 2000); // Clear indicators after 2 seconds

        const currentStateAfterSpell = gameStateRef.current;
        if(currentStateAfterSpell && currentStateAfterSpell.players[currentStateAfterSpell.currentPlayerIndex].hp <= 0) {
            processTurnEnd(); // Check for player defeat immediately
        } else if (currentStateAfterSpell && currentStateAfterSpell.players[1-currentStateAfterSpell.currentPlayerIndex].hp <= 0){
             processTurnEnd(); // Check for opponent defeat immediately
        } else {
            appendLog(`${card.title} has been cast. ${players[currentPlayerIndex].name}, choose your next action or end turn.`, playerLogType);
            logAndSetGameState(prev => ({...prev!, gamePhase: 'player_action_phase', isProcessingAction: false }));
        }


  };


  const handleAttack = () => {
    try {
        const currentBoardGameState = gameStateRef.current;
        if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;

        const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = currentBoardGameState;
        const attackerPlayer = players[currentPlayerIndex];
        const opponentActiveMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;

        if (attackerPlayer.turnCount === 0 && !opponentActiveMonster) {
            toast({ title: "First Turn Rule", description: "The first player cannot attack on their first turn.", variant: "destructive" });
            return;
        }

        const attackerMonster = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;

        if (!attackerMonster || attackerMonster.hp <= 0) {
            toast({ title: "Cannot Attack", description: `Your active monster is defeated and cannot attack.`, variant: "destructive" });
            return;
        }

        logAndSetGameState(prev => {
            if (!prev) return null;
            const newPlayers = [...prev.players] as [PlayerData, PlayerData];
            newPlayers[prev.currentPlayerIndex] = { ...newPlayers[prev.currentPlayerIndex], hasMulliganed: true };
            return { ...prev, isProcessingAction: true, gamePhase: 'combat_phase', players: newPlayers };
        });

        setTimeout(() => {
            const freshState = gameStateRef.current;
            if (!freshState) return;

            let { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = freshState;
            let logsToAppend: {text: string, type: LogEntryType}[] = [];
            let newPlayers = [...players] as [PlayerData, PlayerData];
            const attackerPlayer = newPlayers[currentPlayerIndex];
            const attackerLogType = attackerPlayer.id === 'p1' ? 'player1' : 'player2';

            let currentAttackerMonster = (currentPlayerIndex === 0 ? { ...activeMonsterP1! } : { ...activeMonsterP2! });
            let currentDefenderMonster = currentPlayerIndex === 0 ? (activeMonsterP2 ? { ...activeMonsterP2 } : undefined) : (activeMonsterP1 ? { ...activeMonsterP1 } : undefined);
            
            const defenderPlayerIndex = 1 - currentPlayerIndex as 0 | 1;
            const defenderPlayer = newPlayers[defenderPlayerIndex];
            const defenderLogType = defenderPlayer.id === 'p1' ? 'player1' : 'player2';
            
            
            // Local tracking for damage indicators to ensure they are set only once per combat event
            let finalDamageIndicators: DamageIndicatorState = { ...initialDamageIndicatorState };

            const applyDamage = (targetMonster: MonsterCardData, damage: number, damageType: 'melee' | 'magic'): { updatedMonster: MonsterCardData; log: {text: string, type: LogEntryType}[]; damageDealt: number; } => {
                let logs: {text: string, type: LogEntryType}[] = [];
                let remainingDamage = damage;
                let totalDamageDealt = 0;
                let monster = { ...targetMonster, statusEffects: [...(targetMonster.statusEffects || [])] };
                const originalHp = monster.hp;

                const shieldIndex = monster.statusEffects.findIndex(e => e.type === 'shield');

                if (shieldIndex > -1) {
                    let shield = { ...monster.statusEffects[shieldIndex] };
                    const damageToShield = Math.min(remainingDamage, shield.value);
                    if (damageToShield > 0) {
                        remainingDamage -= damageToShield;
                        logs.push({ text: `${monster.title}'s shield absorbs ${damageToShield} ${damageType} damage!`, type: 'info' });

                        if (shield.value <= damageToShield) {
                            logs.push({ text: `The shield on ${monster.title} breaks!`, type: 'info' });
                            monster.statusEffects.splice(shieldIndex, 1);
                        } else {
                            shield.value -= damageToShield;
                            monster.statusEffects[shieldIndex] = shield;
                            logs.push({ text: `The shield has ${shield.value} health remaining.`, type: 'info' });
                        }
                    }
                }
                
                if (remainingDamage > 0) {
                    monster.hp = Math.max(0, monster.hp - remainingDamage);
                }

                totalDamageDealt = originalHp - monster.hp;

                if (totalDamageDealt > 0) {
                    logs.push({ text: `${monster.title} takes ${totalDamageDealt} ${damageType} damage. (HP: ${originalHp} -> ${monster.hp})`, type: 'damage' });
                } else if (damage > 0) {
                    logs.push({ text: `${monster.title} takes no damage.`, type: 'info' });
                }
                return { updatedMonster: monster, log: logs, damageDealt: totalDamageDealt };
            };

            logsToAppend.push({ text: `${players[currentPlayerIndex].name}'s ${currentAttackerMonster.title} attacks!`, type: attackerLogType});

            if (currentDefenderMonster && currentDefenderMonster.hp > 0) {
                logsToAppend.push({ text: `${currentAttackerMonster.title} clashes with ${currentDefenderMonster.title}!`, type: 'system' });
                const isMagicAttack = currentAttackerMonster.magic > currentAttackerMonster.melee;
                const attackValue = isMagicAttack ? currentAttackerMonster.magic : currentAttackerMonster.melee;
                const attackType = isMagicAttack ? "magic" : "melee";
                logsToAppend.push({ text: `Attack is ${attackType}-based with a power of ${attackValue}.`, type: 'info'});
                
                const defenderHpBefore = currentDefenderMonster.hp;
                const defenderResult = applyDamage(currentDefenderMonster, attackValue, attackType);
                currentDefenderMonster = defenderResult.updatedMonster;
                logsToAppend.push(...defenderResult.log);
                
                if (defenderResult.damageDealt > 0) {
                    if (defenderPlayerIndex === 0) finalDamageIndicators.p1Monster = defenderResult.damageDealt;
                    else finalDamageIndicators.p2Monster = defenderResult.damageDealt;
                }

                if (currentDefenderMonster.hp <= 0) {
                    logsToAppend.push({ text: `${currentDefenderMonster.title} is defeated!`, type: 'damage' });
                    const overkillDamage = attackValue - defenderHpBefore;
                    if (overkillDamage > 0) {
                        const originalPlayerHp = newPlayers[defenderPlayerIndex].hp;
                        newPlayers[defenderPlayerIndex].hp = Math.max(0, originalPlayerHp - overkillDamage);
                        const playerDamageTaken = originalPlayerHp - newPlayers[defenderPlayerIndex].hp;
                        if (playerDamageTaken > 0) {
                            logsToAppend.push({ text: `Overkill! ${players[defenderPlayerIndex].name} takes ${playerDamageTaken} trample damage! (HP: ${originalPlayerHp} -> ${newPlayers[defenderPlayerIndex].hp})`, type: 'damage' });
                            if(defenderPlayerIndex === 0) finalDamageIndicators.p1Player = playerDamageTaken; else finalDamageIndicators.p2Player = playerDamageTaken;
                        }
                    }

                    const defeatedCard = { ...currentDefenderMonster, hp: 0, statusEffects: [] };
                    newPlayers[defenderPlayerIndex].discardPile.push(defeatedCard);
                    currentDefenderMonster = undefined;
                }

                if (currentDefenderMonster && currentDefenderMonster.hp > 0) {
                    logsToAppend.push({ text: `${currentDefenderMonster.title} counter-attacks!`, type: defenderLogType });
                    const isCounterMagic = currentDefenderMonster.magic > currentDefenderMonster.melee;
                    const counterAttackValue = isCounterMagic ? currentDefenderMonster.magic : currentDefenderMonster.melee;
                    const counterAttackType = isCounterMagic ? "magic" : "melee";
                    logsToAppend.push({ text: `Counter-attack is ${counterAttackType}-based with a power of ${counterAttackValue}.`, type: 'info' });
                    
                    const attackerHpBefore = currentAttackerMonster.hp;
                    const attackerResult = applyDamage(currentAttackerMonster, counterAttackValue, counterAttackType);
                    currentAttackerMonster = attackerResult.updatedMonster;
                    logsToAppend.push(...attackerResult.log);

                    if(attackerResult.damageDealt > 0) {
                        if (currentPlayerIndex === 0) finalDamageIndicators.p1Monster = attackerResult.damageDealt;
                        else finalDamageIndicators.p2Monster = attackerResult.damageDealt;
                    }

                    if (currentAttackerMonster.hp <= 0) {
                        logsToAppend.push({ text: `${currentAttackerMonster.title} is defeated in the counter-attack!`, type: 'damage' });
                         const overkillDamage = counterAttackValue - attackerHpBefore;
                        if (overkillDamage > 0) {
                             const originalPlayerHp = newPlayers[currentPlayerIndex].hp;
                             newPlayers[currentPlayerIndex].hp = Math.max(0, originalPlayerHp - overkillDamage);
                             const playerDamageTaken = originalPlayerHp - newPlayers[currentPlayerIndex].hp;
                             if (playerDamageTaken > 0) {
                                logsToAppend.push({ text: `Overkill! ${players[currentPlayerIndex].name} takes ${playerDamageTaken} trample damage! (HP: ${originalPlayerHp} -> ${newPlayers[currentPlayerIndex].hp})`, type: 'damage' });
                                if(currentPlayerIndex === 0) finalDamageIndicators.p1Player = playerDamageTaken;
                                else finalDamageIndicators.p2Player = playerDamageTaken;
                             }
                        }
                        const defeatedCard = { ...currentAttackerMonster, hp: 0, statusEffects: [] };
                        newPlayers[currentPlayerIndex].discardPile.push(defeatedCard);
                        currentAttackerMonster = undefined!;
                    }
                }
            } else {
                const isMagicAttack = currentAttackerMonster.magic > currentAttackerMonster.melee;
                const attackValue = isMagicAttack ? currentAttackerMonster.magic : currentAttackerMonster.melee;
                const attackType = isMagicAttack ? "magic" : "melee";
                const originalDefenderHp = newPlayers[defenderPlayerIndex].hp;

                newPlayers[defenderPlayerIndex].hp = Math.max(0, newPlayers[defenderPlayerIndex].hp - attackValue);
                const playerDamageTaken = originalDefenderHp - newPlayers[defenderPlayerIndex].hp;

                if (playerDamageTaken > 0) {
                    logsToAppend.push({ text: `${players[defenderPlayerIndex].name}'s HP is targeted directly for ${playerDamageTaken} ${attackType} damage! (HP: ${originalDefenderHp} -> ${newPlayers[defenderPlayerIndex].hp})`, type: 'damage' });
                    if(defenderPlayerIndex === 0) finalDamageIndicators.p1Player = playerDamageTaken; else finalDamageIndicators.p2Player = playerDamageTaken;
                }
            }

            const finalActiveMonsterP1 = currentPlayerIndex === 0 ? currentAttackerMonster : currentDefenderMonster;
            const finalActiveMonsterP2 = currentPlayerIndex === 1 ? currentAttackerMonster : currentDefenderMonster;

            logAndSetGameState(prev => ({
                ...prev!,
                players: newPlayers,
                activeMonsterP1: finalActiveMonsterP1,
                activeMonsterP2: finalActiveMonsterP2,
                gameLogMessages: [...(prev!.gameLogMessages || []), ...logsToAppend.map(log => ({...log, id: `log-${logIdCounter++}`}))],
                gamePhase: 'turn_resolution_phase',
                damageIndicators: finalDamageIndicators,
            }));
            
            setTimeout(() => {
                processTurnEnd();
            }, 1500);

        }, 1000); 
    } catch (error) {
        console.error("Error in handleAttack:", error);
        logAndSetGameState(prev => {
            if(!prev) return null;
            const newLogs = [...(prev.gameLogMessages || []), {id: `log-${logIdCounter++}`, text: "A critical error occurred during combat.", type: 'system' as LogEntryType}];
            return prev ? {
                ...prev,
                gameLogMessages: newLogs,
                isProcessingAction: false,
                gamePhase: 'player_action_phase'
            } : null;
        });
    }
};



  const handleSwapMonster = (selectedMonsterFromHand: MonsterCardData) => {
    logAndSetGameState(prev => {
      if (!prev || prev.isProcessingAction) return prev;
      const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = prev;
      const opponentActiveMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;

      if (players[currentPlayerIndex].turnCount === 0 && !opponentActiveMonster) {
        toast({ title: "First Turn Rule", description: "The first player cannot swap monsters on their first turn.", variant: "destructive"});
        return prev;
      }

      const player = players[currentPlayerIndex];
      const playerLogType = player.id === 'p1' ? 'player1' : 'player2';
      const currentActiveMonster = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;

      let logsToAppend: {text: string, type: LogEntryType}[] = [];
      let newPlayers = [...players] as [PlayerData, PlayerData];
      let newPlayerHand = [...player.hand];

      // Remove selected monster from hand
      newPlayerHand = newPlayerHand.filter(c => c.id !== selectedMonsterFromHand.id);

      if (currentActiveMonster) {
        logsToAppend.push({text: `${player.name} recalls ${currentActiveMonster.title}.`, type: playerLogType});
        // Add current active monster back to hand if space, else discard
        const monsterToReturn = { ...currentActiveMonster, statusEffects: [] }; // Clear status effects on return/discard
        if (newPlayerHand.length < CARDS_IN_HAND) {
          newPlayerHand.push(monsterToReturn);
          logsToAppend.push({text: `${currentActiveMonster.title} returns to hand.`, type: 'info'});
        } else {
          newPlayers[currentPlayerIndex].discardPile.push(monsterToReturn);
          logsToAppend.push({text: `${currentActiveMonster.title} couldn't return to a full hand and was discarded.`, type: 'info'});
        }
      }

      newPlayers[currentPlayerIndex] = { ...player, hand: newPlayerHand, hasMulliganed: true }; // Swapping also counts as keeping hand
      logsToAppend.push({text: `${player.name} summons ${selectedMonsterFromHand.title} to replace it!`, type: playerLogType});

      const updatedState = {
        ...prev,
        players: newPlayers,
        [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: selectedMonsterFromHand,
        gameLogMessages: [...(prev.gameLogMessages || []), ...logsToAppend.map(l => ({...l, id: `log-${logIdCounter++}`}))],
        gamePhase: 'player_action_phase' as GamePhase, // Return to action phase after swap
        isProcessingAction: true, // Temporarily set, then resolve
      };

        // After swap, immediately move to turn resolution
        updatedState.gamePhase = 'turn_resolution_phase';
        updatedState.gameLogMessages.push({id: `log-${logIdCounter++}`, text: `${selectedMonsterFromHand.title} is now active but cannot act further this turn after swapping.`, type: 'info'});

        setTimeout(() => {
            processTurnEnd(); // This will set isProcessingAction to false
        }, 1000); // Short delay for log reading

      return updatedState;
    });
  };

  const handleInitiateSwap = () => {
    const player = gameStateRef.current?.players[gameStateRef.current.currentPlayerIndex];
    if (!player) return;
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';

    logAndSetGameState(prev => {
      if (!prev || prev.isProcessingAction) return prev;
      const { players, currentPlayerIndex, activeMonsterP2, activeMonsterP1 } = prev;
      const opponentActiveMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;

      if (players[currentPlayerIndex].turnCount === 0 && !opponentActiveMonster) {
        toast({ title: "First Turn Rule", description: "You cannot swap monsters on the first turn of the game.", variant: "destructive"});
        return prev;
      }
      appendLog(`${prev.players[prev.currentPlayerIndex].name} is considering a monster swap. Select a monster from your hand.`, playerLogType);
      const newPlayers = [...prev.players] as [PlayerData, PlayerData];
      newPlayers[prev.currentPlayerIndex] = {...newPlayers[prev.currentPlayerIndex], hasMulliganed: true };
      return { ...prev, gamePhase: 'selecting_swap_monster_phase', players: newPlayers };
    });
  };

  const handleEndTurn = () => {
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;
    const player = currentBoardGameState.players[currentBoardGameState.currentPlayerIndex];
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';


    logAndSetGameState(prev => {
      if(!prev) return null;
      const newPlayers = [...prev.players] as [PlayerData, PlayerData];
      newPlayers[prev.currentPlayerIndex] = { ...newPlayers[prev.currentPlayerIndex], hasMulliganed: true };
      return { ...prev, isProcessingAction: true, gamePhase: 'turn_resolution_phase', players: newPlayers }
    });
    appendLog(`${player.name} ends their turn.`, playerLogType);
    setTimeout(() => {
      processTurnEnd();
    }, 500); // Short delay
  };

  const handleInitiateMulligan = () => {
    const player = gameStateRef.current?.players[gameStateRef.current.currentPlayerIndex];
    if (!player) return;
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';
    logAndSetGameState(prev => {
      if (!prev || prev.isProcessingAction) return prev;
      appendLog(`${prev.players[prev.currentPlayerIndex].name} is considering a mulligan. Select ${MULLIGAN_CARD_COUNT} cards to return.`, playerLogType);
      return { ...prev, gamePhase: 'mulligan_phase' };
    });
  };

  const handleCancelMulligan = () => {
    const player = gameStateRef.current?.players[gameStateRef.current.currentPlayerIndex];
    if (!player) return;
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';
    logAndSetGameState(prev => {
      if (!prev) return prev;
      appendLog(`Mulligan canceled. Choose an action.`, playerLogType);
      return { ...prev, gamePhase: 'player_action_phase' };
    });
    setSelectedForMulligan([]);
  };

  const handleConfirmMulligan = () => {
    if (selectedForMulligan.length !== MULLIGAN_CARD_COUNT) {
      toast({ title: "Invalid Selection", description: `You must select exactly ${MULLIGAN_CARD_COUNT} cards to mulligan.`, variant: "destructive" });
      return;
    }

    logAndSetGameState(prev => {
      if (!prev) return null;
      
      const player = { ...prev.players[prev.currentPlayerIndex] };
      const playerLogType = player.id === 'p1' ? 'player1' : 'player2';

      let logsToAppend: {text: string, type: LogEntryType}[] = [
        { text: `${player.name} returns ${MULLIGAN_CARD_COUNT} cards to their deck...`, type: playerLogType }
      ];
      
      const cardsToReturn = player.hand.filter(c => selectedForMulligan.includes(c.id));
      const newHand = player.hand.filter(c => !selectedForMulligan.includes(c.id));
      const newDeck = shuffleDeck([...player.deck, ...cardsToReturn]);

      const { dealtCards, remainingDeck } = dealCards(newDeck, MULLIGAN_CARD_COUNT);
      
      player.hand = [...newHand, ...dealtCards];
      player.deck = remainingDeck;
      player.hasMulliganed = true;
      
      const newPlayers = [...prev.players] as [PlayerData, PlayerData];
      newPlayers[prev.currentPlayerIndex] = player;
      
      logsToAppend.push({ text: `...and draws ${MULLIGAN_CARD_COUNT} new cards. Choose an action.`, type: playerLogType });
      
      return {
        ...prev,
        players: newPlayers,
        gameLogMessages: [...(prev.gameLogMessages || []), ...logsToAppend.map(l => ({...l, id: `log-${logIdCounter++}`}))],
        gamePhase: 'player_action_phase',
        isProcessingAction: false,
      };
    });

    setSelectedForMulligan([]);
  };

  const handleRestartGame = () => {
    console.log("[GameBoard] Restarting game...");
    logIdCounter = 0;
    setGameState(null); // This will trigger the useEffect to re-initialize
    hasInitialized.current = false; // Allow re-initialization
    setSelectedForMulligan([]);
  };


  if (!gameState || !gameState.players) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-foreground p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl font-semibold">Loading Arcane Clash...</p>
        <p className="text-muted-foreground mt-2">
          {gameState?.gameLogMessages?.slice(-1)[0]?.text || 'Connecting to the arcane archives...'}
        </p>
      </div>
    );
  }

  const { players, currentPlayerIndex, gamePhase, activeMonsterP1, activeMonsterP2, winner, gameLogMessages, isProcessingAction, damageIndicators } = gameState;
  const currentPlayer = players[currentPlayerIndex];
  const opponentPlayer = players[1 - currentPlayerIndex];
  const currentPlayersActiveMonster = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;
  const opponentActiveMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;


  const handleCardSelect = (card: CardData) => {
    if (isProcessingAction || gamePhase === 'loading_art' || gamePhase === 'coin_flip_animation') return;

    if (gamePhase === 'mulligan_phase') {
      setSelectedForMulligan(prev => {
        if (prev.includes(card.id)) {
          return prev.filter(id => id !== card.id);
        } else {
          if (prev.length < MULLIGAN_CARD_COUNT) {
            return [...prev, card.id];
          }
          return prev;
        }
      });
      return;
    }

    if (gamePhase === 'selecting_swap_monster_phase') {
      if (card.cardType === 'Monster') {
        handleSwapMonster(card as MonsterCardData);
      } else {
        toast({ title: "Invalid Swap", description: "You must select a Monster card to swap.", variant: "destructive" });
      }
      return;
    }

    if (gamePhase === 'player_action_phase') {
      if (card.cardType === 'Monster') {
        if (!currentPlayersActiveMonster) {
          handlePlayMonsterFromHand(card as MonsterCardData);
        } else {
          toast({ title: "Monster Already Active", description: "You already have an active monster. Swap it or attack.", variant: "destructive" });
        }
      } else if (card.cardType === 'Spell') {
        handlePlaySpellFromHand(card as SpellCardData);
      }
    }
  };


  const canPlayMonsterFromHand = currentPlayer.hand.some(c => c.cardType === 'Monster');
  const canPlaySpellFromHand = currentPlayer.hand.some(c => c.cardType === 'Spell');


  return (
    <div className="flex flex-col h-full w-full items-stretch">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 md:gap-4 p-2 md:p-3">
        <div className="flex justify-start">
          <PlayerStatusDisplay player={players[0]} isCurrentPlayer={currentPlayerIndex === 0} damage={damageIndicators.p1Player} />
        </div>
        <div className="flex justify-center items-center self-center pt-2">
          <Layers3 className="w-10 h-10 text-accent animate-pulse" />
        </div>
        <div className="flex justify-end">
          <PlayerStatusDisplay player={players[1]} isCurrentPlayer={currentPlayerIndex === 1} isOpponent={true} damage={damageIndicators.p2Player} />
        </div>
      </div>

      <div className="flex-grow grid grid-cols-[220px_1fr_220px] md:grid-cols-[250px_1fr_250px] gap-1 md:gap-2 overflow-hidden min-h-0 px-1 md:px-2">
        {/* Player 1 Hand (Current Player if P1, Opponent if P2) */}
         <div className={cn("player-hand-container overflow-y-auto h-full border border-border/30 rounded-lg shadow-inner", currentPlayerIndex === 0 ? "bg-primary/5" : "bg-card/20")}>
            <PlayerHand
                cards={players[0].hand}
                onCardSelect={currentPlayerIndex === 0 ? handleCardSelect : () => {}}
                isPlayerTurn={currentPlayerIndex === 0}
                canPlayMonster={!activeMonsterP1 && (gamePhase === 'player_action_phase')}
                currentPhase={gamePhase}
                spellsPlayedThisTurn={players[0].spellsPlayedThisTurn}
                isInitialEngagement={gameState.isInitialMonsterEngagement}
                opponentActiveMonster={activeMonsterP2}
                isMulliganPhase={gamePhase === 'mulligan_phase' && currentPlayerIndex === 0}
                selectedCardIds={selectedForMulligan}
            />
        </div>

        <BattleArena
          player1Card={activeMonsterP1}
          player2Card={activeMonsterP2}
          player1Name={players[0].name}
          player2Name={players[1].name}
          showClashAnimation={gamePhase === 'combat_phase'}
          gameLogMessages={gameLogMessages}
          gamePhase={gamePhase}
          onCoinFlipAnimationComplete={gamePhase === 'coin_flip_animation' ? handleCoinFlipAnimationComplete : undefined}
          winningPlayerNameForCoinFlip={gamePhase === 'coin_flip_animation' ? players[currentPlayerIndex].name : undefined}
          damageIndicators={damageIndicators}
        />

        {/* Player 2 Hand (Current Player if P2, Opponent if P1) */}
         <div className={cn("player-hand-container overflow-y-auto h-full border border-border/30 rounded-lg shadow-inner", currentPlayerIndex === 1 ? "bg-primary/5" : "bg-card/20")}>
            <PlayerHand
                cards={players[1].hand}
                onCardSelect={currentPlayerIndex === 1 ? handleCardSelect : () => {}}
                isPlayerTurn={currentPlayerIndex === 1}
                isOpponent={true}
                canPlayMonster={!activeMonsterP2 && (gamePhase === 'player_action_phase')}
                currentPhase={gamePhase}
                spellsPlayedThisTurn={players[1].spellsPlayedThisTurn}
                isInitialEngagement={gameState.isInitialMonsterEngagement}
                opponentActiveMonster={activeMonsterP1}
                isMulliganPhase={gamePhase === 'mulligan_phase' && currentPlayerIndex === 1}
                selectedCardIds={selectedForMulligan}
            />
        </div>
      </div>

      {gamePhase !== 'coin_flip_animation' && gamePhase !== 'loading_art' && gamePhase !== 'game_over_phase' && !isProcessingAction && (
        <div className="flex justify-center w-full">
          <PlayerActions
            currentPlayer={currentPlayer}
            activeMonster={currentPlayersActiveMonster}
            opponentActiveMonster={opponentActiveMonster}
            onAttack={handleAttack}
            onInitiateSwap={handleInitiateSwap}
            onEndTurn={handleEndTurn}
            canPlayMonsterFromHand={canPlayMonsterFromHand && !currentPlayersActiveMonster}
            canPlaySpellFromHand={canPlaySpellFromHand}
            playerHandFull={currentPlayer.hand.length >= CARDS_IN_HAND}
            spellsPlayedThisTurn={currentPlayer.spellsPlayedThisTurn}
            maxSpellsPerTurn={SPELLS_PER_TURN_LIMIT}
            isEffectivelyFirstTurn={currentPlayer.turnCount === 0 && !opponentActiveMonster}
            gamePhase={gamePhase}
            onInitiateMulligan={handleInitiateMulligan}
            onCancelMulligan={handleCancelMulligan}
            onConfirmMulligan={handleConfirmMulligan}
            mulliganCardCount={selectedForMulligan.length}
          />
        </div>
      )}
       {(isProcessingAction && gamePhase !== 'loading_art' && gamePhase !== 'coin_flip_animation' && gamePhase !== 'game_over_phase') && (
        <div className="flex flex-col items-center justify-center p-2 md:p-4 my-2 md:my-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
          <p className="text-sm text-accent-foreground">Processing action...</p>
        </div>
      )}


      <GameOverModal
        winnerName={winner?.name}
        onRestart={handleRestartGame}
        isOpen={gamePhase === 'game_over_phase'}
      />
       {process.env.NODE_ENV === 'development' && (
            <Button
                onClick={() => {
                    logAndSetGameState(prev => {
                        if (!prev) return null;
                        const newLog = [...prev.gameLogMessages, {id: `log-${logIdCounter++}`, text:"DEV: Forced turn end.", type: 'system' as LogEntryType}];
                        return {
                            ...prev,
                            gameLogMessages: newLog,
                            isProcessingAction: true,
                        }
                    });
                    setTimeout(() => processTurnEnd(), 100);
                }}
                variant="outline"
                size="sm"
                className="absolute bottom-2 right-2 opacity-50 hover:opacity-100"
                aria-label="Dev: Force End Turn"
            >
                Force End Turn (Dev)
            </Button>
        )}
        <Button
            onClick={handleRestartGame}
            variant="outline"
            size="sm"
            className="absolute bottom-2 left-2 opacity-70 hover:opacity-100"
            title="Restart Game"
        >
            <Trash2 className="mr-2 h-4 w-4" /> Restart
        </Button>
    </div>
  );
}
