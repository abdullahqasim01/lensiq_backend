import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { toPublicAuthenticatedUser } from '../auth/auth.types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import {
  CreateTokenOptions,
  GeminiLiveTokenResponse,
  GeminiLiveTokenService,
} from './gemini-live-token.service';
import {
  MeetingAnalysisResult,
  MeetingAnalysisService,
} from './meeting-analysis.service';
import { TextGenerationService } from './text-generation.service';

interface CreateLiveTokenBody {
  systemInstruction?: unknown;
  responseModalities?: unknown;
  mediaResolution?: unknown;
}

interface AnalyzeMeetingBody {
  transcript?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
}

interface GenerateTextBody {
  prompt?: unknown;
}

const MAX_MEETING_AUDIO_BYTES = 19 * 1024 * 1024;

const MAX_SYSTEM_INSTRUCTION_LENGTH = 2000;
const VALID_MEDIA_RESOLUTIONS = new Set([
  'MEDIA_RESOLUTION_LOW',
  'MEDIA_RESOLUTION_MEDIUM',
  'MEDIA_RESOLUTION_HIGH',
]);

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

  if (
    typeof body.mediaResolution === 'string' &&
    VALID_MEDIA_RESOLUTIONS.has(body.mediaResolution)
  ) {
    options.mediaResolution = body.mediaResolution as
      | 'MEDIA_RESOLUTION_LOW'
      | 'MEDIA_RESOLUTION_MEDIUM'
      | 'MEDIA_RESOLUTION_HIGH';
  }

  return options;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly geminiLiveTokenService: GeminiLiveTokenService,
    private readonly meetingAnalysisService: MeetingAnalysisService,
    private readonly textGenerationService: TextGenerationService,
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

  /**
   * Analyzes a meeting: either an uploaded audio file (transcribe + summary
   * + mind map) or an already-known transcript (summary + mind map only —
   * see `docs/plan/07-meetings-overhaul.md` §7.5). Exactly one of `audio` /
   * `transcript` must be provided.
   */
  @Post('meeting/analyze')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: MAX_MEETING_AUDIO_BYTES },
    }),
  )
  analyzeMeeting(
    @CurrentUser() _user: AuthenticatedUser,
    @UploadedFile() audio: Express.Multer.File | undefined,
    @Body() body: AnalyzeMeetingBody = {},
  ): Promise<MeetingAnalysisResult> {
    const sourceLanguage =
      typeof body.sourceLanguage === 'string' && body.sourceLanguage.trim()
        ? body.sourceLanguage.trim()
        : undefined;
    const targetLanguage =
      typeof body.targetLanguage === 'string' && body.targetLanguage.trim()
        ? body.targetLanguage.trim()
        : undefined;

    if (audio) {
      return this.meetingAnalysisService.analyzeAudio(
        audio.buffer,
        audio.mimetype || 'audio/mp4',
        { sourceLanguage, targetLanguage },
      );
    }

    const transcript =
      typeof body.transcript === 'string' ? body.transcript.trim() : '';
    if (!transcript) {
      throw new BadRequestException(
        'Provide either an "audio" file or a "transcript" field.',
      );
    }
    return this.meetingAnalysisService.analyzeTranscript(transcript, {
      sourceLanguage,
      targetLanguage,
    });
  }

  /**
   * Plain text-in/text-out Gemini call — used by the Local Agent's
   * text-only fact-extraction/summary fallback (never sends images). See
   * docs/plan/11-offline-and-local-agent.md §11.3.
   */
  @Post('generate-text')
  @UseGuards(FirebaseAuthGuard)
  async generateText(
    @Body() body: GenerateTextBody = {},
  ): Promise<{ text: string }> {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      throw new BadRequestException('prompt is required.');
    }
    return { text: await this.textGenerationService.generate(prompt) };
  }
}
