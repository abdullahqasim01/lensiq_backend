import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { GeminiLiveTokenService } from './gemini-live-token.service';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [GeminiLiveTokenService],
})
export class AiModule {}
