import { Controller, Get, Post, UseGuards } from '@nestjs/common';

import { toPublicAuthenticatedUser } from '../auth/auth.types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import {
  GeminiLiveTokenResponse,
  GeminiLiveTokenService,
} from './gemini-live-token.service';

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
  ): Promise<GeminiLiveTokenResponse> {
    return this.geminiLiveTokenService.createToken(user);
  }
}
