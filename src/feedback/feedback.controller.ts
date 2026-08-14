import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { FeedbackMailService } from './feedback-mail.service';

interface SubmitFeedbackBody {
  deviceName?: unknown;
  category?: unknown;
  subCategory?: unknown;
  description?: unknown;
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 4000;

/**
 * 3-step feedback flow's submit call — native: `customer/submit/v2`. Per
 * product decision, this clone routes submissions over SMTP rather than
 * into an admin database (see `FeedbackMailService`), and is gated behind
 * sign-in like native (an anonymous/guest token isn't enough — feedback
 * needs a real reply-to address). See
 * docs/plan/10-settings-and-support.md §10.3.
 */
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly mailService: FeedbackMailService) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENTS, {
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    }),
  )
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() attachments: Express.Multer.File[] = [],
    @Body() body: SubmitFeedbackBody = {},
  ): Promise<{ success: true }> {
    if (!user.email || user.isAnonymous) {
      throw new UnauthorizedException(
        'Sign in with an account (not guest) to send feedback.',
      );
    }

    const category =
      typeof body.category === 'string' ? body.category.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    if (!category || !description) {
      throw new BadRequestException('category and description are required.');
    }

    await this.mailService.send({
      userEmail: user.email,
      deviceName:
        typeof body.deviceName === 'string' ? body.deviceName : undefined,
      category,
      subCategory:
        typeof body.subCategory === 'string' ? body.subCategory : undefined,
      description: description.slice(0, MAX_DESCRIPTION_LENGTH),
      attachments: attachments.map((file) => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
      })),
    });

    return { success: true };
  }
}
