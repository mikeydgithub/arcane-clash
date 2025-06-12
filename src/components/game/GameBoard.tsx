
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardData, GameState, PlayerData, GamePhase, MonsterCardData, SpellCardData } from '@/types';
import { generateMonsterCards, generateSpellCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { PlayerActions } from './PlayerActions'; // New component
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
  const descriptionQueueRef = useRef<CardData[]>([]);
  const isFetchingDescriptionRef = useRef(false);

  const initializeGame = useCallback(async () => {
    hasInitialized.current = true;
    setGameState(prev => ({...(prev || {} as GameState), gamePhase: 'loading_art', gameLogMessages: ["Initializing Arcane Clash... Preparing cards..."]}));

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
        setGameState(prev => ({...(prev || {} as GameState), gamePhase: 'initial', gameLogMessages: ["Error: Card data missing. Pregenerate cards."]}));
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
      hand: p1InitialHand.map(c => ({ ...c, description: undefined, isLoadingDescription: false })),
      deck: p1DeckAfterDeal.map(c => ({ ...c, description: undefined, isLoadingDescription: false })),
      discardPile: [],
      avatarUrl: 'https://placehold.co/64x64.png?text=P1', 
    };
    const initialPlayer2: PlayerData = {
      id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP,
      hand: p2InitialHand.map(c => ({ ...c, description: undefined, isLoadingDescription: false })),
      deck: p2DeckAfterDeal.map(c => ({ ...c, description: undefined, isLoadingDescription: false })),
      discardPile: [],
      avatarUrl: 'https://placehold.co/64x64.png?text=P2', 
    };
    
    setGameState({
      players: [initialPlayer1, initialPlayer2],
      currentPlayerIndex: firstPlayerIndex,
      gamePhase: 'coin_flip_animation', 
      activeMonsterP1: undefined,
      activeMonsterP2: undefined,
      winner: undefined,
      gameLogMessages: [`Game cards ready. ${firstPlayerIndex === 0 ? initialPlayer1.name : initialPlayer2.name} will be determined by coin flip. Flipping coin...`],
      isProcessingAction: false,
    });
  }, [toast]); 

  const handleCoinFlipAnimationComplete = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const firstPlayer = prev.players[prev.currentPlayerIndex];
      return {
        ...prev,
        gamePhase: 'player_action_phase',
        gameLogMessages: [
          `${firstPlayer.name} wins the toss and will go first!`,
          `${firstPlayer.name}, it's your turn. Choose an action.`
        ],
        isProcessingAction: false,
      };
    });
  }, []);

  const fetchAndSetCardDescription = useCallback(async (cardToFetch: CardData, playerIndex: number) => {
    if (cardToFetch.description || cardToFetch.isLoadingDescription) return;

    setGameState(prev => {
        if (!prev) return null;
        const updateCardInSource = (source: CardData[], cardId: string, updates: Partial<CardData>) => 
            source.map(c => c.id === cardId ? { ...c, ...updates } : c);

        const newPlayers = prev.players.map((p, idx) => {
            if (idx === playerIndex) {
                return {
                    ...p,
                    hand: updateCardInSource(p.hand, cardToFetch.id, { isLoadingDescription: true }),
                    deck: updateCardInSource(p.deck, cardToFetch.id, { isLoadingDescription: true }),
                };
            }
            return p;
        }) as [PlayerData, PlayerData];
        return { ...prev, players: newPlayers };
    });

    try {
        const descResult = await generateCardDescription({ cardTitle: cardToFetch.title, cardType: cardToFetch.cardType });
        setGameState(prev => {
            if (!prev) return null;
            const updateCardInSource = (source: CardData[], cardId: string, updates: Partial<CardData>) => 
                source.map(c => c.id === cardId ? { ...c, ...updates } : c);
            
            const newPlayers = prev.players.map((p, idx) => {
                 if (idx === playerIndex) {
                    return {
                        ...p,
                        hand: updateCardInSource(p.hand, cardToFetch.id, { description: descResult.description, isLoadingDescription: false }),
                        deck: updateCardInSource(p.deck, cardToFetch.id, { description: descResult.description, isLoadingDescription: false }),
                    };
                }
                return p;
            }) as [PlayerData, PlayerData];
            return { ...prev, players: newPlayers };
        });
    } catch (error) {
        console.error(`Failed to generate description for ${cardToFetch.title}:`, error);
        toast({ title: "AI Error", description: `Could not fetch description for ${cardToFetch.title}. Using default.`, variant: "destructive" });
        setGameState(prev => {
            if (!prev) return null;
            const defaultDesc = cardToFetch.cardType === "Monster" ? "A mysterious creature." : "A potent spell.";
            const updateCardInSource = (source: CardData[], cardId: string, updates: Partial<CardData>) =>
                source.map(c => c.id === cardId ? { ...c, ...updates } : c);

            const newPlayers = prev.players.map((p, idx) => {
                if (idx === playerIndex) {
                    return {
                        ...p,
                        hand: updateCardInSource(p.hand, cardToFetch.id, { description: defaultDesc, isLoadingDescription: false }),
                        deck: updateCardInSource(p.deck, cardToFetch.id, { description: defaultDesc, isLoadingDescription: false }),
                    };
                }
                return p;
            }) as [PlayerData, PlayerData];
            return { ...prev, players: newPlayers };
        });
    }
  }, [toast]);

  useEffect(() => {
    if (!gameState || hasInitialized.current) return;
    const init = async () => {
        await initializeGame();
    };
    init();
  }, [gameState, initializeGame]);
  
  useEffect(() => {
    if (!gameState || isFetchingDescriptionRef.current || descriptionQueueRef.current.length === 0) return;

    const processQueue = async () => {
        if (descriptionQueueRef.current.length > 0) {
            isFetchingDescriptionRef.current = true;
            const { card, playerIndex } = descriptionQueueRef.current.shift() as { card: CardData, playerIndex: number };
            if (card && !card.description && !card.isLoadingDescription) {
                 await fetchAndSetCardDescription(card, playerIndex);
            }
            isFetchingDescriptionRef.current = false;
            if (descriptionQueueRef.current.length > 0) {
                 setTimeout(processQueue, 100); // Small delay before processing next in queue
            }
        }
    };
    processQueue();
  }, [gameState, fetchAndSetCardDescription]);


  useEffect(() => {
    if (!gameState) return;
    gameState.players.forEach((player, playerIndex) => {
        player.hand.forEach(card => {
            if (!card.description && !card.isLoadingDescription) {
                const alreadyQueued = descriptionQueueRef.current.some(item => item.card.id === card.id);
                if (!alreadyQueued) {
                    descriptionQueueRef.current.push({ card, playerIndex });
                }
            }
        });
    });
    // Trigger queue processing if not already running
    if (!isFetchingDescriptionRef.current && descriptionQueueRef.current.length > 0) {
        const processQueue = async () => {
            if (descriptionQueueRef.current.length > 0 && !isFetchingDescriptionRef.current) {
                isFetchingDescriptionRef.current = true;
                const { card, playerIndex } = descriptionQueueRef.current.shift() as { card: CardData, playerIndex: number };
                 if (card && !card.description && !card.isLoadingDescription) {
                    await fetchAndSetCardDescription(card, playerIndex);
                }
                isFetchingDescriptionRef.current = false;
                if (descriptionQueueRef.current.length > 0) {
                    setTimeout(processQueue, 100);
                }
            }
        };
        processQueue();
    }
  }, [gameState?.players, fetchAndSetCardDescription]);


  const appendLog = (message: string) => {
    setGameState(prev => {
      if (!prev) return null;
      return { ...prev, gameLogMessages: [...prev.gameLogMessages, message] };
    });
  };

  const processTurnEnd = () => {
    setGameState(prev => {
      if (!prev) return null;
      let { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2, gameLogMessages } = prev;
      const actingPlayer = players[currentPlayerIndex];
      const opponentPlayerIndex = 1 - currentPlayerIndex;
      const opponentPlayer = players[opponentPlayerIndex];

      let newLogMessages = [...gameLogMessages];
      let actingPlayerHand = [...actingPlayer.hand];
      let actingPlayerDeck = [...actingPlayer.deck];

      // Card Draw Logic (simplified: always try to draw if hand < max, after any action that might free up hand space)
      if (actingPlayerHand.length < CARDS_IN_HAND && actingPlayerDeck.length > 0) {
        const { dealtCards, remainingDeck } = dealCards(actingPlayerDeck, 1);
        const drawnCard = { ...dealtCards[0], description: undefined, isLoadingDescription: false };
        actingPlayerHand.push(drawnCard);
        actingPlayerDeck = remainingDeck;
        newLogMessages.push(`${actingPlayer.name} draws ${drawnCard.title}.`);
        // Add to description queue
        const alreadyQueued = descriptionQueueRef.current.some(item => item.card.id === drawnCard.id);
        if (!alreadyQueued && !drawnCard.description && !drawnCard.isLoadingDescription) {
            descriptionQueueRef.current.push({ card: drawnCard, playerIndex: currentPlayerIndex });
        }
      } else if (actingPlayerHand.length < CARDS_IN_HAND) {
        newLogMessages.push(`${actingPlayer.name} has no cards left in their deck to draw.`);
      }
      
      const updatedPlayers = [...players] as [PlayerData, PlayerData];
      updatedPlayers[currentPlayerIndex] = { ...actingPlayer, hand: actingPlayerHand, deck: actingPlayerDeck };

      // Check for game over
      if (players[0].hp <= 0 && players[1].hp <= 0) {
        newLogMessages.push("It's a draw! Both players are defeated.");
        return { ...prev, players: updatedPlayers, winner: undefined, gamePhase: 'game_over_phase', gameLogMessages: newLogMessages, isProcessingAction: false };
      } else if (players[0].hp <= 0) {
        newLogMessages.push(`${players[1].name} wins! ${players[0].name} is defeated.`);
        return { ...prev, players: updatedPlayers, winner: players[1], gamePhase: 'game_over_phase', gameLogMessages: newLogMessages, isProcessingAction: false };
      } else if (players[1].hp <= 0) {
        newLogMessages.push(`${players[0].name} wins! ${players[1].name} is defeated.`);
        return { ...prev, players: updatedPlayers, winner: players[0], gamePhase: 'game_over_phase', gameLogMessages: newLogMessages, isProcessingAction: false };
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
    if (!gameState || gameState.isProcessingAction) return;
    const { players, currentPlayerIndex } = gameState;
    const player = players[currentPlayerIndex];

    setGameState(prev => ({...prev!, isProcessingAction: true}));
    appendLog(`${player.name} summons ${card.title} to the arena!`);

    const newHand = player.hand.filter(c => c.id !== card.id);
    const updatedPlayer = { ...player, hand: newHand };
    const newPlayers = [...players] as [PlayerData, PlayerData];
    newPlayers[currentPlayerIndex] = updatedPlayer;

    setGameState(prev => ({
      ...prev!,
      players: newPlayers,
      [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: card,
      gamePhase: 'turn_resolution_phase', // Proceed to end turn
    }));
    setTimeout(() => processTurnEnd(), 500);
  };

  const handlePlaySpellFromHand = (card: SpellCardData) => {
    if (!gameState || gameState.isProcessingAction) return;
    const { players, currentPlayerIndex } = gameState;
    const player = players[currentPlayerIndex];

    setGameState(prev => ({...prev!, isProcessingAction: true}));
    appendLog(`${player.name} casts ${card.title}! Effect: ${card.description || "A mysterious enchantment unfolds."}`);
    
    // TODO: Implement actual spell effects here. For now, just log and discard.

    const newHand = player.hand.filter(c => c.id !== card.id);
    const newDiscardPile = [...player.discardPile, card];
    const updatedPlayer = { ...player, hand: newHand, discardPile: newDiscardPile };
    const newPlayers = [...players] as [PlayerData, PlayerData];
    newPlayers[currentPlayerIndex] = updatedPlayer;

    setGameState(prev => ({
      ...prev!,
      players: newPlayers,
      gamePhase: 'spell_effect_phase', // Short phase for spell
    }));
    setTimeout(() => {
        setGameState(g => ({...g!, gamePhase: 'turn_resolution_phase'}));
        setTimeout(() => processTurnEnd(), 500);
    }, 1000); // Animation time for spell
  };

  const handleMonsterAttack = () => {
    if (!gameState || gameState.isProcessingAction) return;
    const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = gameState;
    const attackerPlayer = players[currentPlayerIndex];
    const defenderPlayerIndex = 1 - currentPlayerIndex;
    const defenderPlayer = players[defenderPlayerIndex];
    
    let currentAttackerMonster = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;
    let currentDefenderMonster = currentPlayerIndex === 0 ? activeMonsterP2 : activeMonsterP1;

    if (!currentAttackerMonster) {
        toast({ title: "No active monster", description: "You need an active monster to attack.", variant: "destructive" });
        return;
    }
    setGameState(prev => ({...prev!, isProcessingAction: true, gamePhase: 'combat_phase'}));

    let p1Data = { ...players[0] };
    let p2Data = { ...players[1] };
    let attacker = { ...currentAttackerMonster } as MonsterCardData;
    let defender = currentDefenderMonster ? { ...currentDefenderMonster } as MonsterCardData : undefined;
    let newLogMessages: string[] = [...gameState.gameLogMessages];

    newLogMessages.push(`${attackerPlayer.name}'s ${attacker.title} attacks!`);

    if (defender) { // Monster vs Monster
        newLogMessages.push(`${attacker.title} clashes with ${defender.title}!`);
        // Attacker deals damage
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

        // Defender counter-attacks if still alive
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
    } else { // Monster vs Player
        newLogMessages.push(`${attacker.title} attacks ${defenderPlayer.name} directly!`);
        const damage = attacker.melee > 0 ? attacker.melee : attacker.magic;
        if (currentPlayerIndex === 0) { // P1 attacking P2
            p2Data.hp = Math.max(0, p2Data.hp - damage);
            newLogMessages.push(`${p2Data.name} takes ${damage} direct damage. New HP: ${p2Data.hp}`);
        } else { // P2 attacking P1
            p1Data.hp = Math.max(0, p1Data.hp - damage);
            newLogMessages.push(`${p1Data.name} takes ${damage} direct damage. New HP: ${p1Data.hp}`);
        }
    }

    let nextActiveMonsterP1 = currentPlayerIndex === 0 ? (attacker.hp > 0 ? attacker : undefined) : activeMonsterP1;
    let nextActiveMonsterP2 = currentPlayerIndex === 1 ? (attacker.hp > 0 ? attacker : undefined) : activeMonsterP2;

    if (defender && defender.hp <= 0) {
        newLogMessages.push(`${defender.title} is defeated!`);
        if (currentPlayerIndex === 0) { // P1 attacked, P2's monster defeated
            p2Data.discardPile.push({...currentDefenderMonster!, hp:0, shield:0, magicShield:0});
            nextActiveMonsterP2 = undefined;
        } else { // P2 attacked, P1's monster defeated
            p1Data.discardPile.push({...currentDefenderMonster!, hp:0, shield:0, magicShield:0});
            nextActiveMonsterP1 = undefined;
        }
    } else if (defender) {
         if (currentPlayerIndex === 0) nextActiveMonsterP2 = defender; else nextActiveMonsterP1 = defender;
    }

    if (attacker.hp <= 0) {
        newLogMessages.push(`${attacker.title} is defeated!`);
         if (currentPlayerIndex === 0) {
            p1Data.discardPile.push({...currentAttackerMonster!, hp:0, shield:0, magicShield:0});
            nextActiveMonsterP1 = undefined;
        } else {
            p2Data.discardPile.push({...currentAttackerMonster!, hp:0, shield:0, magicShield:0});
            nextActiveMonsterP2 = undefined;
        }
    }
    
    const finalPlayers = [p1Data, p2Data] as [PlayerData, PlayerData];

    setGameState(prev => ({
        ...prev!,
        players: finalPlayers,
        activeMonsterP1: nextActiveMonsterP1,
        activeMonsterP2: nextActiveMonsterP2,
        gameLogMessages: newLogMessages,
        // gamePhase will be set by processTurnEnd after delay
    }));
    
    setTimeout(() => {
        setGameState(g => ({...g!, gamePhase: 'turn_resolution_phase'}));
        setTimeout(() => processTurnEnd(), 500);
    }, 2000); // Animation time for combat
  };

  const handleRetreatMonster = () => {
    if (!gameState || gameState.isProcessingAction) return;
    const { players, currentPlayerIndex, activeMonsterP1, activeMonsterP2 } = gameState;
    const player = players[currentPlayerIndex];
    const monsterToRetreat = currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2;

    if (!monsterToRetreat) {
      toast({ title: "No monster to retreat", description: "You don't have an active monster in the arena.", variant: "destructive" });
      return;
    }
    
    setGameState(prev => ({...prev!, isProcessingAction: true}));
    appendLog(`${player.name} retreats ${monsterToRetreat.title} back to their hand.`);

    const newHand = [...player.hand, monsterToRetreat]; // Monster retains its current HP/shields
    const updatedPlayer = { ...player, hand: newHand };
    const newPlayers = [...players] as [PlayerData, PlayerData];
    newPlayers[currentPlayerIndex] = updatedPlayer;

    setGameState(prev => ({
      ...prev!,
      players: newPlayers,
      [currentPlayerIndex === 0 ? 'activeMonsterP1' : 'activeMonsterP2']: undefined,
      gamePhase: 'turn_resolution_phase',
    }));
    setTimeout(() => processTurnEnd(), 500);
  };


  if (!gameState || gameState.gamePhase === 'loading_art') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl">{gameState?.gameLogMessages?.slice(-1)[0] || "Initializing Arcane Clash..."}</p>
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
            if (currentPlayerIndex === 0 && gamePhase === 'player_action_phase' && !isProcessingAction) {
              if (card.cardType === 'Monster' && !activeMonsterP1) {
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
         {gamePhase === 'player_action_phase' && !isProcessingAction && (
          <PlayerActions
            currentPlayer={currentPlayer}
            activeMonster={currentPlayerIndex === 0 ? activeMonsterP1 : activeMonsterP2}
            onAttack={handleMonsterAttack}
            onRetreat={handleRetreatMonster}
            // Play monster/spell is handled by PlayerHand click for now
          />
        )}
         {gamePhase === 'turn_resolution_phase' && !isProcessingAction && (
             <button 
                onClick={processTurnEnd} 
                className="my-2 px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90">
                End Turn
             </button>
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
            if (currentPlayerIndex === 1 && gamePhase === 'player_action_phase' && !isProcessingAction) {
              if (card.cardType === 'Monster' && !activeMonsterP2) {
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
          hasInitialized.current = false; 
          descriptionQueueRef.current = [];
          isFetchingDescriptionRef.current = false;
          setGameState(null); 
        }}
      />
    </div>
  );
}
