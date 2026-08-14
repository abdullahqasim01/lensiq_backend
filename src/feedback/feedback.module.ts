import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackMailService } from './feedback-mail.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedbackController],
  providers: [FeedbackMailService],
})
export class FeedbackModule {}
