import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

const MAX_PROMPT_LENGTH = 8000;

/**
 * Plain text-in/text-out Gemini call — used by the Local Agent's on-device
 * fallback path (fact extraction + daily summary from OCR'd screen text,
 * never images). See docs/plan/11-offline-and-local-agent.md §11.3.
 */
@Injectable()
export class TextGenerationService {
  private client?: GoogleGenAI;

  async generate(prompt: string): Promise<string> {
    const trimmed = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
    const response = await this.getClient().models.generateContent({
      model: process.env.GEMINI_MEETING_MODEL ?? 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: trimmed }] }],
    });

    return response.text ?? '';
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured.',
      );
    }

    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }
}
