import type { CardData } from '@/types';
import { CARD_TITLES } from './card-definitions';

// Helper to generate random number in a range
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateInitialCards = (): CardData[] => {
  return CARD_TITLES.map((title, index) => {
    const magic = getRandomInt(0, 15);
    const melee = getRandomInt(0, 15);
    const totalAttack = magic + melee;
    
    // Ensure card has some attack power
    const finalMagic = totalAttack === 0 ? getRandomInt(1,8) : magic;
    const finalMelee = totalAttack === 0 && finalMagic === magic ? getRandomInt(1,8) : melee;

    const maxHp = getRandomInt(10, 30);
    const maxShield = getRandomInt(0, 15);
    
    return {
      id: `card-${index}-${Date.now()}`,
      title,
      isLoadingArt: true,
      artUrl: undefined, // Will be filled by AI
      magic: finalMagic,
      melee: finalMelee,
      defense: getRandomInt(1, 10),
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      description: `A formidable ${title}.`, // Basic description
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

export const dealCards = (deck: CardData[], count: number): { dealtCards: CardData[], remainingDeck: CardData[] } => {
  const dealtCards = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { dealtCards, remainingDeck };
};
