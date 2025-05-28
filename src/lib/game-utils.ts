
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
  
  return CARD_TITLES.slice(0, 40).map((title, index) => {
    let magic = 0;
    let melee = 0;

    if (Math.random() < 0.5) {
      // Melee focused
      melee = getRandomInt(8, 20);
      magic = 0;
    } else {
      // Magic focused
      magic = getRandomInt(8, 20);
      melee = 0;
    }
    // Ensure at least one attack type has a value if both somehow ended up 0 (shouldn't happen with above logic)
    if (melee === 0 && magic === 0) {
      if (Math.random() < 0.5) melee = getRandomInt(5,15); else magic = getRandomInt(5,15);
    }


    const maxHp = getRandomInt(15, 35);
    const maxPhysicalShield = getRandomInt(0, 15);
    const maxMagicShield = getRandomInt(0, 15);
    
    return {
      id: `card-${index}-${Date.now()}-${Math.random().toString(36).substring(7)}`, 
      title,
      // isLoadingArt: true, // Art generation now handled by useEffect in GameBoard
      // artUrl: undefined,
      isLoadingArt: false, // For skipping art loading for testing
      artUrl: undefined,   // Will use placeholder

      magic: magic,
      melee: melee,
      defense: getRandomInt(1, 10), // Physical defense
      hp: maxHp,
      maxHp,
      shield: maxPhysicalShield, // Physical shield
      maxShield: maxPhysicalShield,
      magicShield: maxMagicShield,
      maxMagicShield: maxMagicShield,
      description: `A ${title} specializing in ${melee > 0 ? 'fierce melee' : 'powerful magic'}.`,
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
