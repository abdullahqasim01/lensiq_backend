import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from './current-user.decorator';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { toPublicAuthenticatedUser } from './auth.types';
import type { AuthenticatedUser, PublicAuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): {
    authenticated: true;
    user: PublicAuthenticatedUser;
  } {
    return {
      authenticated: true,
      user: toPublicAuthenticatedUser(user),
    };
  }
}
