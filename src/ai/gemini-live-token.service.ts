import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  GoogleGenAI,
  MediaResolution,
  Modality,
  type LiveConnectConfig,
} from '@google/genai';

import type { AuthenticatedUser } from '../auth/auth.types';

export interface GeminiLiveTokenResponse {
  token: string;
  model: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  uses: number;
  config: {
    responseModalities: string[];
    mediaResolution: string;
    sessionResumption: boolean;
  };
  audio: {
    inputMimeType: string;
    outputMimeType: string;
  };
}

@Injectable()
export class GeminiLiveTokenService {
  private client?: GoogleGenAI;

  async createToken(user: AuthenticatedUser): Promise<GeminiLiveTokenResponse> {
    const model =
      process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview';
    const uses = readPositiveInt('GEMINI_LIVE_TOKEN_USES', 1);
    const tokenLifetimeSeconds = user.isAnonymous
      ? readPositiveInt('GEMINI_LIVE_GUEST_TOKEN_SECONDS', 15 * 60)
      : readPositiveInt('GEMINI_LIVE_TOKEN_SECONDS', 30 * 60);
    const newSessionSeconds = readPositiveInt(
      'GEMINI_LIVE_NEW_SESSION_SECONDS',
      60,
    );
    const expiresAt = toFutureIso(tokenLifetimeSeconds);
    const newSessionExpiresAt = toFutureIso(newSessionSeconds);
    const liveConfig: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      systemInstruction:
        'You are Lensiq, a concise voice assistant for smart glasses. Answer naturally for spoken playback.',
      sessionResumption: {},
    };

    const token = await this.getClient().authTokens.create({
      config: {
        uses,
        expireTime: expiresAt,
        newSessionExpireTime: newSessionExpiresAt,
        liveConnectConstraints: {
          model,
          config: liveConfig,
        },
        lockAdditionalFields: [
          'responseModalities',
          'mediaResolution',
          'systemInstruction',
          'sessionResumption',
        ],
      },
    });

    if (!token.name) {
      throw new ServiceUnavailableException(
        'Gemini did not return an ephemeral token.',
      );
    }

    return {
      token: token.name,
      model,
      expiresAt,
      newSessionExpiresAt,
      uses,
      config: {
        responseModalities: ['AUDIO'],
        mediaResolution: 'MEDIA_RESOLUTION_LOW',
        sessionResumption: true,
      },
      audio: {
        inputMimeType: 'audio/pcm;rate=16000',
        outputMimeType: 'audio/pcm;rate=24000',
      },
    };
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured.',
      );
    }

    this.client = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1alpha',
    });
    return this.client;
  }
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function toFutureIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
