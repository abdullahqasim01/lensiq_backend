import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface FeedbackSubmission {
  userEmail: string;
  deviceName?: string;
  category: string;
  subCategory?: string;
  description: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Sends a feedback submission over SMTP — per product decision, feedback
 * has no admin UI/database yet, it's routed straight to a mailbox an
 * operator reads. See docs/plan/10-settings-and-support.md §10.3.
 */
@Injectable()
export class FeedbackMailService {
  private transporter?: nodemailer.Transporter;

  async send(submission: FeedbackSubmission): Promise<void> {
    const to = process.env.FEEDBACK_TO_EMAIL;
    if (!to) {
      throw new ServiceUnavailableException(
        'Feedback inbox is not configured (FEEDBACK_TO_EMAIL).',
      );
    }

    const lines = [
      `From: ${submission.userEmail}`,
      `Device: ${submission.deviceName ?? 'Unknown'}`,
      `Category: ${submission.category}${submission.subCategory ? ` / ${submission.subCategory}` : ''}`,
      '',
      submission.description,
    ];

    await this.getTransporter().sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      replyTo: submission.userEmail,
      subject: `Lensiq feedback: ${submission.category}`,
      text: lines.join('\n'),
      attachments: submission.attachments,
    });
  }

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new ServiceUnavailableException(
        'SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
    return this.transporter;
  }
}
