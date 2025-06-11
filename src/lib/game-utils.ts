
import type { CardData, MonsterCardData, SpellCardData } from '@/types';
// import { MONSTER_CARD_TITLES, SPELL_CARD_TITLES } from './card-definitions';
// import { generateCardDescription } from '@/ai/flows/generate-card-description'; // No longer called here

// Helper to generate random number in a range
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generates a pool of monster cards
export const generateMonsterCards = async (titles: string[]): Promise<MonsterCardData[]> => {
  const monsterCards: MonsterCardData[] = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];

    let magic = 0;
    let melee = 0;

    if (Math.random() < 0.5) {
      melee = getRandomInt(8, 20);
    } else {
      magic = getRandomInt(8, 20);
    }
    if (melee === 0 && magic === 0) {
      if (Math.random() < 0.5) melee = getRandomInt(5,15); else magic = getRandomInt(5,15);
    }

    const maxHp = getRandomInt(15, 35);
    const maxPhysicalShield = getRandomInt(0, 15);
    const maxMagicShield = getRandomInt(0, 15);
    
    monsterCards.push({
      id: `monster-${title.replace(/\s+/g, '-')}-${i}-${Date.now()}`, 
      title,
      cardType: 'Monster',
      isLoadingArt: false, 
      artUrl: undefined,   
      magic,
      melee,
      defense: getRandomInt(1, 10), 
      hp: maxHp,
      maxHp,
      shield: maxPhysicalShield, 
      maxShield: maxPhysicalShield,
      magicShield: maxMagicShield,
      maxMagicShield: maxMagicShield,
      description: undefined, // Initialize with no description
      isLoadingDescription: false,
    });
  }
  return monsterCards;
};

// Generates a pool of spell cards
export const generateSpellCards = async (titles: string[]): Promise<SpellCardData[]> => {
  const spellCards: SpellCardData[] = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    
    spellCards.push({
      id: `spell-${title.replace(/\s+/g, '-')}-${i}-${Date.now()}`,
      title,
      cardType: 'Spell',
      isLoadingArt: false, 
      artUrl: undefined,
      description: undefined, // Initialize with no description
      isLoadingDescription: false,
    });
  }
  return spellCards;
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
  // Mark cards for description loading when dealt, if not already loaded/loading
  const updatedDealtCards = dealtCards.map(card => ({
    ...card,
    // isLoadingDescription will be handled by GameBoard's useEffect
  }));
  return { dealtCards: updatedDealtCards, remainingDeck };
};
