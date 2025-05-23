
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CardData, GameState, PlayerData, GamePhase } from '@/types';
import { generateInitialCards, shuffleDeck, dealCards } from '@/lib/game-utils';
import { generateCardArt, type GenerateCardArtInput } from '@/ai/flows/generate-card-art';
import { PlayerHand } from './PlayerHand';
import { PlayerStatusDisplay } from './PlayerStatusDisplay';
import { BattleArena } from './BattleArena';
import { GameOverModal } from './GameOverModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Layers3, Trash2, Play } from 'lucide-react';

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;
const INITIAL_DECK_SIZE_PER_PLAYER = 20; 

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [artGenerationProgress, setArtGenerationProgress] = useState(0);
  const { toast } = useToast();

  const initializeGame = useCallback(() => {
    const allGeneratedCards = generateInitialCards(); 
    const shuffledAllCards = shuffleDeck(allGeneratedCards);

    const player1DeckFull = shuffledAllCards.slice(0, INITIAL_DECK_SIZE_PER_PLAYER);
    const player2DeckFull = shuffledAllCards.slice(INITIAL_DECK_SIZE_PER_PLAYER, INITIAL_DECK_SIZE_PER_PLAYER * 2);

    const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1DeckFull, CARDS_IN_HAND);
    const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2DeckFull, CARDS_IN_HAND);

    const initialGameLog = ["Let the arcane clash begin!"];
    setGameState({
      players: [
        { id: 'p1', name: 'Player 1', hp: INITIAL_PLAYER_HP, hand: p1InitialHand, deck: p1DeckAfterDeal, discardPile: [] },
        { id: 'p2', name: 'Player 2', hp: INITIAL_PLAYER_HP, hand: p2InitialHand, deck: p2DeckAfterDeal, discardPile: [] },
      ],
      currentPlayerIndex: 0,
      gamePhase: 'loading_art',
      selectedCardP1: undefined,
      selectedCardP2: undefined,
      winner: undefined,
      gameLogMessages: initialGameLog,
    });
    setArtGenerationProgress(0);

    let artLoadedCount = 0;
    const cardsInInitialHands = [...p1InitialHand, ...p2InitialHand];
    const totalCardsToLoadArtFor = cardsInInitialHands.length;

    if (totalCardsToLoadArtFor === 0) {
        setGameState(prev => {
            if (!prev) return null;
            const nextPlayerName = prev.players[0].name;
            return { 
                ...prev, 
                gamePhase: 'player1_select_card', 
                gameLogMessages: [...prev.gameLogMessages, `${nextPlayerName}, select your champion!`] 
            };
        });
        return;
    }
    
    cardsInInitialHands.forEach(async (card) => {
      try {
        const artInput: GenerateCardArtInput = { cardTitle: card.title };
        const result = await generateCardArt(artInput);
        
        setGameState(prev => {
          if (!prev) return null;
          const updateCardInHand = (hand: CardData[]) => 
            hand.map(c => c.id === card.id ? { ...c, artUrl: result.cardArtDataUri, isLoadingArt: false } : c);
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInHand(p.hand) })) as [PlayerData, PlayerData],
          };
        });
      } catch (error) {
        console.error(`Failed to generate art for ${card.title}:`, error);
        toast({ title: "Art Generation Error", description: `Could not generate art for ${card.title}. Using placeholder.`, variant: "destructive" });
        setGameState(prev => {
           if (!prev) return null;
           const updateCardInHand = (hand: CardData[]) => 
            hand.map(c => c.id === card.id ? { ...c, isLoadingArt: false } : c);
          
          return {
            ...prev,
            players: prev.players.map(p => ({ ...p, hand: updateCardInHand(p.hand) })) as [PlayerData, PlayerData],
          };
        });
      } finally {
        artLoadedCount++;
        setArtGenerationProgress((artLoadedCount / totalCardsToLoadArtFor) * 100);
        if (artLoadedCount === totalCardsToLoadArtFor) {
          setGameState(prev => {
            if (!prev) return null;
            const nextPlayerName = prev.players[0].name;
            return { 
                ...prev, 
                gamePhase: 'player1_select_card', 
                gameLogMessages: [...prev.gameLogMessages, `${nextPlayerName}, select your champion!`] 
            };
          });
        }
      }
    });
  }, [toast]);

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
    }
  }, [gameState]);


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase, players, gameLogMessages } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0 ) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, gameLogMessages: [...gameLogMessages, `${players[1].name}, choose your defender!`] } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1 ) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', gameLogMessages: [...gameLogMessages, "Prepare for CLASH!"] } : null);
      setTimeout(() => resolveCombat(), 1200); 
    }
  };

  const resolveCombat = () => {
    setGameState(prev => {
      if (!prev || !prev.selectedCardP1 || !prev.selectedCardP2) return prev;

      let { players, selectedCardP1, selectedCardP2, gameLogMessages: currentLog } = { ...prev };
      const newTurnLogEntries: string[] = [];

      let p1Data = { ...players[0], hand: [...players[0].hand], deck: [...players[0].deck], discardPile: [...players[0].discardPile] };
      let p2Data = { ...players[1], hand: [...players[1].hand], deck: [...players[1].deck], discardPile: [...players[1].discardPile] };
      
      let card1InCombat = { ...selectedCardP1 }; 
      let card2InCombat = { ...selectedCardP2 }; 

      const initialP1CardDefense = selectedCardP1.defense;
      const initialP2CardDefense = selectedCardP2.defense;

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

      if (card2InCombat.hp > 0) {
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


      if (card1InCombat.hp <= 0) {
        newTurnLogEntries.push(`${card1InCombat.title} is defeated!`);
        p1Data.discardPile.push(selectedCardP1); 
        p1Data.hand = p1Data.hand.filter(c => c.id !== card1InCombat.id);
        
        if (card2InCombat.hp > 0) { 
            const directDamageToP1 = Math.max(0, attackP2 - initialP1CardDefense);
             if(directDamageToP1 > 0) {
                p1Data.hp = Math.max(0, p1Data.hp - directDamageToP1);
                newTurnLogEntries.push(`${p1Data.name} takes ${directDamageToP1} direct damage. New HP: ${p1Data.hp}`);
            }
        }
      } else {
        p1Data.hand = p1Data.hand.map(c => c.id === card1InCombat.id ? card1InCombat : c);
        newTurnLogEntries.push(`${card1InCombat.title} survives the clash.`);
      }

      if (card2InCombat.hp <= 0) {
        newTurnLogEntries.push(`${card2InCombat.title} is defeated!`);
        p2Data.discardPile.push(selectedCardP2); 
        p2Data.hand = p2Data.hand.filter(c => c.id !== card2InCombat.id);

        const directDamageToP2 = Math.max(0, attackP1 - initialP2CardDefense); 
        if (directDamageToP2 > 0) {
            p2Data.hp = Math.max(0, p2Data.hp - directDamageToP2);
            newTurnLogEntries.push(`${p2Data.name} takes ${directDamageToP2} direct damage. New HP: ${p2Data.hp}`);
        }
      } else {
        p2Data.hand = p2Data.hand.map(c => c.id === card2InCombat.id ? card2InCombat : c);
        newTurnLogEntries.push(`${card2InCombat.title} survives the clash.`);
      }
      
      const drawCardForPlayer = async (playerData: PlayerData, playerName: string) => {
        if (playerData.hand.length < CARDS_IN_HAND && playerData.deck.length > 0) {
          const { dealtCards: newCards, remainingDeck: deckAfterDraw } = dealCards(playerData.deck, 1);
          const newCardWithLoadingArt = { ...newCards[0], isLoadingArt: true, artUrl: undefined };
          playerData.hand.push(newCardWithLoadingArt);
          playerData.deck = deckAfterDraw;
          newTurnLogEntries.push(`${playerName} draws a new card: ${newCards[0].title}.`);
          
          generateCardArt({ cardTitle: newCards[0].title }).then(artResult => {
            setGameState(currentGS => {
              if (!currentGS) return null;
              return {
                ...currentGS,
                players: currentGS.players.map(p => 
                  p.id === playerData.id ? { ...p, hand: p.hand.map(c => c.id === newCards[0].id ? {...c, artUrl: artResult.cardArtDataUri, isLoadingArt: false} : c) } : p
                ) as [PlayerData, PlayerData]
              };
            });
          }).catch(err => {
            console.error(`Art gen error for ${playerName} draw`, err);
            setGameState(currentGS => {
              if (!currentGS) return null;
              return {
                ...currentGS,
                players: currentGS.players.map(p => 
                  p.id === playerData.id ? { ...p, hand: p.hand.map(c => c.id === newCards[0].id ? {...c, isLoadingArt: false} : c) } : p
                ) as [PlayerData, PlayerData]
              };
            });
          });
        } else if (playerData.hand.length < CARDS_IN_HAND && playerData.deck.length === 0) {
          newTurnLogEntries.push(`${playerName} has no cards left in their deck to draw.`);
        }
      };

      if (p1Data.hand.find(c => c.id === card1InCombat.id && c.hp > 0) === undefined ) { // Card defeated or not found (if somehow removed)
         drawCardForPlayer(p1Data, p1Data.name);
      }
      if (p2Data.hand.find(c => c.id === card2InCombat.id && c.hp > 0) === undefined ) {
         drawCardForPlayer(p2Data, p2Data.name);
      }
      
      let newGamePhase: GamePhase = 'combat_summary'; 
      let winner: PlayerData | undefined = undefined;

      if (p1Data.hp <= 0 && p2Data.hp <= 0) {
        winner = undefined; 
        newGamePhase = 'game_over';
        newTurnLogEntries.push("It's a draw! Both players have been defeated.");
      } else if (p1Data.hp <= 0) {
        winner = players[1];
        newGamePhase = 'game_over';
        newTurnLogEntries.push(`${players[1].name} wins! ${players[0].name} has been defeated.`);
      } else if (p2Data.hp <= 0) {
        winner = players[0];
        newGamePhase = 'game_over';
        newTurnLogEntries.push(`${players[0].name} wins! ${players[1].name} has been defeated.`);
      }
      
      const finalSelectedCardP1 = card1InCombat.hp > 0 ? card1InCombat : undefined;
      const finalSelectedCardP2 = card2InCombat.hp > 0 ? card2InCombat : undefined;

      return {
        ...prev,
        players: [p1Data, p2Data],
        selectedCardP1: finalSelectedCardP1, 
        selectedCardP2: finalSelectedCardP2, 
        gamePhase: newGamePhase,
        winner,
        gameLogMessages: [...currentLog, ...newTurnLogEntries],
      };
    });
  };
  
  const handleProceedToNextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      const nextPlayerName = prev.players[0].name; 
      return {
        ...prev,
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        gameLogMessages: [...prev.gameLogMessages, `${nextPlayerName}, select your champion!`],
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
  
  const { players, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, gameLogMessages } = gameState;
  const player1 = players[0];
  const player2 = players[1];

  if (gamePhase === 'initial') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground">
        <h1 className="text-5xl font-bold text-primary mb-8 tracking-wide">Arcane Clash</h1>
        <Button onClick={initializeGame} size="lg" className="px-10 py-6 text-2xl bg-accent hover:bg-accent/90">
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
            style={{ width: `${artGenerationProgress}%`}}
          ></div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{Math.round(artGenerationProgress)}% Complete</p>
      </div>
    );
  }

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground p-1 md:p-2">
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
          isCurrentPlayer={currentPlayerIndex === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'combat_summary')} 
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

      <div className="flex-grow flex flex-col items-center justify-center min-w-0">
        <BattleArena 
          player1Card={selectedCardP1} 
          player2Card={selectedCardP2} 
          showClashAnimation={gamePhase === 'combat_animation' && !!selectedCardP1 && !!selectedCardP2}
          gameLogMessages={gameLogMessages}
          gamePhase={gamePhase}
        />
        {gamePhase === 'combat_summary' && (
          <Button onClick={handleProceedToNextTurn} className="mt-2 bg-accent hover:bg-accent/90">
            <Play className="mr-2 h-4 w-4" /> Continue
          </Button>
        )}
      </div>
      
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
            isCurrentPlayer={currentPlayerIndex === 1 && (gamePhase === 'player2_select_card' || gamePhase === 'combat_summary')} 
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
        onRestart={initializeGame} 
      />
    </div>
  );
}
