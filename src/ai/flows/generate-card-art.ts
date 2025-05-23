'use server';
/**
 * @fileOverview Generates card art based on the card title.
 *
 * - generateCardArt - A function that generates card art.
 * - GenerateCardArtInput - The input type for the generateCardArt function.
 * - GenerateCardArtOutput - The return type for the generateCardArt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardArtInputSchema = z.object({
  cardTitle: z.string().describe('The title of the card.'),
});
export type GenerateCardArtInput = z.infer<typeof GenerateCardArtInputSchema>;

const GenerateCardArtOutputSchema = z.object({
  cardArtDataUri: z
    .string()
    .describe(
      'The generated card art as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Intentionally escaped quotes.
    ),
});
export type GenerateCardArtOutput = z.infer<typeof GenerateCardArtOutputSchema>;

export async function generateCardArt(input: GenerateCardArtInput): Promise<GenerateCardArtOutput> {
  return generateCardArtFlow(input);
}

const generateCardArtPrompt = ai.definePrompt({
  name: 'generateCardArtPrompt',
  input: {schema: GenerateCardArtInputSchema},
  output: {schema: GenerateCardArtOutputSchema},
  prompt: `Generate a fantasy-themed image for a card with the title "{{{cardTitle}}}".

  The image should be suitable for a card in a fantasy card game.`, // Intentionally escaped quotes.
});

const generateCardArtFlow = ai.defineFlow(
  {
    name: 'generateCardArtFlow',
    inputSchema: GenerateCardArtInputSchema,
    outputSchema: GenerateCardArtOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `Generate an image of a fantasy themed card for the title ${input.cardTitle}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });
    return {cardArtDataUri: media.url!};
  }
);
