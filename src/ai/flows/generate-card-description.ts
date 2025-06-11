
'use server';
/**
 * @fileOverview Generates a short description for a fantasy card based on its title.
 *
 * - generateCardDescription - A function that generates the card description.
 * - GenerateCardDescriptionInput - The input type for the generateCardDescription function.
 * - GenerateCardDescriptionOutput - The return type for the generateCardDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardDescriptionInputSchema = z.object({
  cardTitle: z.string().describe('The title of the card.'),
});
export type GenerateCardDescriptionInput = z.infer<typeof GenerateCardDescriptionInputSchema>;

const GenerateCardDescriptionOutputSchema = z.object({
  description: z.string().describe('A short, thematic description for the card, no more than 15 words.'),
});
export type GenerateCardDescriptionOutput = z.infer<typeof GenerateCardDescriptionOutputSchema>;

export async function generateCardDescription(input: GenerateCardDescriptionInput): Promise<GenerateCardDescriptionOutput> {
  return generateCardDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCardDescriptionPrompt',
  input: {schema: GenerateCardDescriptionInputSchema},
  output: {schema: GenerateCardDescriptionOutputSchema},
  prompt: `You are a creative writer for a fantasy trading card game.
Given the card title "{{{cardTitle}}}", generate a very short, evocative, and thematic one-sentence description or flavor text suitable for the card.
The description MUST be 15 words or less. Do not include the card title in the description.`,
});

const generateCardDescriptionFlow = ai.defineFlow(
  {
    name: 'generateCardDescriptionFlow',
    inputSchema: GenerateCardDescriptionInputSchema,
    outputSchema: GenerateCardDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || { description: "A mysterious entity from the arcane realms." };
  }
);
