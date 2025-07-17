
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase, MonsterCardData, SpellCardData, StatusEffect, IndicatorState, GameLogEntry, LogEntryType } from '@/types';
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
import { useAudio } from '@/contexts/AudioContext';
import { SoundToggle } from './SoundToggle';


const INITIAL_PLAYER_HP = 30;
const CARDS_IN_HAND = 5;
const MAX_MONSTERS_PER_DECK = 13;
const MAX_SPELLS_PER_DECK = 12;
const SPELLS_PER_TURN_LIMIT = 1;
const MULLIGAN_CARD_COUNT = 3;

const initialIndicatorState: IndicatorState = {
    p1MonsterDamage: null,
    p2MonsterDamage: null,
    p1PlayerDamage: null,
    p2PlayerDamage: null,
    p1MonsterHeal: null,
    p2MonsterHeal: null,
    p1PlayerHeal: null,
    p2PlayerHeal: null,
};

let logIdCounter = 0;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedForMulligan, setSelectedForMulligan] = useState<string[]>([]);
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const previousGameStateRef = useRef<GameState | null>(null);
  const { isMuted, play } = useAudio();
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (backgroundMusicRef.current) {
        backgroundMusicRef.current.volume = 0.1;
        if (!isMuted) {
            backgroundMusicRef.current.play().catch(e => console.log("Audio play failed:", e));
        } else {
            backgroundMusicRef.current.pause();
        }
    }
  }, [isMuted]);


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
    const newLogEntries: GameLogEntry[] = messages.map(msg => ({...msg, id: `log-${logIdCounter++}`}));
    
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
        indicators: initialIndicatorState,
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
            indicators: initialIndicatorState,
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
        monsterJustPlayed: false,
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
        monsterJustPlayed: false,
      };

      play('coin-flip');
      logAndSetGameState({
        players: [initialPlayer1, initialPlayer2],
        currentPlayerIndex: firstPlayerIndex,
        gamePhase: 'coin_flip_animation',
        activeMonsterP1: undefined,
        activeMonsterP2: undefined,
        winner: undefined,
        gameLogMessages: [{ id: `log-${logIdCounter++}`, text: "Game cards ready. First player will be determined by coin flip. Flipping coin...", type: 'system' }],
        isProcessingAction: false,
        indicators: initialIndicatorState,
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
              indicators: initialIndicatorState,
          };
      });
      hasInitialized.current = false;
    } finally {
      console.log('[GameBoard] Initializing game sequence finished.');
    }
  }, [toast, logAndSetGameState, play]);

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
    let newIndicators = { ...currentState.indicators };

    const playerWhoseTurnIsStarting = newPlayers[playerIndexForTurnStart];
    let activeMonsterForTurnPlayer = playerIndexForTurnStart === 0 ? newActiveMonsterP1 : newActiveMonsterP2;

    if (activeMonsterForTurnPlayer && activeMonsterForTurnPlayer.statusEffects && activeMonsterForTurnPlayer.statusEffects.length > 0) {
        const effectsToKeep: StatusEffect[] = [];
        for (const effect of activeMonsterForTurnPlayer.statusEffects) {
            let effectKept = true;
            if (effect.type === 'regenerate') {
                const healAmount = effect.value;
                const originalHp = activeMonsterForTurnPlayer.hp;
                activeMonsterForTurnPlayer.hp = Math.min(activeMonsterForTurnPlayer.maxHp, activeMonsterForTurnPlayer.hp + healAmount);
                const actualHeal = activeMonsterForTurnPlayer.hp - originalHp;
                if (actualHeal > 0) {
                    play('heal');
                    newLogMessages.push({ id: `log-${logIdCounter++}`, text: `${playerWhoseTurnIsStarting.name}'s ${activeMonsterForTurnPlayer.title} regenerates ${actualHeal} HP. (HP: ${originalHp} -> ${activeMonsterForTurnPlayer.hp})`, type: 'heal' });
                    if (playerIndexForTurnStart === 0) newIndicators.p1MonsterHeal = actualHeal; else newIndicators.p2MonsterHeal = actualHeal;
                }
                effect.duration -= 1;
            }
            if(effect.type === 'stun' || effect.type === 'shield' || effect.type === 'silence' || effect.type === 'ethereal' || effect.type === 'empower' || effect.type === 'frostbite'){
                effect.duration -= 1;
            }

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

    return {
        ...currentState,
        players: newPlayers,
        activeMonsterP1: newActiveMonsterP1,
        activeMonsterP2: newActiveMonsterP2,
        gameLogMessages: newLogMessages,
        indicators: newIndicators,
    };
  };


  const processTurnEnd = () => {
    console.log("[GameBoard] Processing turn end...");
    logAndSetGameState(prev => {
      if (!prev) return null;
      let { players, currentPlayerIndex, gameLogMessages, activeMonsterP1, activeMonsterP2 } = prev;

      const actingPlayerInitial = players[currentPlayerIndex];
      const opponentPlayerIndex = (1 - currentPlayerIndex) as 0 | 1;

      const playerAfterAction = {
          ...actingPlayerInitial,
          spellsPlayedThisTurn: 0,
          turnCount: actingPlayerInitial.turnCount + 1,
          monsterJustPlayed: false, // Reset summoning sickness flag for player whose turn just ended
      };
      let updatedPlayersArr = [...players] as [PlayerData, PlayerData];
      updatedPlayersArr[currentPlayerIndex] = playerAfterAction;

      let newLogs: GameLogEntry[] = [...(gameLogMessages || [])];

      const stateForStatusEffects: GameState = {
          ...prev,
          players: updatedPlayersArr,
          currentPlayerIndex: opponentPlayerIndex,
          activeMonsterP1: activeMonsterP1 ? {...activeMonsterP1} : undefined,
          activeMonsterP2: activeMonsterP2 ? {...activeMonsterP2} : undefined,
          gameLogMessages: newLogs,
          indicators: initialIndicatorState,
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
        play('lose');
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
            indicators: stateAfterStatusEffects.indicators,
         };
      } else if (updatedPlayersArr[0].hp <= 0) {
        play('win');
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
            indicators: stateAfterStatusEffects.indicators,
        };
      } else if (updatedPlayersArr[1].hp <= 0) {
        play('win');
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
            indicators: stateAfterStatusEffects.indicators,
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
        isProcessingAction: false,
        indicators: stateAfterStatusEffects.indicators,
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
    play('card-play');
    logAndSetGameState(prev => {
        if (!prev || prev.isProcessingAction) return prev;

        const { players, currentPlayerIndex } = prev;
        const player = players[currentPlayerIndex];
        const playerLogType = player.id === 'p1' ? 'player1' : 'player2';

        const newHand = player.hand.filter(c => c.id !== card.id);
        const updatedPlayer = { ...player, hand: newHand, hasMulliganed: true, monsterJustPlayed: true }; // Set summon sickness flag
        const newPlayers = [...players] as [PlayerData, PlayerData];
        newPlayers[currentPlayerIndex] = updatedPlayer;

        const logs = [
            { text: `${player.name} summons ${card.title} to the arena!`, type: playerLogType },
            { text: `${card.title} cannot act this turn due to summoning sickness.`, type: 'info' as LogEntryType }
        ];

        appendLogs(logs);

        return {
            ...prev,
            players: newPlayers,
            [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: card,
            gamePhase: 'player_action_phase',
            isProcessingAction: false,
        };
    });
};


  const handlePlaySpellFromHand = (card: SpellCardData) => {
    play('card-play');
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;

    logAndSetGameState(prev => ({ ...prev!, isProcessingAction: true }));

    const { players, currentPlayerIndex, activeMonsterP1: currentActiveP1, activeMonsterP2: currentActiveP2 } = currentBoardGameState;
    const player = players[currentPlayerIndex];
    const opponentActiveMonster = currentPlayerIndex === 0 ? currentActiveP2 : currentActiveP1;

    const isFirstTurnOfGame = player.turnCount === 0 && !opponentActiveMonster;
    if (isFirstTurnOfGame) {
        toast({ title: "First Turn Restriction", description: "You cannot play spell cards on the first turn of the game.", variant: "destructive" });
        logAndSetGameState(prev => ({ ...prev!, isProcessingAction: false }));
        return;
    }

    if (player.spellsPlayedThisTurn >= SPELLS_PER_TURN_LIMIT) {
        toast({ title: "Spell Limit Reached", description: `You can only play ${SPELLS_PER_TURN_LIMIT} spell(s) per turn.`, variant: "destructive" });
        logAndSetGameState(prev => ({ ...prev!, isProcessingAction: false }));
        return;
    }

    logAndSetGameState(prev => {
        if (!prev) return null;
        try {
            let { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2, gameLogMessages, indicators } = prev;

            let actingPlayer = {...players[currentPlayerIndex]};
            const actingPlayerLogType = actingPlayer.id === 'p1' ? 'player1' : 'player2';

            const effectiveDescription = card.description || "Effect not yet loaded or defined.";
            let logsToAppend: {text: string, type: LogEntryType}[] = [
                { text: `${actingPlayer.name} casts ${card.title}! Effect: ${effectiveDescription}`, type: actingPlayerLogType }
            ];

            actingPlayer.spellsPlayedThisTurn += 1;

            const opponentPlayerIndex = 1 - currentPlayerIndex;
            let opponentPlayer = players[opponentPlayerIndex];

            let newPlayers = [...players] as [PlayerData, PlayerData];
            
            let newActiveMonsterP1 = activeMonsterP1 ? { ...activeMonsterP1 } : undefined;
            let newActiveMonsterP2 = activeMonsterP2 ? { ...activeMonsterP2 } : undefined;
            let newIndicators = {...initialIndicatorState};

            let currentPlayersMonsterRef = currentPlayerIndex === 0 ? newActiveMonsterP1 : newActiveMonsterP2;
            let opponentPlayersMonsterRef = currentPlayerIndex === 0 ? newActiveMonsterP2 : newActiveMonsterP1;

            let spellEffectApplied = false;

            switch (card.title) {
                case 'Ethereal Form':
                    if (currentPlayersMonsterRef) {
                        const newEffect: StatusEffect = { id: `ethereal-${Date.now()}`, type: 'ethereal', duration: 2, value: 50 }; // Lasts for player's turn and opponent's turn
                        currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                        logsToAppend.push({text: `${actingPlayer.name}'s Ethereal Form causes ${currentPlayersMonsterRef.title} to shimmer, taking 50% reduced damage until its next turn.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                        spellEffectApplied = true;
                    } else {
                        logsToAppend.push({text: `${actingPlayer.name}'s Ethereal Form fizzles with no active monster to target.`, type: 'system'});
                        spellEffectApplied = true;
                    }
                    break;
                case 'Stone Skin':
                    if (currentPlayersMonsterRef) {
                        const boost = 5;
                        const newEffect: StatusEffect = { id: `stone-skin-${Date.now()}`, type: 'shield', duration: 2, value: boost }; // lasts for player's turn and opponent's turn
                        currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                        logsToAppend.push({text: `${actingPlayer.name}'s Stone Skin grants ${currentPlayersMonsterRef.title} a temporary shield of ${boost} health!`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                        spellEffectApplied = true;
                    }
                    break;
                case 'Fireball':
                    play('damage');
                    const fireDamage = 15;
                    const directPlayerDamage = 10;
                    if (opponentPlayersMonsterRef) {
                        const originalHp = opponentPlayersMonsterRef.hp;
                        let damageToDeal = fireDamage;
                        let message = `${actingPlayer.name}'s Fireball targets ${opponentPlayersMonsterRef.title}. `;

                        opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                        const damageTaken = originalHp - opponentPlayersMonsterRef.hp;
                        if (currentPlayerIndex === 0) newIndicators.p2MonsterDamage = damageTaken; else newIndicators.p1MonsterDamage = damageTaken;

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
                        if (currentPlayerIndex === 0) newIndicators.p2PlayerDamage = damageTaken; else newIndicators.p1PlayerDamage = damageTaken;

                        logsToAppend.push({text: `${actingPlayer.name}'s Fireball strikes ${opponentPlayer.name} directly for ${damageTaken} damage! (HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp})`, type: 'damage'});
                        spellEffectApplied = true;
                    }
                    break;
                case 'Healing Light':
                    if (currentPlayersMonsterRef) {
                        const healAmount = 20;
                        const originalHp = currentPlayersMonsterRef.hp;
                        currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + healAmount);
                        const actualHeal = currentPlayersMonsterRef.hp - originalHp;
                        if (actualHeal > 0) {
                            play('heal');
                            logsToAppend.push({text: `${actingPlayer.name}'s Healing Light restores ${actualHeal} HP to ${currentPlayersMonsterRef.title}! HP: ${originalHp} -> ${currentPlayersMonsterRef.hp}.`, type: 'heal'});
                            if (currentPlayerIndex === 0) newIndicators.p1MonsterHeal = actualHeal; else newIndicators.p2MonsterHeal = actualHeal;
                        }
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
                        logsToAppend.push({text: `${actingPlayer.name}'s Terrify targets ${opponentPlayersMonsterRef.title}!`, type: actingPlayerLogType});
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
                case 'Silence':
                    if (opponentPlayersMonsterRef) {
                        const newEffect: StatusEffect = { id: `silence-${Date.now()}`, type: 'silence', duration: 3, value: 0 }; // Duration is 2 player turns, so 3 half-turns
                        opponentPlayersMonsterRef.statusEffects = [...(opponentPlayersMonsterRef.statusEffects || []), newEffect];
                        logsToAppend.push({text: `${actingPlayer.name} silences ${opponentPlayersMonsterRef.title}! It cannot use abilities for 2 turns.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                        spellEffectApplied = true;
                    }
                    break;
                case 'Swiftness Aura':
                    if (currentPlayersMonsterRef) {
                        currentPlayersMonsterRef.melee = Math.max(0, currentPlayersMonsterRef.melee + 3);
                        currentPlayersMonsterRef.hasSwiftnessAura = true;
                        logsToAppend.push({text: `${currentPlayersMonsterRef.title} gains +3 Melee from Swiftness Aura. New Melee: ${currentPlayersMonsterRef.melee}.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                        spellEffectApplied = true;
                    }
                    break;
                case 'Chain Lightning':
                    play('damage');
                    const chainLightningDmg = 10;
                    const chainPlayerDmg = 5;
                    if (opponentPlayersMonsterRef) {
                        const originalHp = opponentPlayersMonsterRef.hp;
                        let damageToDeal = chainLightningDmg;
                        let message = `${actingPlayer.name}'s Chain Lightning strikes ${opponentPlayersMonsterRef.title}. `;
                        
                        opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - damageToDeal);
                        const damageTaken = originalHp - opponentPlayersMonsterRef.hp;
                        if (currentPlayerIndex === 0) newIndicators.p2MonsterDamage = damageTaken; else newIndicators.p1MonsterDamage = damageTaken;

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
                            if (currentPlayerIndex === 0) newIndicators.p2PlayerDamage = playerDamageTaken; else newIndicators.p1PlayerDamage = playerDamageTaken;
                            if(playerDamageTaken > 0) play('damage');

                            logsToAppend.push({text: `${opponentPlayer.name} takes ${playerDamageTaken} lightning damage! (HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp})`, type: 'damage'});
                        } else {
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                        }
                    }
                    break;
                case 'Growth Spurt':
                    if (currentPlayersMonsterRef) {
                        const originalMaxHp = currentPlayersMonsterRef.maxHp;
                        currentPlayersMonsterRef.maxHp += 10;
                        const originalHp = currentPlayersMonsterRef.hp;
                        currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + 10);
                        const actualHeal = currentPlayersMonsterRef.hp - originalHp;
                        currentPlayersMonsterRef.hasGrowthSpurt = true;
                        if (actualHeal > 0) {
                            play('heal');
                            if (currentPlayerIndex === 0) newIndicators.p1MonsterHeal = actualHeal; else newIndicators.p2MonsterHeal = actualHeal;
                        }
                        logsToAppend.push({text: `${currentPlayersMonsterRef.title}'s Growth Spurt increases Max HP to ${currentPlayersMonsterRef.maxHp} and heals ${actualHeal} HP. Current HP: ${currentPlayersMonsterRef.hp}.`, type: 'heal'});
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
                        if(damageTaken > 0) play('damage');
                        if (currentPlayerIndex === 0) newIndicators.p2MonsterDamage = damageTaken; else newIndicators.p1MonsterDamage = damageTaken;

                        message += `Takes ${damageTaken} magic damage to HP. HP: ${originalOpponentHp} -> ${opponentPlayersMonsterRef.hp}. `;
                        
                        spellEffectApplied = true;

                        // Healing part
                        if (currentPlayersMonsterRef) {
                            const lifeGained = Math.min(damageTaken, originalOpponentHp); // Heal based on actual HP lost
                            const originalOwnHp = currentPlayersMonsterRef.hp;
                            currentPlayersMonsterRef.hp = Math.min(currentPlayersMonsterRef.maxHp, currentPlayersMonsterRef.hp + lifeGained);
                            const actualHeal = currentPlayersMonsterRef.hp - originalOwnHp;
                            if (actualHeal > 0) {
                               play('heal');
                               message += `${currentPlayersMonsterRef.title} is healed for ${actualHeal} HP. HP: ${originalOwnHp} -> ${currentPlayersMonsterRef.hp}.`;
                               if(currentPlayerIndex === 0) newIndicators.p1MonsterHeal = actualHeal; else newIndicators.p2MonsterHeal = actualHeal;
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
                case 'Blinding Flash':
                    if (opponentPlayersMonsterRef) {
                        const newEffect: StatusEffect = { id: `stun-${Date.now()}`, type: 'stun', duration: 2, value: 0 }; // Stun for 1 opponent turn
                        opponentPlayersMonsterRef.statusEffects = [...(opponentPlayersMonsterRef.statusEffects || []), newEffect];
                        logsToAppend.push({text: `${actingPlayer.name}'s Blinding Flash stuns ${opponentPlayersMonsterRef.title}! It cannot act on its next turn.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                        spellEffectApplied = true;
                    }
                    break;
                case 'Might Infusion':
                    if(currentPlayersMonsterRef) {
                        currentPlayersMonsterRef.melee += 4;
                        currentPlayersMonsterRef.magic += 4;
                        currentPlayersMonsterRef.hasMightInfusion = true;
                        logsToAppend.push({text: `${actingPlayer.name}'s Might Infusion empowers ${currentPlayersMonsterRef.title}! Melee: ${currentPlayersMonsterRef.melee-4} -> ${currentPlayersMonsterRef.melee}, Magic: ${currentPlayersMonsterRef.magic-4} -> ${currentPlayersMonsterRef.magic}.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                        spellEffectApplied = true;
                    }
                    break;
                case 'Quicksand Trap':
                    if (opponentPlayersMonsterRef) {
                        const meleeReduction = 4;
                        const originalMelee = opponentPlayersMonsterRef.melee;
                        opponentPlayersMonsterRef.melee = Math.max(0, opponentPlayersMonsterRef.melee - meleeReduction);
                        
                        const newEffect: StatusEffect = { id: `stun-${Date.now()}`, type: 'stun', duration: 2, value: 0 }; // Stun for 1 opponent turn
                        opponentPlayersMonsterRef.statusEffects = [...(opponentPlayersMonsterRef.statusEffects || []), newEffect];
                        
                        logsToAppend.push({text: `${actingPlayer.name}'s Quicksand Trap reduces ${opponentPlayersMonsterRef.title}'s Melee by ${meleeReduction} and stuns it! (Melee: ${originalMelee} -> ${opponentPlayersMonsterRef.melee})`, type: 'damage'});
                        
                        if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                        spellEffectApplied = true;
                    } else {
                        logsToAppend.push({text: `${actingPlayer.name}'s Quicksand Trap has no target and dissolves harmlessly.`, type: 'system'});
                        spellEffectApplied = true;
                    }
                    break;
                case 'Frost Nova':
                    if (opponentPlayersMonsterRef) {
                        play('damage');
                        const frostDamage = 12;
                        const meleeReduction = 2;
                        const originalHp = opponentPlayersMonsterRef.hp;
                        
                        opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - frostDamage);
                        const damageTaken = originalHp - opponentPlayersMonsterRef.hp;
                        if (currentPlayerIndex === 0) newIndicators.p2MonsterDamage = damageTaken; else newIndicators.p1MonsterDamage = damageTaken;

                        const newEffect: StatusEffect = { id: `frostbite-${Date.now()}`, type: 'frostbite', duration: 3, value: meleeReduction };
                        opponentPlayersMonsterRef.statusEffects = [...(opponentPlayersMonsterRef.statusEffects || []), newEffect];
                        
                        logsToAppend.push({text: `${actingPlayer.name}'s Frost Nova hits ${opponentPlayersMonsterRef.title} for ${damageTaken} damage and applies Frostbite, reducing its Melee! (HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp})`, type: 'damage'});
                        
                        spellEffectApplied = true;

                        if (opponentPlayersMonsterRef.hp <= 0) {
                            logsToAppend.push({text: `${opponentPlayersMonsterRef.title} is shattered by the frost!`, type: 'damage'});
                            const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, statusEffects: []};
                            newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                        } else {
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                        }
                    }
                    break;
                case 'Focused Mind':
                    const cardsInDeck = actingPlayer.deck.length;
                    if (cardsInDeck > 0) {
                        const { dealtCards, remainingDeck } = dealCards(actingPlayer.deck, 1);
                        actingPlayer.deck = remainingDeck;
                        actingPlayer.hand.push(dealtCards[0]);
                        logsToAppend.push({text: `${actingPlayer.name} draws ${dealtCards[0].title}.`, type: actingPlayerLogType});
                    } else {
                        logsToAppend.push({text: `${actingPlayer.name} has no cards left to draw.`, type: 'system'});
                    }
                    if(currentPlayersMonsterRef) {
                        currentPlayersMonsterRef.magic += 2;
                        logsToAppend.push({text: `Focused Mind increases ${currentPlayersMonsterRef.title}'s Magic by 2. New Magic: ${currentPlayersMonsterRef.magic}.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                    }
                    spellEffectApplied = true;
                    break;
                case 'Mage Armor':
                    if (currentPlayersMonsterRef) {
                        const shieldValue = 20;
                        const newEffect: StatusEffect = { id: `mage-armor-${Date.now()}`, type: 'shield', duration: 99, value: shieldValue }; // Persists until broken
                        currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                        logsToAppend.push({text: `${actingPlayer.name} conjures Mage Armor on ${currentPlayersMonsterRef.title}, absorbing ${shieldValue} damage.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                        spellEffectApplied = true;
                    }
                    break;
                case 'Dark Pact':
                    const selfDamage = 5;
                    const cardsToDraw = 2;
                    const originalPlayerHp = actingPlayer.hp;
                    actingPlayer.hp = Math.max(0, actingPlayer.hp - selfDamage);
                    const selfDamageTaken = originalPlayerHp - actingPlayer.hp;
                    if (selfDamageTaken > 0) play('damage');
                    if (currentPlayerIndex === 0) newIndicators.p1PlayerDamage = selfDamageTaken; else newIndicators.p2PlayerDamage = selfDamageTaken;
                    logsToAppend.push({text: `${actingPlayer.name} makes a Dark Pact, taking ${selfDamageTaken} damage! (HP: ${originalPlayerHp} -> ${actingPlayer.hp})`, type: 'damage'});

                    const cardsInPactDeck = actingPlayer.deck.length;
                    if (cardsInPactDeck > 0) {
                        const { dealtCards, remainingDeck } = dealCards(actingPlayer.deck, cardsToDraw);
                        actingPlayer.deck = remainingDeck;
                        actingPlayer.hand.push(...dealtCards);
                        logsToAppend.push({text: `${actingPlayer.name} draws ${dealtCards.length} card(s) from the pact.`, type: actingPlayerLogType});
                    } else {
                        logsToAppend.push({text: `${actingPlayer.name} has no cards left to draw. The pact offers nothing.`, type: 'system'});
                    }
                    spellEffectApplied = true;
                    break;
                case 'Empower Weapon':
                    if(currentPlayersMonsterRef) {
                        const newEffect: StatusEffect = { id: `empower-${Date.now()}`, type: 'empower', duration: 2, value: 2 }; // Duration of 2 = lasts until next turn's attack phase
                        currentPlayersMonsterRef.statusEffects = [...(currentPlayersMonsterRef.statusEffects || []), newEffect];
                        logsToAppend.push({text: `${actingPlayer.name}'s Empower Weapon causes ${currentPlayersMonsterRef.title}'s weapon to glow with power! Its next melee attack will deal double damage.`, type: 'info'});
                        if (currentPlayerIndex === 0) newActiveMonsterP1 = currentPlayersMonsterRef; else newActiveMonsterP2 = currentPlayersMonsterRef;
                        spellEffectApplied = true;
                    } else {
                        logsToAppend.push({text: `${actingPlayer.name}'s Empower Weapon fizzles with no active monster to target.`, type: 'system'});
                        spellEffectApplied = true;
                    }
                    break;
                case 'Teleport Strike':
                    play('damage');
                    const teleportDamage = 10;
                    if (opponentPlayersMonsterRef) {
                        const originalHp = opponentPlayersMonsterRef.hp;
                        opponentPlayersMonsterRef.hp = Math.max(0, opponentPlayersMonsterRef.hp - teleportDamage);
                        const damageTaken = originalHp - opponentPlayersMonsterRef.hp;
                        if (currentPlayerIndex === 0) newIndicators.p2MonsterDamage = damageTaken; else newIndicators.p1MonsterDamage = damageTaken;
                        
                        logsToAppend.push({text: `${actingPlayer.name}'s Teleport Strike hits ${opponentPlayersMonsterRef.title} for ${damageTaken} damage, ignoring defenses! (HP: ${originalHp} -> ${opponentPlayersMonsterRef.hp})`, type: 'damage'});
                        
                        if (opponentPlayersMonsterRef.hp <= 0) {
                            logsToAppend.push({text: `${opponentPlayersMonsterRef.title} is defeated by the Teleport Strike!`, type: 'damage'});
                            const defeatedMonsterCard = {...opponentPlayersMonsterRef, hp:0, statusEffects: []};
                            newPlayers[opponentPlayerIndex].discardPile.push(defeatedMonsterCard);
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = undefined; else newActiveMonsterP1 = undefined;
                        } else {
                            if (currentPlayerIndex === 0) newActiveMonsterP2 = opponentPlayersMonsterRef; else newActiveMonsterP1 = opponentPlayersMonsterRef;
                        }
                    } else {
                        const originalPlayerHp = newPlayers[opponentPlayerIndex].hp;
                        newPlayers[opponentPlayerIndex].hp = Math.max(0, newPlayers[opponentPlayerIndex].hp - teleportDamage);
                        const damageTaken = originalPlayerHp - newPlayers[opponentPlayerIndex].hp;
                        if (currentPlayerIndex === 0) newIndicators.p2PlayerDamage = damageTaken; else newIndicators.p1PlayerDamage = damageTaken;
                        if(damageTaken > 0) play('damage');

                        logsToAppend.push({text: `${actingPlayer.name}'s Teleport Strike hits ${opponentPlayer.name} directly for ${damageTaken} damage! (HP: ${originalPlayerHp} -> ${newPlayers[opponentPlayerIndex].hp})`, type: 'damage'});
                    }
                    spellEffectApplied = true;
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

            logsToAppend.push({text: `${actingPlayer.name} has cast a spell. Choose your next action or end turn.`, type: actingPlayerLogType});
            
            const finalState: GameState = {
                ...prev,
                players: newPlayers,
                activeMonsterP1: newActiveMonsterP1,
                activeMonsterP2: newActiveMonsterP2,
                gameLogMessages: [...(gameLogMessages || []), ...logsToAppend.map(log => ({...log, id: `log-${logIdCounter++}`}))],
                isProcessingAction: false, 
                indicators: newIndicators,
                gamePhase: 'player_action_phase',
            };

            const currentStateAfterSpell = finalState;
            let immediateTurnEnd = false;
            if (currentStateAfterSpell) {
                if (currentStateAfterSpell.players[0].hp <= 0 || currentStateAfterSpell.players[1].hp <= 0) {
                    immediateTurnEnd = true;
                }
            }
            
            if (immediateTurnEnd) {
                finalState.gamePhase = 'combat_phase';
                setTimeout(() => processTurnEnd(), 500); 
            }

            return finalState;

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
        logAndSetGameState(prev => prev ? { ...prev, indicators: initialIndicatorState } : null);
    }, 2000); // Clear indicators after 2 seconds
};


  const handleAttack = () => {
    try {
        play('attack');
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

        if (attackerPlayer.monsterJustPlayed) {
            toast({ title: "Summoning Sickness", description: `${attackerMonster.title} cannot attack on the turn it was played.`, variant: "destructive" });
            return;
        }
        
        if (attackerMonster.statusEffects?.some(e => e.type === 'stun')) {
            toast({ title: "Cannot Attack", description: `${attackerMonster.title} is stunned and cannot attack this turn.`, variant: "destructive" });
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

            let { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2, gameLogMessages } = freshState;
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
            let finalIndicators: IndicatorState = { ...initialIndicatorState };

            const applyDamage = (targetMonster: MonsterCardData, damage: number, damageType: 'melee' | 'magic'): { updatedMonster: MonsterCardData; log: {text: string, type: LogEntryType}[]; damageDealt: number; } => {
                let logs: {text: string, type: LogEntryType}[] = [];
                let remainingDamage = damage;
                let totalDamageDealt = 0;
                let monster = { ...targetMonster, statusEffects: [...(targetMonster.statusEffects || [])] };
                const originalHp = monster.hp;

                // Ethereal check first
                const etherealIndex = monster.statusEffects.findIndex(e => e.type === 'ethereal');
                if (etherealIndex > -1) {
                    const reductionPercent = monster.statusEffects[etherealIndex].value / 100;
                    const reducedDamage = Math.ceil(remainingDamage * (1 - reductionPercent));
                    logs.push({ text: `${monster.title} is ethereal, reducing damage by 50%!`, type: 'info' });
                    remainingDamage = reducedDamage;
                }

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
                            logsToAppend.push({ text: `The shield has ${shield.value} health remaining.`, type: 'info' });
                        }
                    }
                }
                
                if (remainingDamage > 0) {
                    monster.hp = Math.max(0, monster.hp - remainingDamage);
                }

                totalDamageDealt = originalHp - monster.hp;

                if (totalDamageDealt > 0) {
                    play('damage');
                    logs.push({ text: `${monster.title} takes ${totalDamageDealt} ${damageType} damage. (HP: ${originalHp} -> ${monster.hp})`, type: 'damage' });
                } else if (damage > 0) {
                    logs.push({ text: `${monster.title} takes no damage.`, type: 'info' });
                }
                return { updatedMonster: monster, log: logs, damageDealt: totalDamageDealt };
            };

            const getEffectiveMelee = (monster: MonsterCardData): number => {
                const frostbiteEffect = monster.statusEffects?.find(e => e.type === 'frostbite');
                const reduction = frostbiteEffect ? frostbiteEffect.value : 0;
                return Math.max(0, monster.melee - reduction);
            };

            logsToAppend.push({ text: `${players[currentPlayerIndex].name}'s ${currentAttackerMonster.title} attacks!`, type: attackerLogType});

            if (currentDefenderMonster && currentDefenderMonster.hp > 0) {
                logsToAppend.push({ text: `${currentAttackerMonster.title} clashes with ${currentDefenderMonster.title}!`, type: 'system' });
                const effectiveAttackerMelee = getEffectiveMelee(currentAttackerMonster);
                let isMagicAttack = currentAttackerMonster.magic > effectiveAttackerMelee;
                let attackValue = isMagicAttack ? currentAttackerMonster.magic : effectiveAttackerMelee;
                const attackType = isMagicAttack ? "magic" : "melee";

                // Check for Empower Weapon effect
                const empowerIndex = currentAttackerMonster.statusEffects?.findIndex(e => e.type === 'empower') ?? -1;
                if (!isMagicAttack && empowerIndex > -1) {
                    const empowerEffect = currentAttackerMonster.statusEffects![empowerIndex];
                    attackValue *= empowerEffect.value;
                    logsToAppend.push({ text: `${currentAttackerMonster.title}'s Empowered attack deals double damage!`, type: 'info' });
                    // Remove the effect after use
                    currentAttackerMonster.statusEffects!.splice(empowerIndex, 1);
                }
                
                logsToAppend.push({ text: `Attack is ${attackType}-based with a power of ${attackValue}.`, type: 'info'});
                
                const defenderHpBefore = currentDefenderMonster.hp;
                const defenderResult = applyDamage(currentDefenderMonster, attackValue, attackType);
                currentDefenderMonster = defenderResult.updatedMonster;
                logsToAppend.push(...defenderResult.log);
                
                if (defenderResult.damageDealt > 0) {
                    if (defenderPlayerIndex === 0) finalIndicators.p1MonsterDamage = defenderResult.damageDealt;
                    else finalIndicators.p2MonsterDamage = defenderResult.damageDealt;
                }

                if (currentDefenderMonster.hp <= 0) {
                    logsToAppend.push({ text: `${currentDefenderMonster.title} is defeated!`, type: 'damage' });
                    // Trample damage calculation
                    const overkillDamage = Math.max(0, attackValue - defenderHpBefore); // Use original HP before any reductions
                    if (overkillDamage > 0) {
                        const originalPlayerHp = newPlayers[defenderPlayerIndex].hp;
                        newPlayers[defenderPlayerIndex].hp = Math.max(0, originalPlayerHp - overkillDamage);
                        const playerDamageTaken = originalPlayerHp - newPlayers[defenderPlayerIndex].hp;
                        if (playerDamageTaken > 0) {
                            play('damage');
                            logsToAppend.push({ text: `Overkill! ${players[defenderPlayerIndex].name} takes ${playerDamageTaken} trample damage! (HP: ${originalPlayerHp} -> ${newPlayers[defenderPlayerIndex].hp})`, type: 'damage' });
                            if(defenderPlayerIndex === 0) finalIndicators.p1PlayerDamage = playerDamageTaken; else finalIndicators.p2PlayerDamage = playerDamageTaken;
                        }
                    }

                    const defeatedCard = { ...currentDefenderMonster, hp: 0, statusEffects: [] };
                    newPlayers[defenderPlayerIndex].discardPile.push(defeatedCard);
                    currentDefenderMonster = undefined;
                }

                if (currentDefenderMonster && currentDefenderMonster.hp > 0 && !currentDefenderMonster.statusEffects?.some(e => e.type === 'stun')) {
                    logsToAppend.push({ text: `${currentDefenderMonster.title} counter-attacks!`, type: defenderLogType });
                    const effectiveDefenderMelee = getEffectiveMelee(currentDefenderMonster);
                    const isCounterMagic = currentDefenderMonster.magic > effectiveDefenderMelee;
                    const counterAttackValue = isCounterMagic ? currentDefenderMonster.magic : effectiveDefenderMelee;
                    const counterAttackType = isCounterMagic ? "magic" : "melee";
                    logsToAppend.push({ text: `Counter-attack is ${counterAttackType}-based with a power of ${counterAttackValue}.`, type: 'info' });
                    
                    const attackerHpBefore = currentAttackerMonster.hp;
                    const attackerResult = applyDamage(currentAttackerMonster, counterAttackValue, counterAttackType);
                    currentAttackerMonster = attackerResult.updatedMonster;
                    logsToAppend.push(...attackerResult.log);

                    if(attackerResult.damageDealt > 0) {
                        if (currentPlayerIndex === 0) finalIndicators.p1MonsterDamage = attackerResult.damageDealt;
                        else finalIndicators.p2MonsterDamage = attackerResult.damageDealt;
                    }

                    if (currentAttackerMonster.hp <= 0) {
                        logsToAppend.push({ text: `${currentAttackerMonster.title} is defeated in the counter-attack!`, type: 'damage' });
                         const overkillDamage = Math.max(0, counterAttackValue - attackerHpBefore);
                        if (overkillDamage > 0) {
                             const originalPlayerHp = newPlayers[currentPlayerIndex].hp;
                             newPlayers[currentPlayerIndex].hp = Math.max(0, originalPlayerHp - overkillDamage);
                             const playerDamageTaken = originalPlayerHp - newPlayers[currentPlayerIndex].hp;
                             if (playerDamageTaken > 0) {
                                play('damage');
                                logsToAppend.push({ text: `Overkill! ${players[currentPlayerIndex].name} takes ${playerDamageTaken} trample damage! (HP: ${originalPlayerHp} -> ${newPlayers[currentPlayerIndex].hp})`, type: 'damage' });
                                if(currentPlayerIndex === 0) finalIndicators.p1PlayerDamage = playerDamageTaken;
                                else finalIndicators.p2PlayerDamage = playerDamageTaken;
                             }
                        }
                        const defeatedCard = { ...currentAttackerMonster, hp: 0, statusEffects: [] };
                        newPlayers[currentPlayerIndex].discardPile.push(defeatedCard);
                        currentAttackerMonster = undefined!;
                    }
                } else if (currentDefenderMonster?.statusEffects?.some(e => e.type === 'stun')) {
                    logsToAppend.push({ text: `${currentDefenderMonster.title} is stunned and cannot counter-attack!`, type: 'info' });
                }
            } else {
                const effectiveAttackerMelee = getEffectiveMelee(currentAttackerMonster);
                let isMagicAttack = currentAttackerMonster.magic > effectiveAttackerMelee;
                let attackValue = isMagicAttack ? currentAttackerMonster.magic : effectiveAttackerMelee;
                const attackType = isMagicAttack ? "magic" : "melee";

                 // Check for Empower Weapon effect
                 const empowerIndex = currentAttackerMonster.statusEffects?.findIndex(e => e.type === 'empower') ?? -1;
                 if (!isMagicAttack && empowerIndex > -1) {
                     const empowerEffect = currentAttackerMonster.statusEffects![empowerIndex];
                     attackValue *= empowerEffect.value;
                     logsToAppend.push({ text: `${currentAttackerMonster.title}'s Empowered attack deals double damage!`, type: 'info' });
                     // Remove the effect after use
                     currentAttackerMonster.statusEffects!.splice(empowerIndex, 1);
                 }
                
                const originalDefenderHp = newPlayers[defenderPlayerIndex].hp;

                newPlayers[defenderPlayerIndex].hp = Math.max(0, newPlayers[defenderPlayerIndex].hp - attackValue);
                const playerDamageTaken = originalDefenderHp - newPlayers[defenderPlayerIndex].hp;

                if (playerDamageTaken > 0) {
                    play('damage');
                    logsToAppend.push({ text: `${players[defenderPlayerIndex].name}'s HP is targeted directly for ${playerDamageTaken} ${attackType} damage! (HP: ${originalDefenderHp} -> ${newPlayers[defenderPlayerIndex].hp})`, type: 'damage' });
                    if(defenderPlayerIndex === 0) finalIndicators.p1PlayerDamage = playerDamageTaken; else finalIndicators.p2PlayerDamage = playerDamageTaken;
                }
            }

            const finalActiveMonsterP1 = currentPlayerIndex === 0 ? currentAttackerMonster : currentDefenderMonster;
            const finalActiveMonsterP2 = currentPlayerIndex === 1 ? currentAttackerMonster : currentDefenderMonster;
            
            logsToAppend.push({ text: `Combat concludes. Turn ends.`, type: 'system' });

            logAndSetGameState(prev => ({
                ...prev!,
                players: newPlayers,
                activeMonsterP1: finalActiveMonsterP1,
                activeMonsterP2: finalActiveMonsterP2,
                gameLogMessages: [...(gameLogMessages || []), ...logsToAppend.map(log => ({...log, id: `log-${logIdCounter++}`}))],
                gamePhase: 'combat_phase',
                indicators: finalIndicators,
            }));
            
            // Automatically end turn after combat
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
    play('card-play');
    logAndSetGameState(prev => {
      if (!prev || prev.isProcessingAction) return prev;
      const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = prev;

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

      newPlayers[currentPlayerIndex] = { ...player, hand: newPlayerHand, hasMulliganed: true, monsterJustPlayed: true }; // Swapping also counts for summoning sickness
      logsToAppend.push({text: `${player.name} summons ${selectedMonsterFromHand.title} to replace it!`, type: playerLogType});
      logsToAppend.push({text: `${selectedMonsterFromHand.title} cannot act this turn due to summoning sickness.`, type: 'info'});

      const updatedState = {
        ...prev,
        players: newPlayers,
        [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: selectedMonsterFromHand,
        gameLogMessages: [...(prev.gameLogMessages || []), ...logsToAppend.map(l => ({...l, id: `log-${logIdCounter++}`}))],
        gamePhase: 'player_action_phase' as GamePhase,
        isProcessingAction: false,
      };

      return updatedState;
    });
  };

  const handleInitiateSwap = () => {
    play('click');
    const currentState = gameStateRef.current;
    if (!currentState || currentState.isProcessingAction) return;

    const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = currentState;
    const opponentActiveMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;
    const player = players[currentPlayerIndex];

    if (player.turnCount === 0 && !opponentActiveMonster) {
      toast({ title: "First Turn Rule", description: "You cannot swap monsters on the first turn of the game.", variant: "destructive"});
      return;
    }

    if (player.monsterJustPlayed) {
      toast({ title: "Summoning Sickness", description: "A monster that was just played cannot be swapped out in the same turn.", variant: "destructive" });
      return;
    }

    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';

    logAndSetGameState(prev => {
      if (!prev) return prev;
      appendLog(`${prev.players[prev.currentPlayerIndex].name} is considering a monster swap. Select a monster from your hand.`, playerLogType);
      const newPlayers = [...prev.players] as [PlayerData, PlayerData];
      newPlayers[prev.currentPlayerIndex] = {...newPlayers[prev.currentPlayerIndex], hasMulliganed: true };
      return { ...prev, gamePhase: 'selecting_swap_monster_phase', players: newPlayers };
    });
  };

  const handleEndTurn = () => {
    play('click');
    const currentBoardGameState = gameStateRef.current;
    if (!currentBoardGameState || currentBoardGameState.isProcessingAction) return;
    const player = currentBoardGameState.players[currentBoardGameState.currentPlayerIndex];
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';

    logAndSetGameState(prev => {
      if(!prev) return null;
      const newPlayers = [...prev.players] as [PlayerData, PlayerData];
      newPlayers[prev.currentPlayerIndex] = { ...newPlayers[prev.currentPlayerIndex], hasMulliganed: true };
      return { ...prev, isProcessingAction: true, gamePhase: 'turn_transition', players: newPlayers };
    });
    appendLog(`${player.name} ends their turn.`, playerLogType);
    setTimeout(() => {
      processTurnEnd();
    }, 500); // Short delay
  };

  const handleInitiateMulligan = () => {
    play('click');
    const player = gameStateRef.current?.players[gameStateRef.current.currentPlayerIndex];
    if (!player) return;
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';
    logAndSetGameState(prev => {
      if (!prev || prev.isProcessingAction) return prev;
      appendLog(`${prev.players[prev.currentPlayerIndex].name} is considering a mulligan. Select ${MULLIGAN_CARD_COUNT} cards to return.`, playerLogType);
      return { ...prev, gamePhase: 'mulligan_phase' };
    });
  };

  const handleCancelAction = () => {
    play('click');
    const player = gameStateRef.current?.players[gameStateRef.current.currentPlayerIndex];
    if (!player) return;
    const playerLogType = player.id === 'p1' ? 'player1' : 'player2';
    logAndSetGameState(prev => {
      if (!prev) return prev;
      if (prev.gamePhase === 'mulligan_phase') {
        appendLog(`Mulligan canceled. Choose an action.`, playerLogType);
        setSelectedForMulligan([]);
      } else if (prev.gamePhase === 'selecting_swap_monster_phase') {
        appendLog(`Swap canceled. Choose an action.`, playerLogType);
      }
      return { ...prev, gamePhase: 'player_action_phase' };
    });
  };

  const handleConfirmMulligan = () => {
    play('click');
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
    play('click');
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

  const { players, currentPlayerIndex, gamePhase, activeMonsterP1, activeMonsterP2, winner, gameLogMessages, isProcessingAction, indicators } = gameState;
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
      <audio ref={backgroundMusicRef} src="/audio/background-music.mp3" loop />
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 md:gap-4 p-2 md:p-3">
        <div className="flex justify-start">
          <PlayerStatusDisplay player={players[0]} isCurrentPlayer={currentPlayerIndex === 0} damage={indicators.p1PlayerDamage} healing={indicators.p1PlayerHeal} />
        </div>
        <div className="flex justify-center items-center self-center pt-2">
          <Layers3 className="w-10 h-10 text-accent animate-pulse" />
        </div>
        <div className="flex justify-end">
          <PlayerStatusDisplay player={players[1]} isCurrentPlayer={currentPlayerIndex === 1} isOpponent={true} damage={indicators.p2PlayerDamage} healing={indicators.p2PlayerHeal} />
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
                opponentActiveMonster={activeMonsterP2}
                isMulliganPhase={gamePhase === 'mulligan_phase' && currentPlayerIndex === 0}
                selectedCardIds={selectedForMulligan}
                player={players[0]}
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
          indicators={indicators}
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
                opponentActiveMonster={activeMonsterP1}
                isMulliganPhase={gamePhase === 'mulligan_phase' && currentPlayerIndex === 1}
                selectedCardIds={selectedForMulligan}
                player={players[1]}
            />
        </div>
      </div>

      {gamePhase !== 'coin_flip_animation' && gamePhase !== 'loading_art' && gamePhase !== 'game_over_phase' && !isProcessingAction && gamePhase !== 'turn_transition' && (
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
            onCancelAction={handleCancelAction}
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
        <div className="absolute bottom-2 left-2 flex gap-2">
            <Button
                onClick={handleRestartGame}
                variant="outline"
                size="sm"
                className="opacity-70 hover:opacity-100"
                title="Restart Game"
            >
                <Trash2 className="mr-2 h-4 w-4" /> Restart
            </Button>
            <SoundToggle />
        </div>
    </div>
  );
}
