import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  signInProvider?: string;
  token: DecodedIdToken;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface PublicAuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  signInProvider?: string;
}

export function toPublicAuthenticatedUser(
  user: AuthenticatedUser,
): PublicAuthenticatedUser {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    signInProvider: user.signInProvider,
  };
}
