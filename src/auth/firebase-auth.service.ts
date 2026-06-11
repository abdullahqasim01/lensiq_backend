import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';

import { FIREBASE_ADMIN_APP } from './firebase-admin.provider';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private readonly auth: Auth;

  constructor(@Inject(FIREBASE_ADMIN_APP) app: App) {
    this.auth = getAuth(app);
  }

  async verifyBearerToken(token: string): Promise<AuthenticatedUser> {
    try {
      const decoded = await this.auth.verifyIdToken(token, true);
      const signInProvider = decoded.firebase?.sign_in_provider;

      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified ?? false,
        isAnonymous: signInProvider === 'anonymous',
        signInProvider,
        token: decoded,
      };
    } catch (error) {
      this.logger.warn(
        `Firebase ID token verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new UnauthorizedException('Invalid or expired Firebase token.');
    }
  }
}
