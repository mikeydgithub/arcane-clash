
import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // Load .env variables for API keys

import fs from 'fs/promises';
import path from 'path';
import { MONSTER_CARD_TITLES, SPELL_CARD_TITLES } from '../src/lib/card-definitions';
import { generateCardArt } from '../src/ai/flows/generate-card-art';
import { generateCardDescription } from '../src/ai/flows/generate-card-description';
import type { CardData, MonsterCardData, SpellCardData } from '../src/types';

// Helper to generate random number in a range
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const API_CALL_DELAY_MS = 5000; // 5 seconds delay between sets of AI calls per card. Adjust if rate limits persist.

async function main() {
  console.log('Starting pre-generation of card data...');
  const allPregeneratedCards: CardData[] = [];
  const outputFilePath = path.join(__dirname, '../src/lib/pregenerated-card-data.json');

  // --- Generate Monster Cards ---
  console.log(`\nGenerating ${MONSTER_CARD_TITLES.length} Monster cards...`);
  for (let i = 0; i < MONSTER_CARD_TITLES.length; i++) {
    const title = MONSTER_CARD_TITLES[i];
    console.log(`(${i + 1}/${MONSTER_CARD_TITLES.length}) Processing Monster: ${title}`);

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

    let artDataUri = `https://placehold.co/300x400.png?text=${encodeURIComponent(title)}`;
    try {
      console.log(`  Generating art for ${title}...`);
      const artResult = await generateCardArt({ cardTitle: title });
      artDataUri = artResult.cardArtDataUri;
      console.log(`  Art generated for ${title}.`);
    } catch (error) {
      console.error(`  Error generating art for Monster ${title}:`, (error as Error).message);
      console.log(`  Using placeholder art for ${title}.`);
    }
    await delay(API_CALL_DELAY_MS / 2); // Delay between art and description

    let description = "A mysterious creature of untold power.";
    try {
      console.log(`  Generating description for ${title}...`);
      const descResult = await generateCardDescription({ cardTitle: title, cardType: 'Monster' });
      description = descResult.description;
      console.log(`  Description generated for ${title}.`);
    } catch (error) {
      console.error(`  Error generating description for Monster ${title}:`, (error as Error).message);
    }
    
    const monsterCard: MonsterCardData = {
      id: `monster-${title.replace(/\s+/g, '-')}-${i}`,
      title,
      cardType: 'Monster',
      artUrl: artDataUri,
      description,
      isLoadingArt: false,
      isLoadingDescription: false,
      magic,
      melee,
      defense: getRandomInt(1, 10),
      hp: maxHp,
      maxHp,
      shield: maxPhysicalShield,
      maxShield: maxPhysicalShield,
      magicShield: maxMagicShield,
      maxMagicShield: maxMagicShield,
    };
    allPregeneratedCards.push(monsterCard);
    console.log(`  Finished ${title}.`);
    await delay(API_CALL_DELAY_MS); // Wait before next card
  }

  // --- Generate Spell Cards ---
  console.log(`\nGenerating ${SPELL_CARD_TITLES.length} Spell cards...`);
  for (let i = 0; i < SPELL_CARD_TITLES.length; i++) {
    const title = SPELL_CARD_TITLES[i];
    console.log(`(${i + 1}/${SPELL_CARD_TITLES.length}) Processing Spell: ${title}`);

    let artDataUri = `https://placehold.co/300x400.png?text=${encodeURIComponent(title)}`;
     try {
      console.log(`  Generating art for ${title}...`);
      const artResult = await generateCardArt({ cardTitle: title });
      artDataUri = artResult.cardArtDataUri;
      console.log(`  Art generated for ${title}.`);
    } catch (error) {
      console.error(`  Error generating art for Spell ${title}:`, (error as Error).message);
      console.log(`  Using placeholder art for ${title}.`);
    }
    await delay(API_CALL_DELAY_MS / 2);

    let description = "A powerful arcane incantation.";
    try {
      console.log(`  Generating description for ${title}...`);
      const descResult = await generateCardDescription({ cardTitle: title, cardType: 'Spell' });
      description = descResult.description;
      console.log(`  Description generated for ${title}.`);
    } catch (error) {
      console.error(`  Error generating description for Spell ${title}:`, (error as Error).message);
    }

    const spellCard: SpellCardData = {
      id: `spell-${title.replace(/\s+/g, '-')}-${i}`,
      title,
      cardType: 'Spell',
      artUrl: artDataUri,
      description,
      isLoadingArt: false,
      isLoadingDescription: false,
    };
    allPregeneratedCards.push(spellCard);
    console.log(`  Finished ${title}.`);
    await delay(API_CALL_DELAY_MS); // Wait before next card
  }

  // --- Write to JSON file ---
  try {
    await fs.writeFile(outputFilePath, JSON.stringify(allPregeneratedCards, null, 2));
    console.log(`\nSuccessfully pre-generated ${allPregeneratedCards.length} cards to ${outputFilePath}`);
    console.log("You can now run 'npm run dev' to start the game with pregenerated data.");
  } catch (error) {
    console.error('Error writing pregenerated card data to file:', error);
  }
}

main().catch(err => {
    console.error("Unhandled error in pregeneration script:", err);
    process.exit(1);
});
