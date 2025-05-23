
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
import { Loader2, Layers3, Trash2 } from 'lucide-react'; // Added Layers3 for Deck, Trash2 for Discard

const INITIAL_PLAYER_HP = 100;
const CARDS_IN_HAND = 5;
const INITIAL_DECK_SIZE_PER_PLAYER = 20;

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [artGenerationProgress, setArtGenerationProgress] = useState(0);
  const { toast } = useToast();

  const initializeGame = useCallback(() => {
    const allGeneratedCards = generateInitialCards(); // Generates 40 cards
    const shuffledAllCards = shuffleDeck(allGeneratedCards);

    const player1Deck = shuffledAllCards.slice(0, INITIAL_DECK_SIZE_PER_PLAYER);
    const player2Deck = shuffledAllCards.slice(INITIAL_DECK_SIZE_PER_PLAYER, INITIAL_DECK_SIZE_PER_PLAYER * 2);

    const { dealtCards: p1InitialHand, remainingDeck: p1DeckAfterDeal } = dealCards(player1Deck, CARDS_IN_HAND);
    const { dealtCards: p2InitialHand, remainingDeck: p2DeckAfterDeal } = dealCards(player2Deck, CARDS_IN_HAND);

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
      battleMessage: "Let the arcane clash begin!",
    });
    setArtGenerationProgress(0);

    let artLoadedCount = 0;
    const cardsInInitialHands = [...p1InitialHand, ...p2InitialHand];
    const totalCardsToLoadArtFor = cardsInInitialHands.length;

    if (totalCardsToLoadArtFor === 0) {
        setGameState(prev => prev ? { ...prev, gamePhase: 'player1_select_card', battleMessage: `${prev.players[0].name}, select your champion!` } : null);
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
          setGameState(prev => prev ? { ...prev, gamePhase: 'player1_select_card', battleMessage: `${prev.players[0].name}, select your champion!` } : null);
        }
      }
    });
  }, [toast]);

  useEffect(() => {
    if (!gameState) {
      // Initial placeholder state before game starts
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
        battleMessage: "Welcome to Arcane Clash!",
      });
    }
  }, [gameState]);


  const handleCardSelect = (card: CardData) => {
    if (!gameState) return;
    const { currentPlayerIndex, gamePhase, players } = gameState;

    if (gamePhase === 'player1_select_card' && currentPlayerIndex === 0 ) {
      setGameState(prev => prev ? { ...prev, selectedCardP1: card, gamePhase: 'player2_select_card', currentPlayerIndex: 1, battleMessage: `${players[1].name}, choose your defender!` } : null);
    } else if (gamePhase === 'player2_select_card' && currentPlayerIndex === 1 ) {
      setGameState(prev => prev ? { ...prev, selectedCardP2: card, gamePhase: 'combat_animation', battleMessage: "CLASH!" } : null);
      setTimeout(() => resolveCombat(), 1500); 
    }
  };

  const resolveCombat = () => {
    setGameState(prev => {
      if (!prev || !prev.selectedCardP1 || !prev.selectedCardP2) return prev;

      let { players, selectedCardP1, selectedCardP2 } = { ...prev };
      let battleLog = "";

      let p1Data = { ...players[0], hand: [...players[0].hand], deck: [...players[0].deck], discardPile: [...players[0].discardPile] };
      let p2Data = { ...players[1], hand: [...players[1].hand], deck: [...players[1].deck], discardPile: [...players[1].discardPile] };
      
      let card1InCombat = { ...selectedCardP1 };
      let card2InCombat = { ...selectedCardP2 };

      const initialP1CardDefense = selectedCardP1.defense; // Storing for direct damage calculation
      const initialP2CardDefense = selectedCardP2.defense;


      // --- COMBAT LOGIC ---
      const attackP1 = card1InCombat.melee + card1InCombat.magic;
      const attackP2 = card2InCombat.melee + card2InCombat.magic;

      // P1 attacks P2
      const shieldAbsorbedByC2 = Math.min(card2InCombat.shield, attackP1);
      card2InCombat.shield -= shieldAbsorbedByC2;
      const damageToCard2Hp = Math.max(0, attackP1 - shieldAbsorbedByC2 - card2InCombat.defense);
      card2InCombat.hp -= damageToCard2Hp;
      battleLog += `${card1InCombat.title} attacks ${card2InCombat.title} for ${attackP1}. ${card2InCombat.title}'s defense blocks ${card2InCombat.defense}, shield absorbs ${shieldAbsorbedByC2}. ${card2InCombat.title} takes ${damageToCard2Hp} HP damage.\n`;

      // P2 counter-attacks P1 (if P2 survived)
      if (card2InCombat.hp > 0) {
        const shieldAbsorbedByC1 = Math.min(card1InCombat.shield, attackP2);
        card1InCombat.shield -= shieldAbsorbedByC1;
        const damageToCard1Hp = Math.max(0, attackP2 - shieldAbsorbedByC1 - card1InCombat.defense);
        card1InCombat.hp -= damageToCard1Hp;
        battleLog += `${card2InCombat.title} counter-attacks ${card1InCombat.title} for ${attackP2}. ${card1InCombat.title}'s defense blocks ${card1InCombat.defense}, shield absorbs ${shieldAbsorbedByC1}. ${card1InCombat.title} takes ${damageToCard1Hp} HP damage.\n`;
      } else {
         battleLog += `${card2InCombat.title} was defeated before it could counter-attack.\n`;
      }

      // --- POST-COMBAT RESOLUTION & CARD DRAWING ---

      // Resolve Player 1's card
      if (card1InCombat.hp <= 0) {
        battleLog += `${card1InCombat.title} is defeated! `;
        p1Data.discardPile.push(selectedCardP1); // Add original card to discard
        p1Data.hand = p1Data.hand.filter(c => c.id !== card1InCombat.id);
        
        // Direct damage to P1 if their card is defeated by counter-attack
        if (card2InCombat.hp > 0) { // Only if P2 counter-attacked
            const directDamageToP1 = Math.max(0, attackP2 - initialP1CardDefense);
            p1Data.hp = Math.max(0, p1Data.hp - directDamageToP1);
            battleLog += `${p1Data.name} takes ${directDamageToP1} direct damage. `;
        }

        if (p1Data.hand.length < CARDS_IN_HAND && p1Data.deck.length > 0) {
          const { dealtCards: p1NewCards, remainingDeck: deckAfterP1Draw } = dealCards(p1Data.deck, 1);
          p1Data.hand.push(p1NewCards[0]);
          p1Data.deck = deckAfterP1Draw;
          battleLog += `${p1Data.name} draws a card. `;
          // Fetch art for newly drawn card
          generateCardArt({ cardTitle: p1NewCards[0].title }).then(artResult => {
            setGameState(currentGS => {
              if (!currentGS) return null;
              return {
                ...currentGS,
                players: currentGS.players.map(p => 
                  p.id === p1Data.id ? { ...p, hand: p.hand.map(c => c.id === p1NewCards[0].id ? {...c, artUrl: artResult.cardArtDataUri, isLoadingArt: false} : c) } : p
                ) as [PlayerData, PlayerData]
              };
            });
          }).catch(err => console.error("Art gen error for P1 draw", err));
        }
      } else {
        // Card survived, update it in hand
        p1Data.hand = p1Data.hand.map(c => c.id === card1InCombat.id ? card1InCombat : c);
        battleLog += `${card1InCombat.title} survives. `;
      }

      // Resolve Player 2's card
      if (card2InCombat.hp <= 0) {
        battleLog += `${card2InCombat.title} is defeated! `;
        p2Data.discardPile.push(selectedCardP2); // Add original card to discard
        p2Data.hand = p2Data.hand.filter(c => c.id !== card2InCombat.id);

        // Direct damage to P2 if their card is defeated by P1's attack
        const directDamageToP2 = Math.max(0, attackP1 - initialP2CardDefense); 
        p2Data.hp = Math.max(0, p2Data.hp - directDamageToP2);
        battleLog += `${p2Data.name} takes ${directDamageToP2} direct damage. `;
        
        if (p2Data.hand.length < CARDS_IN_HAND && p2Data.deck.length > 0) {
          const { dealtCards: p2NewCards, remainingDeck: deckAfterP2Draw } = dealCards(p2Data.deck, 1);
          p2Data.hand.push(p2NewCards[0]);
          p2Data.deck = deckAfterP2Draw;
          battleLog += `${p2Data.name} draws a card. `;
          // Fetch art for newly drawn card
           generateCardArt({ cardTitle: p2NewCards[0].title }).then(artResult => {
            setGameState(currentGS => {
              if (!currentGS) return null;
              return {
                ...currentGS,
                players: currentGS.players.map(p => 
                  p.id === p2Data.id ? { ...p, hand: p.hand.map(c => c.id === p2NewCards[0].id ? {...c, artUrl: artResult.cardArtDataUri, isLoadingArt: false} : c) } : p
                ) as [PlayerData, PlayerData]
              };
            });
          }).catch(err => console.error("Art gen error for P2 draw", err));
        }
      } else {
        // Card survived, update it in hand
        p2Data.hand = p2Data.hand.map(c => c.id === card2InCombat.id ? card2InCombat : c);
        battleLog += `${card2InCombat.title} survives. `;
      }
      
      // --- GAME OVER CHECK ---
      let newGamePhase: GamePhase = 'player1_select_card';
      let winner: PlayerData | undefined = undefined;
      let nextPlayerIdx = 0; 

      if (p1Data.hp <= 0 && p2Data.hp <= 0) {
        winner = undefined; 
        newGamePhase = 'game_over';
        battleLog += "It's a draw!";
      } else if (p1Data.hp <= 0) {
        winner = players[1]; // Original player object for name
        newGamePhase = 'game_over';
        battleLog += `${players[1].name} wins!`;
      } else if (p2Data.hp <= 0) {
        winner = players[0]; // Original player object for name
        newGamePhase = 'game_over';
        battleLog += `${players[0].name} wins!`;
      }
      
      if (newGamePhase !== 'game_over') {
        nextPlayerIdx = 0; // P1 (index 0) always starts the new selection phase.
        battleLog += `\n${players[nextPlayerIdx].name}'s turn. Select a card.`;
      }
      
      return {
        ...prev,
        players: [p1Data, p2Data],
        selectedCardP1: undefined,
        selectedCardP2: undefined,
        gamePhase: newGamePhase,
        currentPlayerIndex: nextPlayerIdx as 0 | 1,
        winner,
        battleMessage: battleLog.trim(),
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
  
  const { players, currentPlayerIndex, gamePhase, selectedCardP1, selectedCardP2, winner, battleMessage } = gameState;
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
      {/* Player 1 Column (Left) */}
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
          isCurrentPlayer={currentPlayerIndex === 0 && (gamePhase === 'player1_select_card' || gamePhase === 'combat_resolution')} 
        />
        <PlayerHand 
          cards={player1.hand} 
          onCardSelect={handleCardSelect} 
          isPlayerTurn={currentPlayerIndex === 0 && gamePhase === 'player1_select_card'}
          selectedCardId={selectedCardP1?.id}
          hasCommittedCard={!!selectedCardP1}
          isOpponent={false}
        />
      </div>

      {/* Battle Arena (Middle) */}
      <div className="flex-grow flex flex-col items-center justify-center min-w-0">
        <BattleArena 
          player1Card={selectedCardP1} 
          player2Card={selectedCardP2} 
          showClashAnimation={gamePhase === 'combat_animation' && !!selectedCardP1 && !!selectedCardP2}
          battleMessage={battleMessage}
        />
      </div>
      

      {/* Player 2 Column (Right) */}
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
            isCurrentPlayer={currentPlayerIndex === 1 && (gamePhase === 'player2_select_card' || gamePhase === 'combat_resolution')} 
            isOpponent={true}
        />
        <PlayerHand 
          cards={player2.hand} 
          onCardSelect={handleCardSelect} 
          isPlayerTurn={currentPlayerIndex === 1 && gamePhase === 'player2_select_card'}
          isOpponent={true}
          selectedCardId={selectedCardP2?.id}
          hasCommittedCard={!!selectedCardP2}
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

