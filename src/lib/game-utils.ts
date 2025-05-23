
import type { CardData } from '@/types';
import { CARD_TITLES } from './card-definitions';

// Helper to generate random number in a range
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generates a pool of 40 unique-ish cards
export const generateInitialCards = (): CardData[] => {
  if (CARD_TITLES.length < 40) {
    console.warn("Not enough unique card titles to generate 40 unique cards. Duplicates might occur or deck sizes will be smaller.");
  }
  // Ensure we generate up to 40 cards, even if titles repeat for the purpose of generation.
  // In a real game, you'd have truly unique cards or allow duplicates by design.
  return CARD_TITLES.slice(0, 40).map((title, index) => {
    const magic = getRandomInt(0, 15);
    const melee = getRandomInt(0, 15);
    const totalAttack = magic + melee;
    
    const finalMagic = totalAttack === 0 ? getRandomInt(1,8) : magic;
    const finalMelee = totalAttack === 0 && finalMagic === magic ? getRandomInt(1,8) : melee;

    const maxHp = getRandomInt(10, 30);
    const maxShield = getRandomInt(0, 15);
    
    return {
      id: `card-${index}-${Date.now()}-${Math.random().toString(36).substring(7)}`, // More unique ID
      title,
      isLoadingArt: true,
      artUrl: undefined,
      magic: finalMagic,
      melee: finalMelee,
      defense: getRandomInt(1, 10),
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      description: `A formidable ${title}.`,
    };
  });
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
  return { dealtCards, remainingDeck };
};

