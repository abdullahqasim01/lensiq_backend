import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthenticatedRequest } from './auth.types';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseAuthService: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const user = await this.firebaseAuthService.verifyBearerToken(token);
    (request as AuthenticatedRequest).user = user;

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) return undefined;

    return token.trim();
  }
}
