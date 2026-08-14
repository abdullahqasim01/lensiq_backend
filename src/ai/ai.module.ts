import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { GeminiLiveTokenService } from './gemini-live-token.service';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { TextGenerationService } from './text-generation.service';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    GeminiLiveTokenService,
    MeetingAnalysisService,
    TextGenerationService,
  ],
})
export class AiModule {}
