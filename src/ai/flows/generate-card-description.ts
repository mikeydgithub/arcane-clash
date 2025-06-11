
'use server';
/**
 * @fileOverview Generates a short description for a fantasy card based on its title and type.
 * For Monsters: Generates flavor text.
 * For Spells: Generates an effect description.
 *
 * - generateCardDescription - A function that generates the card description.
 * - GenerateCardDescriptionInput - The input type for the generateCardDescription function.
 * - GenerateCardDescriptionOutput - The return type for the generateCardDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardDescriptionInputSchema = z.object({
  cardTitle: z.string().describe('The title of the card.'),
  cardType: z.enum(['Monster', 'Spell']).describe('The type of the card (Monster or Spell).'),
});
export type GenerateCardDescriptionInput = z.infer<typeof GenerateCardDescriptionInputSchema>;

const GenerateCardDescriptionOutputSchema = z.object({
  description: z.string().describe('For Monsters: A short, thematic flavor text (max 15 words). For Spells: A concise effect description (10-20 words).'),
});
export type GenerateCardDescriptionOutput = z.infer<typeof GenerateCardDescriptionOutputSchema>;

export async function generateCardDescription(input: GenerateCardDescriptionInput): Promise<GenerateCardDescriptionOutput> {
  return generateCardDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCardDescriptionPrompt',
  input: {schema: GenerateCardDescriptionInputSchema},
  output: {schema: GenerateCardDescriptionOutputSchema},
  prompt: `
You are a creative writer and game designer for a fantasy trading card game.
The card title is "{{{cardTitle}}}".
The card type is "{{{cardType}}}".

If the card type is "Monster":
  Generate a very short, evocative, and thematic one-sentence flavor text suitable for the card.
  The flavor text MUST be 15 words or less. Do not include the card title in the flavor text.
  Example for "Flame Serpent": "Coils of fire that strike with burning venom."

If the card type is "Spell":
  Generate a concise (10-20 words) description of its magical effect.
  The effect should generally be a power-up for the caster/their creatures or a negative effect on their opponent/opponent's creatures.
  Examples for spell titles:
  - "Healing Light": "Restores a moderate amount of health to one of your creatures."
  - "Fireball": "Deals direct fire damage to an enemy creature or player."
  - "Arcane Shield": "Grants a temporary magical barrier to a friendly creature."
  - "Weakening Curse": "Reduces an enemy creature's attack power for a short duration."
  Do not include the card title in the effect description.
`,
});

const generateCardDescriptionFlow = ai.defineFlow(
  {
    name: 'generateCardDescriptionFlow',
    inputSchema: GenerateCardDescriptionInputSchema,
    outputSchema: GenerateCardDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (input.cardType === 'Monster') {
        return output || { description: "A mysterious entity from the arcane realms." };
    } else { // Spell
        return output || { description: "Unleashes a potent magical effect." };
    }
  }
);
