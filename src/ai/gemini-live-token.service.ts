import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  GoogleGenAI,
  MediaResolution,
  Modality,
  type LiveConnectConfig,
} from '@google/genai';

import type { AuthenticatedUser } from '../auth/auth.types';

export interface CreateTokenOptions {
  /** Overrides the default assistant system instruction (e.g. per AI mode). */
  systemInstruction?: string;
  /** Overrides the default `['AUDIO']` response modality. */
  responseModalities?: Array<'AUDIO' | 'TEXT'>;
}

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

  async createToken(
    user: AuthenticatedUser,
    options: CreateTokenOptions = {},
  ): Promise<GeminiLiveTokenResponse> {
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
    // The token below is minted with `lockAdditionalFields: []`, which locks
    // the session to *exactly* the config set here — a client connecting
    // with this token cannot override systemInstruction/responseModalities
    // in its own `setup` message, the server just enforces what was minted.
    // So per-mode behavior (translate/meeting having a different system
    // instruction or a text-only response) has to be requested here, at
    // token-mint time, not left to the client's setup message.
    const responseModalities = (options.responseModalities ?? ['AUDIO']).map(
      (modality) => (modality === 'TEXT' ? Modality.TEXT : Modality.AUDIO),
    );
    const liveConfig: LiveConnectConfig = {
      responseModalities,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      systemInstruction:
        options.systemInstruction ??
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
        // Empty array = lock exactly the fields set in liveConnectConstraints
        // (model, modalities, resolution, system instruction, resumption).
        // Listing field names here breaks: the SDK emits invalid mask paths
        // (e.g. bare "mediaResolution") and Gemini rejects the request.
        lockAdditionalFields: [],
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
        responseModalities: options.responseModalities ?? ['AUDIO'],
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
