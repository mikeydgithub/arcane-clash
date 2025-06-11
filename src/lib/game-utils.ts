
import type { CardData, MonsterCardData, SpellCardData } from '@/types';
import pregeneratedCardData from './pregenerated-card-data.json';

// Helper to generate random number in a range (still needed for some dynamic aspects if any)
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const allPregeneratedCards: CardData[] = pregeneratedCardData as CardData[];

// Generates a pool of monster cards from pregenerated data
export const generateMonsterCards = (titlesToFetch?: string[]): MonsterCardData[] => {
  const availableMonsters = allPregeneratedCards.filter(
    (card): card is MonsterCardData => card.cardType === 'Monster'
  );

  if (titlesToFetch) {
    // If specific titles are requested, try to find them
    // This path might not be used if we always pick randomly for decks
    return titlesToFetch.map(title => {
      const found = availableMonsters.find(m => m.title === title);
      if (found) return { ...found, isLoadingArt: false, isLoadingDescription: false };
      // Fallback if a specific pregenerated title isn't found (shouldn't happen if titles match card-definitions)
      console.warn(`Pregenerated monster with title "${title}" not found. This may indicate an issue.`);
      // Create a minimal fallback or throw error
      return { 
        id: `monster-fallback-${title.replace(/\s+/g, '-')}-${Date.now()}`, title, cardType: 'Monster', melee: 5, magic: 5, defense: 5, hp: 10, maxHp: 10, shield: 0, maxShield: 0, magicShield: 0, maxMagicShield: 0, description: "Data missing.", artUrl: undefined, isLoadingArt: false, isLoadingDescription: false 
      } as MonsterCardData;
    });
  }
  // If no specific titles, return all available pregenerated monsters
  return availableMonsters.map(card => ({ ...card, isLoadingArt: false, isLoadingDescription: false }));
};

// Generates a pool of spell cards from pregenerated data
export const generateSpellCards = (titlesToFetch?: string[]): SpellCardData[] => {
  const availableSpells = allPregeneratedCards.filter(
    (card): card is SpellCardData => card.cardType === 'Spell'
  );
  
  if (titlesToFetch) {
    return titlesToFetch.map(title => {
      const found = availableSpells.find(s => s.title === title);
      if (found) return { ...found, isLoadingArt: false, isLoadingDescription: false };
      console.warn(`Pregenerated spell with title "${title}" not found. This may indicate an issue.`);
      return { 
        id: `spell-fallback-${title.replace(/\s+/g, '-')}-${Date.now()}`, title, cardType: 'Spell', description: "Data missing.", artUrl: undefined, isLoadingArt: false, isLoadingDescription: false 
      } as SpellCardData;
    });
  }
  return availableSpells.map(card => ({ ...card, isLoadingArt: false, isLoadingDescription: false }));
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
  // No need to mark for loading, as data is pregenerated
  const updatedDealtCards = dealtCards.map(card => ({
    ...card,
    isLoadingArt: false, 
    isLoadingDescription: false,
  }));
  return { dealtCards: updatedDealtCards, remainingDeck };
};
