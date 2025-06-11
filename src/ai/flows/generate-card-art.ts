
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
      'The generated card art as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type GenerateCardArtOutput = z.infer<typeof GenerateCardArtOutputSchema>;

export async function generateCardArt(input: GenerateCardArtInput): Promise<GenerateCardArtOutput> {
  return generateCardArtFlow(input);
}

const generateImageWithRetry = async (prompt: string, retries = 1, delayMs = 3000) => {
  try {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });
    if (!media || !media.url) {
      throw new Error('Image generation returned no media URL.');
    }
    return media;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Image generation failed, retrying in ${delayMs / 1000}s... (Retries left: ${retries -1})`, error);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return generateImageWithRetry(prompt, retries - 1, delayMs);
    } else {
      console.error("Image generation failed after multiple retries.", error);
      throw error; 
    }
  }
};

const generateCardArtFlow = ai.defineFlow(
  {
    name: 'generateCardArtFlow',
    inputSchema: GenerateCardArtInputSchema,
    outputSchema: GenerateCardArtOutputSchema,
  },
  async input => {
    const imageGenerationPrompt = `Create a unique, original piece of fantasy artwork for a trading card titled "${input.cardTitle}". The art must be an entirely new concept, not resembling existing game art or popular fantasy franchises. Style: painterly, detailed, evocative, high-fantasy. Ensure the image is suitable for a portrait-oriented card.`;
    
    const media = await generateImageWithRetry(imageGenerationPrompt);
    // The retry logic now ensures media.url exists or throws.
    return {cardArtDataUri: media.url!};
  }
);
