
import type { CardData, MonsterCardData, SpellCardData } from '@/types';
import { fetchAllMonsterCards, fetchAllSpellCards } from '@/services/card-service';

// Generates a pool of monster cards from the backend
export const generateMonsterCards = async (): Promise<MonsterCardData[]> => {
  try {
    const monsters = await fetchAllMonsterCards();
    return monsters.map(card => ({ ...card, isLoadingArt: false, isLoadingDescription: false }));
  } catch (error) {
    console.error("Failed to fetch monster cards from Firestore:", error);
    return []; // Return empty array on error
  }
};

// Generates a pool of spell cards from the backend
export const generateSpellCards = async (): Promise<SpellCardData[]> => {
  try {
    const spells = await fetchAllSpellCards();
    return spells.map(card => ({ ...card, isLoadingArt: false, isLoadingDescription: false }));
  } catch (error) {
    console.error("Failed to fetch spell cards from Firestore:", error);
    return []; // Return empty array on error
  }
};

export const shuffleDeck = (deck: CardData[]): CardData[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Deals cards from a specific player's deck
export const dealCards = (deck: CardData[], count: number): { dealtCards: CardData[], remainingDeck: CardData[] } => {
  const cardsToDeal = Math.min(count, deck.length);
  const dealtCards = deck.slice(0, cardsToDeal);
  const remainingDeck = deck.slice(cardsToDeal);
  
  const updatedDealtCards = dealtCards.map(card => ({
    ...card,
    isLoadingArt: false, 
    isLoadingDescription: false,
  }));
  return { dealtCards: updatedDealtCards, remainingDeck };
};
