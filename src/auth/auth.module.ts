import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { firebaseAdminAppProvider } from './firebase-admin.provider';
import { FirebaseAuthService } from './firebase-auth.service';

@Module({
  controllers: [AuthController],
  providers: [firebaseAdminAppProvider, FirebaseAuthService, FirebaseAuthGuard],
  exports: [FirebaseAuthService, FirebaseAuthGuard],
})
export class AuthModule {}
