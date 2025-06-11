
import type { CardData } from '@/types';
import { CARD_TITLES } from './card-definitions';
import { generateCardDescription } from '@/ai/flows/generate-card-description';

// Helper to generate random number in a range
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generates a pool of 40 unique-ish cards with AI descriptions
export const generateInitialCards = async (): Promise<CardData[]> => {
  if (CARD_TITLES.length < 40) {
    console.warn("Not enough unique card titles to generate 40 unique cards. Some stats/descriptions might be reused or decks will be smaller.");
  }
  
  const cardPromises = CARD_TITLES.slice(0, 40).map(async (title, index) => {
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
    // Ensure at least one attack type has a value if both somehow ended up 0
    if (melee === 0 && magic === 0) {
      if (Math.random() < 0.5) melee = getRandomInt(5,15); else magic = getRandomInt(5,15);
    }

    const maxHp = getRandomInt(15, 35);
    const maxPhysicalShield = getRandomInt(0, 15);
    const maxMagicShield = getRandomInt(0, 15);
    
    let description = `A ${title} specializing in ${melee > 0 ? 'fierce melee' : 'powerful magic'}.`; // Default fallback description
    try {
      const descriptionResult = await generateCardDescription({ cardTitle: title });
      description = descriptionResult.description;
    } catch (error) {
      console.error(`Failed to generate description for ${title}:`, error);
      // Keep default description on error
    }
    
    return {
      id: `card-${index}-${Date.now()}-${Math.random().toString(36).substring(7)}`, 
      title,
      isLoadingArt: false, 
      artUrl: undefined,   
      magic: magic,
      melee: melee,
      defense: getRandomInt(1, 10), 
      hp: maxHp,
      maxHp,
      shield: maxPhysicalShield, 
      maxShield: maxPhysicalShield,
      magicShield: maxMagicShield,
      maxMagicShield: maxMagicShield,
      description, // Use AI generated or default description
    };
  });
  return Promise.all(cardPromises);
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
