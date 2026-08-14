import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { toPublicAuthenticatedUser } from '../auth/auth.types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import {
  CreateTokenOptions,
  GeminiLiveTokenResponse,
  GeminiLiveTokenService,
} from './gemini-live-token.service';

interface CreateLiveTokenBody {
  systemInstruction?: unknown;
  responseModalities?: unknown;
}

const MAX_SYSTEM_INSTRUCTION_LENGTH = 2000;

function sanitizeTokenOptions(body: CreateLiveTokenBody): CreateTokenOptions {
  const options: CreateTokenOptions = {};

  if (
    typeof body.systemInstruction === 'string' &&
    body.systemInstruction.trim().length > 0
  ) {
    options.systemInstruction = body.systemInstruction
      .trim()
      .slice(0, MAX_SYSTEM_INSTRUCTION_LENGTH);
  }

  if (Array.isArray(body.responseModalities)) {
    const modalities = body.responseModalities.filter(
      (value): value is 'AUDIO' | 'TEXT' =>
        value === 'AUDIO' || value === 'TEXT',
    );
    if (modalities.length > 0) options.responseModalities = modalities;
  }

  return options;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly geminiLiveTokenService: GeminiLiveTokenService,
  ) {}

  @Get('status')
  @UseGuards(FirebaseAuthGuard)
  status(@CurrentUser() user: AuthenticatedUser) {
    return {
      readyForAi: true,
      authenticated: true,
      user: toPublicAuthenticatedUser(user),
    };
  }

  @Post('live-token')
  @UseGuards(FirebaseAuthGuard)
  createLiveToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLiveTokenBody = {},
  ): Promise<GeminiLiveTokenResponse> {
    return this.geminiLiveTokenService.createToken(
      user,
      sanitizeTokenOptions(body),
    );
  }
}
